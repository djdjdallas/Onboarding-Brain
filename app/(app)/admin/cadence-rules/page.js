import { createClient } from "@/lib/supabase/server"
import { ReferenceEditor } from "@/components/admin/reference-editor"
import { updateCadenceRule } from "./actions"

const FIELDS = [
  { name: "default_review_months", label: "Review every (months)", type: "int" },
  { name: "when_to_use", label: "When to use", type: "textarea" },
  { name: "typical_examples", label: "Typical examples", type: "textarea" },
  { name: "due_date_behavior", label: "Due-date behavior", type: "textarea" },
  { name: "override_guidance", label: "Override guidance", type: "textarea" },
  { name: "risks_notes", label: "Risks / notes", type: "textarea" },
]

const ORDER = { High: 0, Medium: 1, Low: 2 }

export default async function CadenceRulesPage() {
  const supabase = await createClient()

  const [{ data: rules }, { data: templates }, { data: pages }] = await Promise.all([
    supabase.from("cadence_rules").select("*"),
    supabase.from("page_templates").select("id, cadence"),
    supabase.from("pages").select("template_id"),
  ])

  // Pages affected per cadence (via their template's cadence).
  const cadenceByTemplate = new Map((templates ?? []).map((t) => [t.id, t.cadence]))
  const pageCount = {}
  for (const p of pages ?? []) {
    const c = cadenceByTemplate.get(p.template_id)
    if (c) pageCount[c] = (pageCount[c] ?? 0) + 1
  }

  const items = (rules ?? [])
    .map((r) => ({ ...r, _badge: `${pageCount[r.cadence_key] ?? 0} pages` }))
    .sort((a, b) => (ORDER[a.cadence_key] ?? 9) - (ORDER[b.cadence_key] ?? 9))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Cadence Rules</h2>
        <p className="text-sm text-muted-foreground">
          How often each cadence tier is reviewed. Drives the V2.1 auto-scheduler.
        </p>
      </div>
      <ReferenceEditor
        items={items}
        titleField="cadence_key"
        fields={FIELDS}
        action={updateCadenceRule}
      />
    </div>
  )
}
