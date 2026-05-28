-- =============================================================================
-- dealer_dashboard view
-- =============================================================================
-- One row per dealer with the columns the dashboard needs, including two
-- aggregates that would otherwise require extra round-trips from the app:
--   open_findings  — count of audit_findings (status='open') across the
--                    dealer's pages
--   last_audit_at  — most recent completed audit run for the dealer
--
-- security_invoker = true makes the view run with the QUERYING user's
-- privileges, so the underlying tables' Row Level Security still applies
-- (no accidental bypass). Postgres 15+ (Supabase) supports this.
-- =============================================================================
create or replace view public.dealer_dashboard
with (security_invoker = true) as
select
  d.id,
  d.name,
  d.oem,
  d.package_tier,
  d.website,
  d.created_at,
  am.name                        as am_name,
  coalesce(f.open_findings, 0)   as open_findings,
  r.last_audit_at
from public.dealers d
left join public.account_managers am
  on am.id = d.am_id
left join (
  select p.dealer_id, count(*)::int as open_findings
  from public.audit_findings af
  join public.pages p on p.id = af.page_id
  where af.status = 'open'
  group by p.dealer_id
) f on f.dealer_id = d.id
left join (
  select dealer_id, max(completed_at) as last_audit_at
  from public.audit_runs
  group by dealer_id
) r on r.dealer_id = d.id;

grant select on public.dealer_dashboard to authenticated;
