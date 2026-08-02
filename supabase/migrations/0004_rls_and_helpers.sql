create table if not exists public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  added_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create index if not exists account_members_user_id_idx on public.account_members (user_id);

-- security definer helpers so RLS policies don't recurse into account_members
create or replace function public.is_account_member(aid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.account_members
    where account_id = aid and user_id = auth.uid()
  );
$$;

create or replace function public.is_account_owner(aid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.account_members
    where account_id = aid
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

grant execute on function public.is_account_member(uuid) to authenticated;
grant execute on function public.is_account_owner(uuid) to authenticated;

-- auto-add creator as owner-member
create or replace function public.add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_members (account_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists accounts_add_owner on public.accounts;
create trigger accounts_add_owner
  after insert on public.accounts
  for each row execute function public.add_owner_as_member();

-- enable RLS
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.account_members enable row level security;

-- accounts policies
create policy "accounts_select_members" on public.accounts
  for select
  using (deleted_at is null and public.is_account_member(id));

create policy "accounts_insert_self" on public.accounts
  for insert
  with check (owner_id = auth.uid());

create policy "accounts_update_members" on public.accounts
  for update
  using (public.is_account_member(id));

create policy "accounts_delete_owner" on public.accounts
  for delete
  using (public.is_account_owner(id));

-- transactions policies
create policy "transactions_select_members" on public.transactions
  for select
  using (deleted_at is null and public.is_account_member(account_id));

create policy "transactions_insert_members" on public.transactions
  for insert
  with check (public.is_account_member(account_id));

create policy "transactions_update_members" on public.transactions
  for update
  using (public.is_account_member(account_id));

create policy "transactions_delete_members" on public.transactions
  for delete
  using (public.is_account_member(account_id));

-- account_members policies
create policy "members_select_visible" on public.account_members
  for select
  using (
    user_id = auth.uid()
    or public.is_account_member(account_id)
  );

create policy "members_insert_owner" on public.account_members
  for insert
  with check (
    -- owner inserting others OR trigger inserting the initial owner
    public.is_account_owner(account_id)
    or (user_id = auth.uid() and role = 'owner')
  );

create policy "members_delete_owner" on public.account_members
  for delete
  using (public.is_account_owner(account_id));
