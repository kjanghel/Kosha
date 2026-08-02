create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('investment', 'loan')),
  name text not null,
  category text,
  currency text not null default 'INR',
  start_date date,
  notes text,
  interest_rate numeric(6, 3),
  original_principal numeric(14, 2),
  tenure_months int,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists accounts_owner_id_idx on public.accounts (owner_id);
create index if not exists accounts_kind_idx on public.accounts (kind);
create index if not exists accounts_deleted_at_idx on public.accounts (deleted_at);
