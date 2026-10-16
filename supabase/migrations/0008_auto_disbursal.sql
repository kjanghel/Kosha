-- Migration 0008: When creating a loan with an original_principal, auto-create
-- the initial disbursal transaction so loan metrics work out of the box.

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

  insert into public.account_members (account_id, user_id, role)
  values (new_id, uid, 'owner')
  on conflict do nothing;

  -- For loans with a known principal, record the initial disbursal so
  -- outstanding = original_principal from day one. Payments then draw it down.
  if p_kind = 'loan'
     and p_original_principal is not null
     and p_original_principal > 0
  then
    insert into public.transactions (
      account_id, txn_type, amount, txn_date, notes,
      created_by, updated_by
    )
    values (
      new_id, 'disbursal', p_original_principal,
      coalesce(p_start_date, current_date),
      'Initial disbursal',
      uid, uid
    );
  end if;

  return new_id;
end;
$$;

notify pgrst, 'reload schema';
