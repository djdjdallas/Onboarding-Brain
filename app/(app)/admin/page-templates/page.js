import { createClient } from "@/lib/supabase/server"
import { PageTemplatesTable } from "@/components/admin/page-templates-table"

export default async function PageTemplatesPage() {
  const supabase = await createClient()
  const [{ data: templates }, { data: flags }] = await Promise.all([
    supabase
      .from("page_templates")
      .select("id, page_type, page_family, cadence, base_priority, requires_model, requires_pma, gate_rules")
      .order("page_family")
      .order("page_type"),
    supabase.from("eligibility_flag_types").select("key, label"),
  ])
  const flagLabels = Object.fromEntries((flags ?? []).map((f) => [f.key, f.label]))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-h1 font-medium">Page Templates</h2>
        <p className="text-small text-muted-foreground">
          The page catalog (replaces Main_Page_Library). Click a row to edit.
        </p>
      </div>
      <PageTemplatesTable templates={templates ?? []} flagLabels={flagLabels} />
    </div>
  )
}
