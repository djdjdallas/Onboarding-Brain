-- =============================================================================
-- V2.1 — am_workload view
-- =============================================================================
-- Per-account-manager open workload with date windows (relative to today).
-- "Open" = scheduled, non-Backlog pages with a due date. Date windows are
-- evaluated at query time via current_date.
-- =============================================================================
create or replace view public.am_workload
with (security_invoker = true) as
select
  am.id                                                                   as am_id,
  am.name                                                                 as am_name,
  count(*) filter (where p.due_date < current_date)                       as overdue,
  count(*) filter (where p.due_date >= current_date
                     and p.due_date < current_date + 7)                   as due_7,
  count(*) filter (where p.due_date >= current_date
                     and p.due_date < current_date + 30)                  as due_30,
  count(*) filter (where p.next_step = 'Build')                           as builds,
  count(*) filter (where p.next_step = 'Optimize')                        as optimizes,
  count(*)                                                                as open_total
from public.account_managers am
join public.dealers d on d.am_id = am.id
join public.pages p   on p.dealer_id = d.id
where p.status <> 'Backlog'
  and p.due_date is not null
group by am.id, am.name;

grant select on public.am_workload to authenticated;
