import { createClient } from "@/lib/supabase/server"
import { ReferenceEditor } from "@/components/admin/reference-editor"
import { updatePackageTier } from "./actions"

const FIELDS = [
  { name: "new_pages_per_month", label: "New pages / month", type: "int" },
  { name: "new_pages_per_year", label: "New pages / year", type: "int" },
  { name: "optimization_capacity_per_month", label: "Optimizations / month", type: "int" },
  { name: "keyword_targeting_balance", label: "Keyword targeting balance", type: "int" },
  { name: "primary_focus", label: "Primary focus", type: "text" },
  { name: "creation_rule", label: "Creation rule", type: "textarea" },
]

const ORDER = { Essential: 0, Advanced: 1, Elite: 2 }

export default async function PackageTiersPage() {
  const supabase = await createClient()

  const [{ data: tiers }, { data: dealers }] = await Promise.all([
    supabase.from("package_tiers").select("*"),
    supabase.from("dealers").select("package_tier, package_tier_id"),
  ])

  // Dealers on each tier (prefer FK; fall back to legacy text for un-migrated rows).
  const countById = {}
  const countByName = {}
  for (const d of dealers ?? []) {
    if (d.package_tier_id) countById[d.package_tier_id] = (countById[d.package_tier_id] ?? 0) + 1
    else if (d.package_tier) countByName[d.package_tier] = (countByName[d.package_tier] ?? 0) + 1
  }

  const items = (tiers ?? [])
    .map((t) => {
      const n = (countById[t.id] ?? 0) + (countByName[t.name] ?? 0)
      return { ...t, _badge: `${n} dealer${n === 1 ? "" : "s"}` }
    })
    .sort((a, b) => (ORDER[a.name] ?? 9) - (ORDER[b.name] ?? 9))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-h1 font-medium">Package Tiers</h2>
        <p className="text-small text-muted-foreground">
          Capacity assumptions per tier. The page generator currently uses these
          build/optimize numbers for scheduling.
        </p>
      </div>
      <ReferenceEditor
        items={items}
        titleField="name"
        fields={FIELDS}
        action={updatePackageTier}
      />
    </div>
  )
}
