-- =============================================================================
-- V2.1 — cadence scheduling anchor
-- =============================================================================
-- last_reviewed_at records when a page was last optimized/reviewed. The cadence
-- scheduler rolls the next due_date forward from this anchor by the template's
-- cadence (High/Medium/Low -> cadence_rules.default_review_months).
-- =============================================================================
alter table public.pages
  add column last_reviewed_at date;
