import { createClient } from "@/lib/supabase/server"
import { pageLabel } from "@/lib/jira-export"
import { WorkQueue } from "@/components/work-queue"

export const metadata = { title: "Work Queue · SEO Page Manager" }

/**
 * Global work queue — every page that still needs doing across all dealers,
 * flattened into one prioritized, due-date-ordered list. This is the
 * cross-dealer equivalent of a dealer's Pages tab (and mirrors the
 * Full_Customized_Calendar sheet). Backlog/overflow pages are excluded; they
 * aren't active work.
 */
export default async function WorkQueuePage() {
  const supabase = await createClient()

  const [{ data: rawPages }, { data: ams }] = await Promise.all([
    supabase
      .from("pages")
      .select(
        "id, dealer_id, model, pma_city, status, next_step, priority_score, due_date, " +
          "manually_scheduled_due_date, page_templates(page_type, page_family), " +
          "dealers(name, am_id, account_managers(name))"
      )
      .neq("status", "Backlog")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("account_managers")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ])

  const rows = (rawPages ?? []).map((p) => ({
    id: p.id,
    dealer_id: p.dealer_id,
    dealer_name: p.dealers?.name ?? "—",
    am_id: p.dealers?.am_id ?? null,
    am_name: p.dealers?.account_managers?.name ?? null,
    page_label: pageLabel({
      page_type: p.page_templates?.page_type,
      model: p.model,
      pma_city: p.pma_city,
    }),
    page_family: p.page_templates?.page_family ?? null,
    model: p.model,
    pma_city: p.pma_city,
    status: p.status,
    next_step: p.next_step,
    priority_score: p.priority_score,
    due_date: p.manually_scheduled_due_date ?? p.due_date ?? null,
  }))

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-display font-medium tracking-tight">Work Queue</h1>
        <p className="text-small text-muted-foreground">
          Every page that needs building or optimizing, across all dealers, by due date.
        </p>
      </div>
      <WorkQueue rows={rows} accountManagers={ams ?? []} />
    </div>
  )
}
