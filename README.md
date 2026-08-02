# Kosha

Mobile-first PWA for tracking personal **investments and loans** in a single unified portfolio.
Sign in with Google, log transactions, see net worth, per-account XIRR, and share accounts with editors by email.

- **Stack:** React 18 + TypeScript + Vite + Tailwind + `react-router-dom` v6
- **Backend:** Supabase (Postgres + Auth + RLS), free tier
- **Hosting:** GitHub Pages via `npm run deploy`
- **Currency:** INR only (v1)

---

## Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com/) account
- A Google Cloud project for OAuth
- A GitHub account (the repo hosting this is used for GitHub Pages)

## 1. Install

```bash
npm install
```

## 2. Provision Supabase

1. Create a new Supabase project (any region, free tier).
2. In the SQL editor, run each migration in order:
   - `supabase/migrations/0001_profiles.sql`
   - `supabase/migrations/0002_accounts.sql`
   - `supabase/migrations/0003_transactions.sql`
   - `supabase/migrations/0004_rls_and_helpers.sql`
   - `supabase/migrations/0005_views.sql`
   - `supabase/migrations/0006_invites_and_signup.sql`
3. Copy the project URL and `anon` key from **Project Settings → API**.

## 3. Google OAuth

1. **Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth Client ID**.
2. Application type: Web application.
3. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   (from your Supabase project's **Auth → URL Configuration → Callback URL**).
4. In Supabase **Auth → Providers → Google**, paste the client ID and secret; enable.
5. In Supabase **Auth → URL Configuration**, add your site URLs:
   - `http://localhost:5173/Kosha/`
   - `https://<your-username>.github.io/Kosha/`

## 4. Local env

```bash
cp .env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

## 5. Run

```bash
npm run dev
```

App runs at `http://localhost:5173/Kosha/`.

## 6. Test

```bash
npm test
```

Pure financial functions (XIRR, per-account metrics, INR formatting) are unit-tested.
UI is verified manually.

## 7. Deploy (GitHub Pages)

The site's base path is `/Kosha/`. Make sure your GitHub repo is called `Kosha` (or update `base` in `vite.config.ts`).

```bash
npm run deploy
```

This runs `vite build` and pushes `dist/` to the `gh-pages` branch. Enable Pages from
that branch under **Repo Settings → Pages**.

---

## Architecture Notes

### Data model

- Single `accounts` table with a `kind` discriminator (`investment` | `loan`).
- Single `transactions` table with a `txn_type` (`contribution`, `withdrawal`, `valuation`, `disbursal`, `payment`).
- Payment split (`principal_component + interest_component == amount`) is validated in the client and enforced by a DB check constraint.
- Sharing via `account_members` (owner/editor) + pending `account_invites`.
- Soft deletes across the board (`deleted_at`); RLS `select` policies filter it out.
- Helper SQL functions `is_account_member(uuid)` and `is_account_owner(uuid)` are `security definer` to prevent recursion into RLS policies.
- Owner is auto-added as a member by a trigger on `accounts` insert.
- A new user's `profiles` row is created by a trigger on `auth.users` insert.

### Invite → auto-link flow

- Owner adds an email → row in `account_invites (status='pending')`.
- On every session start and manual refresh, the client calls the RPC `link_my_pending_invites()`, which:
  - reads the caller's email from `profiles`,
  - inserts `account_members(role='editor')` for every matching pending invite,
  - marks those invites `accepted`.
- Works whether the invitee already existed or just signed up.

### XIRR

Newton-Raphson in `src/lib/finance.ts`:
- initial guess `0.1`, max 100 iterations, tolerance `1e-6`
- money out = **negative** cashflow, money in = **positive**
- returns `null` for <2 flows, all-same-sign flows, or non-convergence (UI renders `—`)

### Routing

- `HashRouter` (paths like `/#/accounts/:id`). This sidesteps the GitHub Pages 404 dance while keeping a single-page app URL structure.

### Manual refresh

Every page has a refresh icon in the header — v1 has no realtime; users pull fresh data explicitly.

---

## v2 Ideas (not shipped)

Realtime subscriptions · attachments · SIPs/EMI reminders · multi-currency · CSV export · undo UI · richer charts · CI/CD · localization.
