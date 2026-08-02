create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  txn_type text not null check (txn_type in (
    'contribution', 'withdrawal', 'valuation', 'disbursal', 'payment'
  )),
  amount numeric(14, 2) not null check (amount >= 0),
  principal_component numeric(14, 2),
  interest_component numeric(14, 2),
  txn_date date not null default current_date,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint payment_split_matches_amount check (
    txn_type <> 'payment'
    or (
      principal_component is not null
      and interest_component is not null
      and abs((principal_component + interest_component) - amount) < 0.01
    )
  )
);

create index if not exists transactions_account_id_idx on public.transactions (account_id);
create index if not exists transactions_txn_date_idx on public.transactions (txn_date desc);
create index if not exists transactions_deleted_at_idx on public.transactions (deleted_at);
