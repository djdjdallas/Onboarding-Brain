import { pageLabel } from "@/lib/jira-export"

/**
 * Subtask generation (server-only). When a page goes to Optimize, one subtask
 * per subtask_type is created, with the summary pattern filled in.
 */

/** Fill a summary pattern: "[SEO] Refresh Review - [Page Name]" -> "...- K5 SRP". */
export function renderSubtaskSummary(pattern, label, workType) {
  if (!pattern) return `${workType ?? "Subtask"} - ${label}`
  return pattern
    .replaceAll("[Page Name]", label)
    .replaceAll("[Page]", label)
    .replaceAll("{page}", label)
    .replaceAll("{{page}}", label)
}

/**
 * Generates subtasks for a page from all subtask_types. Idempotent: does
 * nothing if the page already has subtasks. Returns the number created.
 */
export async function generateSubtasksForPage(supabase, pageId) {
  const { count } = await supabase
    .from("subtasks")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageId)
  if ((count ?? 0) > 0) return 0

  const { data: page } = await supabase
    .from("pages")
    .select("id, model, pma_city, due_date, page_templates(page_type)")
    .eq("id", pageId)
    .single()
  if (!page) return 0

  const { data: types } = await supabase
    .from("subtask_types")
    .select("id, work_type, summary_pattern, likely_owner")
    .order("sort_order")
  if (!types?.length) return 0

  const label = pageLabel({
    page_type: page.page_templates?.page_type,
    model: page.model,
    pma_city: page.pma_city,
  })

  const rows = types.map((t) => ({
    page_id: pageId,
    subtask_type_id: t.id,
    work_type: t.work_type,
    summary: renderSubtaskSummary(t.summary_pattern, label, t.work_type),
    status: "open",
    due_date: page.due_date ?? null,
    owner: t.likely_owner ?? null,
  }))

  const { error } = await supabase.from("subtasks").insert(rows)
  if (error) return 0
  return rows.length
}
