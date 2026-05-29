import { isJiraConfigured, getIssue } from "@/lib/jira"
import { markReviewed } from "@/lib/scheduler"

/**
 * Pull status back from Jira for a dealer's linked pages + subtasks.
 * - A page whose Jira issue is in the "done" category is treated as reviewed:
 *   markReviewed sets last_reviewed_at + the next cadence due date.
 * - Subtask statuses mirror their Jira issue's status category.
 * Credential-gated. Returns { checked, completed, subtasksSynced }.
 */
const SUBTASK_STATUS = { done: "done", indeterminate: "in_progress", new: "open" }

export async function syncDealerFromJira(supabase, dealerId) {
  if (!isJiraConfigured()) return { skipped: true }

  const nowIso = new Date().toISOString()

  // Pages linked to Jira.
  const { data: pages } = await supabase
    .from("pages")
    .select("id, jira_issue_key, status")
    .eq("dealer_id", dealerId)
    .not("jira_issue_key", "is", null)

  let checked = 0
  let completed = 0
  for (const p of pages ?? []) {
    let issue
    try {
      issue = await getIssue(p.jira_issue_key)
    } catch {
      continue
    }
    checked++
    if (issue.statusCategory === "done" && p.status !== "Backlog") {
      await markReviewed(supabase, p.id)
      completed++
    }
    await supabase.from("pages").update({ jira_synced_at: nowIso }).eq("id", p.id)
  }

  // Subtasks linked to Jira (for this dealer's pages).
  const { data: subs } = await supabase
    .from("subtasks")
    .select("id, jira_issue_key, status, pages!inner(dealer_id)")
    .eq("pages.dealer_id", dealerId)
    .not("jira_issue_key", "is", null)

  let subtasksSynced = 0
  for (const s of subs ?? []) {
    let issue
    try {
      issue = await getIssue(s.jira_issue_key)
    } catch {
      continue
    }
    const next = SUBTASK_STATUS[issue.statusCategory] ?? "open"
    if (next !== s.status) {
      await supabase.from("subtasks").update({ status: next }).eq("id", s.id)
      subtasksSynced++
    }
  }

  return { checked, completed, subtasksSynced }
}
