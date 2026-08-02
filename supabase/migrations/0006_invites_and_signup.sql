create table if not exists public.account_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  invited_email text not null,
  invited_by uuid references auth.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists account_invites_email_idx
  on public.account_invites (lower(invited_email));
create index if not exists account_invites_account_idx
  on public.account_invites (account_id);

alter table public.account_invites enable row level security;

-- Members can see invites for their accounts (owner sees pending/accepted/cancelled)
create policy "invites_select_members" on public.account_invites
  for select
  using (public.is_account_member(account_id));

-- Invitees can see their own pending invites so the client can display them
create policy "invites_select_own_email" on public.account_invites
  for select
  using (
    status = 'pending'
    and lower(invited_email) = lower(
      coalesce(auth.jwt() ->> 'email', '')
    )
  );

create policy "invites_insert_members" on public.account_invites
  for insert
  with check (public.is_account_member(account_id));

-- Owner cancels; also update for status transitions
create policy "invites_update_owner" on public.account_invites
  for update
  using (public.is_account_owner(account_id));

-- Auto-link any pending invites addressed to the caller's email.
-- Returns the number of accounts newly linked.
create or replace function public.link_my_pending_invites()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  my_email text;
  linked_count int := 0;
begin
  select lower(email) into my_email
  from public.profiles
  where id = auth.uid();

  if my_email is null then
    return 0;
  end if;

  with new_members as (
    insert into public.account_members (account_id, user_id, role)
    select i.account_id, auth.uid(), 'editor'
    from public.account_invites i
    where i.status = 'pending'
      and lower(i.invited_email) = my_email
    on conflict do nothing
    returning account_id
  )
  select count(*) into linked_count from new_members;

  update public.account_invites
    set status = 'accepted'
  where status = 'pending'
    and lower(invited_email) = my_email;

  return linked_count;
end;
$$;

grant execute on function public.link_my_pending_invites() to authenticated;
