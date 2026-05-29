-- =============================================================================
-- V2.3 — multi-OEM support
-- =============================================================================
-- Makes the OEM list and each OEM's model lineup data-driven (replacing the
-- hardcoded KIA_MODELS constant). Existing dealers/templates/keywords already
-- carry an `oem` text column, so this is additive. Seeds Kia + its 9 models.
-- =============================================================================
create table public.oems (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null unique,
  label      text
);

create table public.oem_models (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  oem        text not null references public.oems (name) on delete cascade,
  model      text not null,
  sort_order int not null default 0,
  unique (oem, model)
);

insert into public.oems (name, label) values ('KIA', 'Kia')
  on conflict (name) do nothing;

insert into public.oem_models (oem, model, sort_order) values
  ('KIA', 'K5', 0), ('KIA', 'Sportage', 1), ('KIA', 'Seltos', 2),
  ('KIA', 'Sorento', 3), ('KIA', 'Carnival', 4), ('KIA', 'Telluride', 5),
  ('KIA', 'EV6', 6), ('KIA', 'EV9', 7), ('KIA', 'Niro', 8)
  on conflict (oem, model) do nothing;

alter table public.oems enable row level security;
alter table public.oem_models enable row level security;
create policy "authenticated full access" on public.oems
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.oem_models
  for all to authenticated using (true) with check (true);
