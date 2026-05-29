-- =============================================================================
-- V2.3 — page performance metrics
-- =============================================================================
-- Per-page search metrics, one snapshot row per import. Populated by importing
-- a Google Search Console "Pages" CSV export (matched to pages by URL). A live
-- GSC OAuth sync can write to the same table later.
-- =============================================================================
create table public.page_metrics (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  page_id      uuid not null references public.pages (id) on delete cascade,
  captured_at  date not null default current_date,
  clicks       int,
  impressions  int,
  ctr          numeric,
  avg_position numeric,
  source       text not null default 'gsc_csv'
);

create index page_metrics_page_idx on public.page_metrics (page_id, captured_at desc);

alter table public.page_metrics enable row level security;
create policy "authenticated full access" on public.page_metrics
  for all to authenticated using (true) with check (true);
