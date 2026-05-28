-- =============================================================================
-- Rollback for 0004_v2_admin.sql
-- =============================================================================
-- Run this ONLY to undo the V2.0 migration. Drops the new columns and tables.
-- Destroys any data stored in them (keywords, audit_log, discovered_pages, etc.).
-- Existing V1 columns (dealers.package_tier text, eligibility.flag_key) were
-- never touched, so V1 is fully restored.
-- =============================================================================

-- New columns on existing tables
alter table public.eligibility       drop column if exists eligibility_flag_type_id;
alter table public.priority_models   drop column if exists tracked;
alter table public.account_managers  drop column if exists is_active;

alter table public.page_templates
  drop column if exists content_example_url,
  drop column if exists specifications_doc_url,
  drop column if exists default_labels,
  drop column if exists stakeholder_notes;

alter table public.dealers
  drop column if exists package_tier_id,
  drop column if exists service_start_month,
  drop column if exists primary_pma_id;

alter table public.pages
  drop column if exists manual_priority_adjustment,
  drop column if exists manually_scheduled_due_date,
  drop column if exists notes,
  drop column if exists labels;

-- Dependent tables first, then standalone (FK-safe order)
drop table if exists public.discovered_pages;
drop table if exists public.keyword_targets;
drop table if exists public.audit_log;
drop table if exists public.package_tiers;
drop table if exists public.cadence_rules;
drop table if exists public.subtask_types;
drop table if exists public.keywords;
drop table if exists public.eligibility_flag_types;
