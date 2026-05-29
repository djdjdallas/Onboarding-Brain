-- Rollback for 0006.
alter table public.pages drop column if exists last_reviewed_at;
