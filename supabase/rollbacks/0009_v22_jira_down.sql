-- Rollback for 0009.
drop index if exists public.pages_jira_issue_key_idx;
alter table public.pages drop column if exists jira_issue_key, drop column if exists jira_synced_at;
alter table public.subtasks drop column if exists jira_issue_key;
