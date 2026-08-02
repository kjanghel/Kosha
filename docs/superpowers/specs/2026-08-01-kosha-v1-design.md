# Kosha v1 — Design

**Date:** 2026-08-01
**Status:** Approved for planning

## Summary

A mobile-first Progressive Web App for tracking personal investments **and loans** in a single unified portfolio. Users sign in with Google, create investment or loan accounts, log transactions (contributions, withdrawals, valuations for investments; disbursals, payments for loans), and see per-account and overall metrics including net worth, P&L, and XIRR. Accounts can be shared with other users by email invite, with owner/editor roles. Hosted free on GitHub Pages with Supabase as the backend.

The app is a mash-up of two existing reference projects: **BusinessAnalyzer**'s mobile-first investment UI and math, and **EventPlanner**'s Supabase-based multi-user sharing pattern.

## Goals

- Track multiple investments and loans in one place
- See a unified **net worth** (investments value − loans outstanding) on the dashboard
- Compute correct **XIRR** (money-weighted return) per account and portfolio-wide
- Share individual accounts with other users (editor role)
- Zero-cost hosting (GitHub Pages + Supabase free tier)
- Installable PWA on mobile

## Non-Goals (v1)

Explicitly out of scope, deferrable to v2:

- Realtime sync (manual refresh only)
- Attachments / receipts (no file uploads)
- Recurring / scheduled contributions (SIPs), EMI reminders
- Multi-currency (INR-only)
- Amortization schedule / EMI auto-calc for loans
- Notifications (push / email)
- Data export (CSV/JSON)
- Undo / audit-trail UI (soft deletes exist but no restore UI)
- Charts beyond one dashboard trend chart
- Localization (English + INR only)
- Analytics / telemetry
- Test coverage for UI components (only pure functions tested)
- CI/CD (manual `npm run deploy`)

