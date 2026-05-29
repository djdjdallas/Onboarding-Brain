-- =============================================================================
-- V2.1 — generated subtasks
-- =============================================================================
-- When a page is set to Optimize, one subtask per subtask_type is generated.
-- work_type / summary / owner are snapshotted so edits to subtask_types don't
-- rewrite already-generated work, and so the Jira CSV is stable.
-- =============================================================================
create table public.subtasks (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  page_id         uuid not null references public.pages (id) on delete cascade,
  subtask_type_id uuid references public.subtask_types (id),
  work_type       text,
  summary         text,
  status          text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  due_date        date,
  owner           text
);

create index subtasks_page_id_idx on public.subtasks (page_id);

alter table public.subtasks enable row level security;
create policy "authenticated full access" on public.subtasks
  for all to authenticated using (true) with check (true);
