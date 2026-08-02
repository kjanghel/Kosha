-- Migration 0007: Route all writes through security-definer RPCs.
--
-- Direct PostgREST INSERT/UPDATE/DELETE against tables scoped `to authenticated`
-- fails 42501 on this project (likely tied to Supabase's asymmetric JWT signing
-- keys rollout). RPCs on the same JWT work reliably, so we expose one RPC per
-- write and let the client stay on the SDK.
--
-- Reads (SELECT) keep going straight to the table endpoints — those RLS policies
-- are `{public}` scoped and use `auth.uid()`, which is proven to resolve
-- correctly on this project.

-- ---------------------------------------------------------------------------
-- Cleanup: undo the debug state from investigation
-- ---------------------------------------------------------------------------

drop policy if exists "accounts_insert_self" on public.accounts;
create policy "accounts_insert_self" on public.accounts
  for insert
  with check (owner_id = (select auth.uid()));

alter table public.accounts enable trigger accounts_add_owner;

drop function if exists public.debug_insert_check(uuid);
drop table if exists public.rls_debug;
drop function if exists public.create_account_debug(text, text);
drop function if exists public.whoami();
drop function if exists public.whoami2();

-- ---------------------------------------------------------------------------
-- Account write RPCs
-- ---------------------------------------------------------------------------

create or replace function public.kosha_create_account(
  p_kind text,
  p_name text,
  p_category text default null,
  p_start_date date default null,
  p_notes text default null,
  p_interest_rate numeric default null,
  p_original_principal numeric default null,
  p_tenure_months int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_kind not in ('investment', 'loan') then
    raise exception 'invalid kind: %', p_kind;
  end if;

  insert into public.accounts (
    owner_id, kind, name, category, start_date, notes,
    interest_rate, original_principal, tenure_months,
    created_by, updated_by
  )
  values (
    uid, p_kind, p_name, p_category, p_start_date, p_notes,
    p_interest_rate, p_original_principal, p_tenure_months,
    uid, uid
  )
  returning id into new_id;

  -- Belt-and-braces: trigger accounts_add_owner also does this, but if it's
  -- disabled for any reason we still end up with a valid member row.
  insert into public.account_members (account_id, user_id, role)
  values (new_id, uid, 'owner')
  on conflict do nothing;

  return new_id;
end;
$$;

grant execute on function public.kosha_create_account(
  text, text, text, date, text, numeric, numeric, int
) to authenticated;

create or replace function public.kosha_update_account(
  p_id uuid,
  p_name text,
  p_category text,
  p_start_date date,
  p_notes text,
  p_interest_rate numeric,
  p_original_principal numeric,
  p_tenure_months int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_account_member(p_id) then
    raise exception 'not a member of account %', p_id;
  end if;

  update public.accounts set
    name = p_name,
    category = p_category,
    start_date = p_start_date,
    notes = p_notes,
    interest_rate = p_interest_rate,
    original_principal = p_original_principal,
    tenure_months = p_tenure_months,
    updated_by = uid,
    updated_at = now()
  where id = p_id and deleted_at is null;
end;
$$;

grant execute on function public.kosha_update_account(
  uuid, text, text, date, text, numeric, numeric, int
) to authenticated;

create or replace function public.kosha_soft_delete_account(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_account_owner(p_id) then
    raise exception 'only the owner can delete this account';
  end if;

  update public.accounts
    set deleted_at = now(), updated_by = uid, updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.kosha_soft_delete_account(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Transaction write RPCs
-- ---------------------------------------------------------------------------

create or replace function public.kosha_create_transaction(
  p_account_id uuid,
  p_txn_type text,
  p_amount numeric,
  p_principal_component numeric,
  p_interest_component numeric,
  p_txn_date date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_account_member(p_account_id) then
    raise exception 'not a member of account %', p_account_id;
  end if;
  if p_txn_type not in ('contribution','withdrawal','valuation','disbursal','payment') then
    raise exception 'invalid txn_type: %', p_txn_type;
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'amount must be >= 0';
  end if;
  if p_txn_type = 'payment' then
    if p_principal_component is null or p_interest_component is null then
      raise exception 'payment requires principal and interest components';
    end if;
    if abs((p_principal_component + p_interest_component) - p_amount) >= 0.01 then
      raise exception 'principal + interest must equal amount';
    end if;
  end if;

  insert into public.transactions (
    account_id, txn_type, amount,
    principal_component, interest_component,
    txn_date, notes, created_by, updated_by
  )
  values (
    p_account_id, p_txn_type, p_amount,
    p_principal_component, p_interest_component,
    p_txn_date, p_notes, uid, uid
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.kosha_create_transaction(
  uuid, text, numeric, numeric, numeric, date, text
) to authenticated;

create or replace function public.kosha_update_transaction(
  p_id uuid,
  p_txn_type text,
  p_amount numeric,
  p_principal_component numeric,
  p_interest_component numeric,
  p_txn_date date,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acc_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select account_id into acc_id from public.transactions where id = p_id;
  if acc_id is null then raise exception 'transaction not found'; end if;
  if not public.is_account_member(acc_id) then
    raise exception 'not a member of the parent account';
  end if;
  if p_txn_type = 'payment' then
    if p_principal_component is null or p_interest_component is null then
      raise exception 'payment requires principal and interest components';
    end if;
    if abs((p_principal_component + p_interest_component) - p_amount) >= 0.01 then
      raise exception 'principal + interest must equal amount';
    end if;
  end if;

  update public.transactions set
    txn_type = p_txn_type,
    amount = p_amount,
    principal_component = p_principal_component,
    interest_component = p_interest_component,
    txn_date = p_txn_date,
    notes = p_notes,
    updated_by = uid,
    updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.kosha_update_transaction(
  uuid, text, numeric, numeric, numeric, date, text
) to authenticated;

create or replace function public.kosha_soft_delete_transaction(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acc_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select account_id into acc_id from public.transactions where id = p_id;
  if acc_id is null then raise exception 'transaction not found'; end if;
  if not public.is_account_member(acc_id) then
    raise exception 'not a member of the parent account';
  end if;

  update public.transactions
    set deleted_at = now(), updated_by = uid, updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.kosha_soft_delete_transaction(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Sharing RPCs
-- ---------------------------------------------------------------------------

create or replace function public.kosha_create_invite(
  p_account_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_account_member(p_account_id) then
    raise exception 'not a member of account %', p_account_id;
  end if;
  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'invalid email';
  end if;

  insert into public.account_invites (account_id, invited_email, invited_by)
  values (p_account_id, lower(trim(p_email)), uid)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.kosha_create_invite(uuid, text) to authenticated;

create or replace function public.kosha_cancel_invite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  acc_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select account_id into acc_id from public.account_invites where id = p_id;
  if acc_id is null then raise exception 'invite not found'; end if;
  if not public.is_account_owner(acc_id) then
    raise exception 'only the owner can cancel invites';
  end if;

  update public.account_invites
    set status = 'cancelled'
  where id = p_id;
end;
$$;

grant execute on function public.kosha_cancel_invite(uuid) to authenticated;

create or replace function public.kosha_remove_account_member(
  p_account_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_account_owner(p_account_id) then
    raise exception 'only the owner can remove members';
  end if;
  if exists (
    select 1 from public.account_members
    where account_id = p_account_id and user_id = p_user_id and role = 'owner'
  ) then
    raise exception 'cannot remove the owner';
  end if;

  delete from public.account_members
  where account_id = p_account_id and user_id = p_user_id;
end;
$$;

grant execute on function public.kosha_remove_account_member(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
