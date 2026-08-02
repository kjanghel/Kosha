-- Per-account rollup. security_invoker = on means RLS on underlying tables
-- is evaluated with the querying user's identity, so this view respects RLS.
create or replace view public.account_totals
  with (security_invoker = on)
  as
select
  a.id as account_id,
  a.kind,
  coalesce(
    sum(t.amount) filter (where t.txn_type = 'contribution'),
    0
  ) as total_contributed,
  coalesce(
    sum(t.amount) filter (where t.txn_type = 'withdrawal'),
    0
  ) as total_withdrawn,
  coalesce(
    sum(t.amount) filter (where t.txn_type = 'disbursal'),
    0
  ) as disbursed,
  coalesce(
    sum(t.principal_component) filter (where t.txn_type = 'payment'),
    0
  ) as principal_paid,
  coalesce(
    sum(t.interest_component) filter (where t.txn_type = 'payment'),
    0
  ) as interest_paid,
  coalesce(
    sum(t.amount) filter (where t.txn_type = 'payment'),
    0
  ) as total_paid,
  (
    select t2.amount
    from public.transactions t2
    where t2.account_id = a.id
      and t2.txn_type = 'valuation'
      and t2.deleted_at is null
    order by t2.txn_date desc, t2.created_at desc
    limit 1
  ) as latest_valuation
from public.accounts a
left join public.transactions t
  on t.account_id = a.id and t.deleted_at is null
where a.deleted_at is null
group by a.id, a.kind;

grant select on public.account_totals to authenticated;
