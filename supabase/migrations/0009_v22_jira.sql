-- =============================================================================
-- V2.2 — Jira sync linkage
-- =============================================================================
-- Stores the Jira issue key created for each page / subtask, plus when a page
-- was last synced back from Jira. Null until the page is pushed.
-- =============================================================================
alter table public.pages
  add column jira_issue_key text,
  add column jira_synced_at timestamptz;

alter table public.subtasks
  add column jira_issue_key text;

create index pages_jira_issue_key_idx on public.pages (jira_issue_key)
  where jira_issue_key is not null;
