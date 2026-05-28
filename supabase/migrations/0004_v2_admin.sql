-- =============================================================================
-- V2.0 — Admin UI + Full Editability
-- =============================================================================
-- Adds reference-data tables (so the remaining Google Sheet tabs become
-- editable in-app), the keyword targeting matrix, discovered pages, an audit
-- log, and new editable columns on existing tables.
--
-- Backward compatibility: existing columns are KEPT (e.g. dealers.package_tier
-- text, eligibility.flag_key). New FK columns are added alongside and backfilled
-- by scripts/migrate-v1-to-v2.mjs. The old columns are dropped in a later
-- migration only after the data is verified — so V1 code keeps working.
--
-- Rollback: see 0004_v2_admin_down.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Standalone reference tables (no FKs to each other)
-- -----------------------------------------------------------------------------
create table public.eligibility_flag_types (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  key         text not null unique,
  label       text not null,
  description text,
  ui_group    text check (ui_group in ('Departments', 'Inventory', 'Languages', 'Programs', 'Other')),
  sort_order  int not null default 0
);

create table public.keywords (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  oem        text not null default 'KIA',
  keyword    text not null,
  is_active  boolean not null default true,
  unique (oem, keyword)
);

create table public.subtask_types (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  work_type         text not null unique,
  summary_pattern   text,
  trigger_description text,
  standard_inputs   text,
  process_doc       text,
  definition_of_done text,
  likely_owner      text,
  qa_reviewer       text,
  where_it_lives    text,
  notes             text,
  sort_order        int not null default 0
);

create table public.cadence_rules (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  cadence_key          text not null unique check (cadence_key in ('High', 'Medium', 'Low')),
  default_review_months int,
  when_to_use          text,
  typical_examples     text,
  due_date_behavior    text,
  override_guidance    text,
  risks_notes          text
);

create table public.package_tiers (
  id                            uuid primary key default gen_random_uuid(),
  created_at                    timestamptz not null default now(),
  name                          text not null unique check (name in ('Essential', 'Advanced', 'Elite')),
  new_pages_per_month           int,
  new_pages_per_year            int,
  optimization_capacity_per_month int,
  keyword_targeting_balance     int,
  primary_focus                 text,
  creation_rule                 text
);

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'dealer', 'page', 'page_template', 'pma', 'priority_model',
    'eligibility', 'keyword_target', 'discovered_page'
  )),
  entity_id   uuid not null,
  changed_by  uuid references public.account_managers (id),
  changed_at  timestamptz not null default now(),
  field_name  text,
  old_value   jsonb,
  new_value   jsonb
);

create index audit_log_entity_idx
  on public.audit_log (entity_type, entity_id, changed_at desc);

-- -----------------------------------------------------------------------------
-- 2. Dependent tables
-- -----------------------------------------------------------------------------
create table public.keyword_targets (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  dealer_id   uuid not null references public.dealers (id) on delete cascade,
  keyword_id  uuid not null references public.keywords (id) on delete cascade,
  pma_id      uuid not null references public.pmas (id) on delete cascade,
  is_targeted boolean not null default false,
  unique (dealer_id, keyword_id, pma_id)
);

create index keyword_targets_dealer_keyword_idx on public.keyword_targets (dealer_id, keyword_id);
create index keyword_targets_dealer_pma_idx     on public.keyword_targets (dealer_id, pma_id);

create table public.discovered_pages (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  dealer_id            uuid not null references public.dealers (id) on delete cascade,
  url                  text not null,
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz,
  suggested_template_id uuid references public.page_templates (id),
  suggested_confidence numeric,
  status               text not null default 'open' check (status in ('open', 'accepted', 'dismissed', 'flagged')),
  accepted_as_page_id  uuid references public.pages (id),
  notes                text,
  reviewed_by          uuid references public.account_managers (id),
  reviewed_at          timestamptz,
  unique (dealer_id, url)
);

create index discovered_pages_dealer_status_idx on public.discovered_pages (dealer_id, status);

-- -----------------------------------------------------------------------------
-- 3. New columns on existing tables (additive, backward compatible)
-- -----------------------------------------------------------------------------
alter table public.pages
  add column manual_priority_adjustment numeric not null default 0,
  add column manually_scheduled_due_date date,
  add column notes text,
  add column labels text[] not null default '{}';

alter table public.dealers
  add column package_tier_id    uuid references public.package_tiers (id),
  add column service_start_month date,
  add column primary_pma_id     uuid references public.pmas (id);

alter table public.page_templates
  add column content_example_url   text,
  add column specifications_doc_url text,
  add column default_labels        text[] not null default '{}',
  add column stakeholder_notes     text;

alter table public.account_managers
  add column is_active boolean not null default true;

alter table public.priority_models
  add column tracked boolean not null default true;

-- eligibility: add FK to flag types alongside the existing free-text flag_key.
-- flag_key stays until migrate-v1-to-v2 backfills and we verify (dropped later).
alter table public.eligibility
  add column eligibility_flag_type_id uuid references public.eligibility_flag_types (id);

-- -----------------------------------------------------------------------------
-- 4. Row Level Security — same policy as V1 (authenticated full access)
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'eligibility_flag_types', 'keywords', 'keyword_targets', 'subtask_types',
    'cadence_rules', 'package_tiers', 'discovered_pages', 'audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "authenticated full access" on public.%I
         for all to authenticated using (true) with check (true);', t
    );
  end loop;
end $$;
