-- =============================================================================
-- audit_findings_detail view
-- =============================================================================
-- Flattens each finding with the context the UI needs: which dealer it belongs
-- to (via the audit run), and the page's URL + page_type when the finding is
-- tied to a planned page (discovered_unplanned findings have no page).
--
-- Updates still go to the base audit_findings table (resolve / ignore actions).
-- security_invoker = true keeps RLS in force for the querying user.
-- =============================================================================
create or replace view public.audit_findings_detail
with (security_invoker = true) as
select
  f.id,
  f.finding_type,
  f.details,
  f.status,
  f.created_at,
  f.resolved_at,
  f.page_id,
  f.run_id,
  r.dealer_id,
  d.name        as dealer_name,
  p.url         as page_url,
  pt.page_type  as page_type
from public.audit_findings f
left join public.audit_runs r       on r.id = f.run_id
left join public.dealers d          on d.id = r.dealer_id
left join public.pages p            on p.id = f.page_id
left join public.page_templates pt  on pt.id = p.template_id;

grant select on public.audit_findings_detail to authenticated;