## Architecture & Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + `react-router-dom` v6
- **Backend:** Supabase (Postgres + Auth + RLS) — free tier, new project (separate from EventPlanner)
- **Auth:** Google OAuth (one-click) via Supabase
- **Hosting:** GitHub Pages via `gh-pages -d dist` npm script
- **PWA:** installable, offline shell (service worker as in EventPlanner)
- **Charts:** Recharts
- **State:** React Context for auth/current-user; per-page `useEffect` fetches from Supabase (no heavy state library)
- **Icons:** `lucide-react`
- **Currency formatting:** INR with Indian comma grouping (like BA's `formatINR`)
- **Testing:** Vitest + React Testing Library for pure functions (XIRR, formatters) and critical hooks; UI-heavy components tested manually
- **Layout target:** mobile-first, `max-width: 430px` centered container (works nicely on desktop too)
- **XIRR:** Newton-Raphson in client TypeScript (`src/lib/finance.ts`); no SQL math

## Data Model

Unified `accounts` table with `kind` discriminator (`investment` | `loan`). Nullable loan-specific columns. Sharing/audit/RLS boilerplate lifted from EventPlanner's proven pattern.

### Tables

```sql
-- profiles: extends auth.users with email for invite-by-email lookup
profiles (
  id           uuid pk references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
)

-- accounts: an investment OR a loan
accounts (
  id                 uuid pk default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  kind               text not null check (kind in ('investment', 'loan')),
  name               text not null,
  category           text,             -- free-text tag: "Stocks", "Real Estate", "Home Loan"
  currency           text not null default 'INR',
  start_date         date,
  notes              text,
  -- loan-only fields (nullable, ignored for kind='investment'):
  interest_rate      numeric(6, 3),
  original_principal numeric(14, 2),
  tenure_months      int,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id),
  updated_by         uuid references auth.users(id)
)

-- sharing (owner + editors)
account_members (
  account_id uuid references accounts(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'editor')),
  added_at   timestamptz not null default now(),
  primary key (account_id, user_id)
)

-- pending email invites (auto-linked on signup / email match)
account_invites (
  id             uuid pk default gen_random_uuid(),
  account_id     uuid references accounts(id) on delete cascade,
  invited_email  text not null,
  invited_by     uuid references auth.users(id),
  status         text not null default 'pending'
                 check (status in ('pending', 'accepted', 'cancelled')),
  created_at     timestamptz not null default now()
)

-- unified transactions table (money movements + valuations)
transactions (
  id                   uuid pk default gen_random_uuid(),
  account_id           uuid not null references accounts(id) on delete cascade,
  txn_type             text not null check (txn_type in (
                         'contribution',  -- investment: money in
                         'withdrawal',    -- investment: money out
                         'valuation',     -- investment: snapshot of current value
                         'disbursal',     -- loan: money received
                         'payment'        -- loan: money paid back (with split)
                       )),
  amount               numeric(14, 2) not null check (amount >= 0),
  principal_component  numeric(14, 2),   -- only used for txn_type='payment'
  interest_component   numeric(14, 2),   -- only used for txn_type='payment'
  txn_date             date not null default current_date,
  notes                text,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id),
  updated_by           uuid references auth.users(id)
)
```

### Validation rules (enforced in DB via check constraints where practical, in client always)

- `txn_type` in `('contribution', 'withdrawal', 'valuation')` requires the parent account's `kind` to be `investment`
- `txn_type` in `('disbursal', 'payment')` requires the parent account's `kind` to be `loan`
- For `txn_type='payment'`: `principal_component + interest_component = amount` (enforced in client; DB has a check that both are non-null and sum matches within 0.01 tolerance)
- `loan`-only fields (`interest_rate`, `original_principal`, `tenure_months`) may be null for investments; UI hides them

### Views (`security_invoker=on`)

- **`account_totals`** — per-account rollup: `total_contributed`, `total_withdrawn`, `current_value` (latest valuation or `net_invested` fallback), `net_invested`, `unrealized_pl` for investments; `disbursed`, `principal_paid`, `interest_paid`, `outstanding` for loans
- No SQL view for XIRR — client computes from raw transactions

### RLS (lifted from EventPlanner pattern)

- Helper functions: `is_account_member(aid)`, `is_account_owner(aid)` — both `security definer` to avoid recursive policy checks
- **Members** can `select` / `insert` / `update` on `accounts`, `transactions`, `account_invites`, `account_members`
- **Only owner** can `delete` accounts, revoke members, cancel invites
- Owner auto-added to `account_members` via trigger on `accounts` insert (`add_owner_as_member`)
- `handle_new_user` trigger on `auth.users` insert creates a `profiles` row (email from OAuth metadata)
- `link_invites_for_profile` trigger on `profiles` insert/update: finds pending `account_invites` matching the user's email, inserts `account_members` (role=editor), marks invites `accepted`

### Soft deletes

All tables (`accounts`, `transactions`, `account_invites`) use `deleted_at`. RLS `select` policies filter `deleted_at is null`. Owner can hard-delete (row disappears from DB entirely) via a separate policy that permits `delete`.

## Auth & Sharing Flow

### Auth (Google OAuth)

1. User lands on `/login` → clicks "Continue with Google"
2. Supabase redirects to Google → back to app with session
3. On first login, `handle_new_user` trigger creates the `profiles` row (email pulled from `auth.users.raw_user_meta_data`)
4. Session persisted in browser (Supabase JS SDK handles this)
5. `ProtectedRoute` wrapper on all app routes; unauthenticated → `/login`

### Sharing — owner side

1. Owner opens account detail → **Share** button → `/accounts/:id/share`
2. Enters collaborator's email → creates `account_invites` row (status=pending)
3. UI shows list of pending invites (with cancel) + current members (with revoke)

### Sharing — invitee side

- **If invitee already signed up:** an RPC `link_my_pending_invites()` (security definer) is called from the app on session start and on manual refresh. It scans `account_invites` for pending rows matching the caller's email, inserts `account_members` (role=editor), and marks each invite `accepted`. Account then appears in the invitee's dashboard.
- **If invitee hasn't signed up yet:** they sign up with Google using the invited email → `handle_new_user` trigger inserts the profile row → the same linking logic runs (either via a trigger on profiles insert or by the client calling `link_my_pending_invites()` after first-login redirect). Account appears immediately.

Whether the linking runs from a DB trigger or a client-called RPC is an implementation choice for the plan phase; the RPC approach is simpler because it covers both cases with one path.

### Roles

- **owner** — full permissions + can delete account, revoke members, cancel invites
- **editor** — can add/edit/delete transactions, edit account fields (name/notes/etc.)
- No viewer-only role in v1

### Manual refresh

Every screen has a small refresh icon in the header. Clicking re-fetches from Supabase. No realtime subscriptions in v1.

## UI / Navigation Structure

Mobile-first, `max-width: 430px` centered container. Bottom nav + FAB, installable PWA.

### Routes

- `/login` — Google sign-in
- `/` — **Dashboard**: overall portfolio + net worth
- `/accounts` — **List** of all investments + loans, filter chips: All / Investments / Loans
- `/accounts/:id` — **Detail**: header card, metrics strip, transaction list
- `/accounts/new` — Create account (choose kind first)
- `/accounts/:id/share` — Members + pending invites + add-by-email form
- `/profile` — signed-in user, logout

### Bottom nav (3 tabs)

Home · Accounts · Profile

### FAB (floating +)

Context-aware:
- On Dashboard / Accounts list → "New Account" dialog
- On Account detail → "New Transaction" (pre-typed for that account, opens bottom sheet)

### Dashboard layout (top → bottom)

1. Header: greeting + refresh icon
2. **Net Worth card** (big number): `Investments Value − Loans Outstanding`
3. Two summary tiles side-by-side:
   - **Investments** block: invested / current value / P&L / return %
   - **Loans** block: outstanding / principal paid / interest paid
4. **Portfolio XIRR** row + top gainer / top loser cards
5. Horizontally scrollable KPI tiles (# accounts, total contributions, etc.)
6. Trend chart (Recharts area): net contributions vs current value over time

### Account detail layout

1. Sticky header: name, kind badge, primary metric (current value or outstanding), refresh, share, overflow menu (edit / delete)
2. Metric strip:
   - Investment: P&L, Return %, XIRR
   - Loan: Outstanding, Interest Paid, Progress %
3. FAB with sub-options based on kind:
   - Investment: Contribution / Withdrawal / Valuation
   - Loan: Payment / Disbursal
4. Transaction list, chronological (newest first). Each row: type icon, amount, date, notes preview. Tap → edit / delete.

### Add / edit transaction UX

Single bottom sheet with:
- Type selector (chips)
- Amount input
- Date picker (defaults to today)
- Notes textarea
- For loan `payment`: principal + interest split fields; auto-validated (`principal + interest = amount`) with inline error

### Visual style

Clean, minimal. Tailwind stone/slate + a single accent (indigo). Soft shadows, generous whitespace, no emoji. Semantic colors: green gains, red losses, muted neutrals.

## Key Computations

All done client-side in pure TypeScript in `src/lib/finance.ts`. Fully unit-tested with Vitest.

### Per investment account

```
total_contributed = Σ contributions.amount
total_withdrawn   = Σ withdrawals.amount
current_value     = latest valuation.amount (by txn_date desc, then created_at desc)
                    — if no valuation exists, defaults to net_invested
net_invested      = total_contributed − total_withdrawn
unrealized_pl     = current_value − net_invested
return_pct        = unrealized_pl / total_contributed × 100
duration_days     = today − earliest contribution date
xirr              = Newton-Raphson on cashflows:
                    contributions (negative sign)
                    + withdrawals (positive sign)
                    + current_value (positive, dated today)
```

### Per loan account

```
disbursed         = Σ disbursal.amount            (usually 1 row: the original loan)
principal_paid    = Σ payment.principal_component
interest_paid     = Σ payment.interest_component
total_paid        = Σ payment.amount              (== principal + interest, validated)
outstanding       = disbursed − principal_paid
progress_pct      = principal_paid / disbursed × 100
```

### Overall dashboard

```
investments_value   = Σ current_value across all investment accounts
investments_cost    = Σ net_invested across all investment accounts
investments_pl      = investments_value − investments_cost
investments_return  = investments_pl / investments_cost × 100

loans_outstanding   = Σ outstanding across all loan accounts
loans_interest_paid = Σ interest_paid across all loan accounts

net_worth           = investments_value − loans_outstanding
portfolio_xirr      = XIRR over combined cashflows from all investment accounts
                      (single stream, correctly dated)
```

### XIRR implementation notes

- Newton-Raphson, initial guess `0.1`, max 100 iterations, tolerance `1e-6`
- Cashflow sign convention: money leaving user = **negative**, money coming back = **positive**
- Return `null` (UI shows `—`) if:
  - fewer than 2 cashflows, OR
  - all cashflows same sign, OR
  - no convergence within iteration limit
- Test cases: BusinessAnalyzer sample data + synthetic edge cases (same-day, zero P&L, deep loss, single cashflow, all same sign)

### Loan payment validation

- `principal_component + interest_component = amount` (tolerance 0.01)
- If either component is left blank, default to `principal_component = amount, interest_component = 0` with a UI warning
- DB-side check constraint enforces the sum (matching the client rule)

## Repo & Deployment

### Repo

New GitHub repo `Kosha` (public, since GitHub Pages free tier requires public for personal accounts without GitHub Pro).

### Hosting split

- **Frontend:** GitHub Pages via `npm run deploy` → `gh-pages -d dist` (matches BusinessAnalyzer)
- **Backend:** new Supabase project on free tier
- Supabase URL + anon key committed to `.env.production` (safe — anon key is public and RLS enforces access)
- `vite.config.ts` sets `base: '/Kosha/'` for the GitHub Pages sub-path

### Google OAuth setup (one-time, documented in README)

1. Google Cloud Console → OAuth consent screen + credentials
2. Add authorized redirect: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Paste client ID + secret into Supabase Dashboard → Auth → Providers → Google
4. Add site URL: `https://<username>.github.io/Kosha/`

### Project structure

```
Kosha/
├── public/                       # PWA manifest, icons, favicon
├── src/
│   ├── lib/
│   │   ├── supabase.ts           # client init
│   │   ├── auth.tsx              # AuthProvider + useAuth hook
│   │   ├── queries.ts            # typed Supabase queries + shared types
│   │   ├── finance.ts            # XIRR + metric calculations (pure, tested)
│   │   └── format.ts             # INR formatter, date formatter
│   ├── components/
│   │   ├── layout/               # AppShell, BottomNav, ProtectedRoute
│   │   ├── dashboard/            # NetWorthCard, SummaryTiles, TrendChart
│   │   ├── accounts/             # AccountsList, AccountCard, AccountForm
│   │   ├── account/              # DetailHeader, TxnList, TxnFormSheet, MembersView
│   │   └── ui/                   # Button, Card, Sheet, Toast (small reusable set)
│   ├── pages/                    # LoginPage, DashboardPage, AccountsPage,
│   │                             # AccountDetailPage, AccountFormPage,
│   │                             # SharePage, ProfilePage
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   └── migrations/               # 0001_profiles.sql
│                                 # 0002_accounts.sql
│                                 # 0003_transactions.sql
│                                 # 0004_rls_and_helpers.sql
│                                 # 0005_views.sql
│                                 # 0006_invites_and_signup.sql
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md                     # setup + deploy instructions
```

### CI/CD

Skipped for v1. Manual `npm run deploy` for now. Can add GitHub Actions in v2.

## Success Criteria for v1

- User can sign in with Google
- User can create investments and loans
- User can log transactions of the correct types for each kind
- Per-account metrics (P&L, XIRR, outstanding, etc.) are correct against known test data
- Dashboard shows correct net worth aggregating across all accounts
- User can share an account by email and the invitee sees it after signing up
- App is installable as a PWA on mobile
- App is deployed and reachable at `https://<username>.github.io/Kosha/`
- No hard-coded secrets in source (Supabase URL + anon key from `.env.production`, safe by RLS design)
