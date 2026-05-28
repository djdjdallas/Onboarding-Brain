-- =============================================================================
-- SEO Page Manager — initial schema
-- =============================================================================
-- Conventions for every table:
--   id          uuid primary key, default gen_random_uuid()
--   created_at  timestamptz, default now()
--
-- Multi-tenancy / OEM: built Kia-only for V1 but the model is OEM-agnostic
-- (page_templates.oem, dealers.oem) so V2 can add brands without a migration.
--
-- Security: internal-only tool. RLS is ON for every table, and any
-- authenticated user may read/write everything. The seed script and cron job
-- use the service-role key, which bypasses RLS entirely.
-- =============================================================================

-- gen_random_uuid() is built into Postgres 13+ (Supabase is 15+), so no
-- extension is required.

-- =============================================================================
-- account_managers
-- =============================================================================
create table public.account_managers (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  name             text not null,
  email            text not null unique,
  jira_user_string text
);


-- =============================================================================
-- dealers
-- =============================================================================
create table public.dealers (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  oem          text not null default 'KIA',
  package_tier text not null check (package_tier in ('Essential', 'Advanced', 'Elite')),
  website      text,
  address      text,
  am_id        uuid references public.account_managers (id) on delete set null
);

create index dealers_am_id_idx on public.dealers (am_id);


-- =============================================================================
-- pmas (priority market areas)
-- mod_score is GENERATED from priority_order so it can never drift:
--   position 1 -> 1.00, position 9 -> 1 - (8 * 0.111) = 0.112
-- Reordering in the wizard just updates priority_order; the score follows.
-- =============================================================================
create table public.pmas (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  dealer_id      uuid not null references public.dealers (id) on delete cascade,
  city           text not null,
  priority_order int not null check (priority_order between 1 and 9),
  mod_score      numeric generated always as (1 - ((priority_order - 1) * 0.111)) stored,
  unique (dealer_id, priority_order)
);

create index pmas_dealer_id_idx on public.pmas (dealer_id);


-- =============================================================================
-- priority_models (same mod_score formula as pmas)
-- =============================================================================
create table public.priority_models (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  dealer_id      uuid not null references public.dealers (id) on delete cascade,
  model          text not null,
  priority_order int not null check (priority_order between 1 and 9),
  mod_score      numeric generated always as (1 - ((priority_order - 1) * 0.111)) stored,
  unique (dealer_id, priority_order)
);

create index priority_models_dealer_id_idx on public.priority_models (dealer_id);


-- =============================================================================
-- eligibility — one row per (dealer, flag). Wizard's ~20 checkboxes.
-- =============================================================================
create table public.eligibility (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  dealer_id  uuid not null references public.dealers (id) on delete cascade,
  flag_key   text not null,
  flag_value boolean not null default false,
  unique (dealer_id, flag_key)
);

create index eligibility_dealer_id_idx on public.eligibility (dealer_id);


-- =============================================================================
-- page_templates — OEM-agnostic page catalog, seeded from the Google Sheet's
-- Main_Page_Library tab. Drives page generation.
-- =============================================================================
create table public.page_templates (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  oem                  text not null default 'KIA',
  page_family          text not null,   -- Core, Required Page, Inventory, Local, Model, Service, Finance, Parts / Collision, Buyer Guide, Specials
  page_type            text not null,   -- e.g. 'Home Page', 'K5 SRP', 'K5 in PMA East Hartford'
  cadence              text,            -- High | Medium | Low (drives V2 rescheduling)
  base_priority        numeric not null default 3.0,
  page_intent          text,
  required_inputs      text,
  guardrail            text,
  description_template text,
  requires_model       boolean not null default false,
  requires_pma         boolean not null default false,
  gate_rules           jsonb not null default '[]'::jsonb  -- array of eligibility flag_keys, ALL required
);

create index page_templates_oem_idx on public.page_templates (oem);


-- =============================================================================
-- pages — materialized per-dealer page records (~180 per dealer).
-- =============================================================================
create table public.pages (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  dealer_id       uuid not null references public.dealers (id) on delete cascade,
  template_id     uuid references public.page_templates (id),
  model           text,        -- set for model-specific pages
  pma_city        text,        -- set for PMA-specific pages
  status          text not null check (status in ('LIVE', 'MISSING', 'Strategy', 'Available for Build', 'Backlog')),
  next_step       text check (next_step in ('Build', 'Optimize', 'Backlog')),
  url             text,
  priority_score  numeric,
  due_date        date,
  last_audited_at timestamptz
);

create index pages_dealer_status_idx on public.pages (dealer_id, status);
create index pages_due_date_idx       on public.pages (due_date);
create index pages_priority_idx       on public.pages (priority_score desc);


-- =============================================================================
-- audit_runs — one row per dealer audit execution.
-- =============================================================================
create table public.audit_runs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  dealer_id     uuid not null references public.dealers (id) on delete cascade,
  started_at    timestamptz,
  completed_at  timestamptz,
  pages_checked int,
  errors_found  int
);

create index audit_runs_dealer_id_idx on public.audit_runs (dealer_id);


-- =============================================================================
-- audit_findings — individual issues surfaced by an audit run.
-- =============================================================================
create table public.audit_findings (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  page_id      uuid references public.pages (id) on delete cascade,
  run_id       uuid references public.audit_runs (id) on delete cascade,
  finding_type text not null check (finding_type in ('broken_url', 'title_mismatch', 'missing_from_sitemap', 'discovered_unplanned')),
  details      jsonb not null default '{}'::jsonb,
  status       text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  resolved_at  timestamptz
);

create index audit_findings_page_id_idx on public.audit_findings (page_id);
create index audit_findings_run_id_idx  on public.audit_findings (run_id);
create index audit_findings_status_idx  on public.audit_findings (status);


-- =============================================================================
-- Row Level Security
-- Internal tool: every authenticated user gets full read/write on every table.
-- The service-role key (seed script, cron) bypasses RLS automatically.
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'account_managers', 'dealers', 'pmas', 'priority_models', 'eligibility',
    'page_templates', 'pages', 'audit_runs', 'audit_findings'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "authenticated full access" on public.%I
         for all to authenticated using (true) with check (true);', t
    );
  end loop;
end $$;
