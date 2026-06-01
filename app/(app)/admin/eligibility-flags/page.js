import { createClient } from "@/lib/supabase/server"
import { EligibilityFlagsTable } from "@/components/admin/eligibility-flags-table"

export default async function EligibilityFlagsPage() {
  const supabase = await createClient()

  const [{ data: flags }, { data: elig }] = await Promise.all([
    supabase
      .from("eligibility_flag_types")
      .select("id, key, label, description, ui_group, sort_order")
      .order("sort_order"),
    supabase.from("eligibility").select("flag_key, eligibility_flag_type_id"),
  ])

  // Usage = dealer eligibility rows referencing the flag by FK or legacy key.
  const usageById = {}
  const usageByKey = {}
  for (const e of elig ?? []) {
    if (e.eligibility_flag_type_id)
      usageById[e.eligibility_flag_type_id] = (usageById[e.eligibility_flag_type_id] ?? 0) + 1
    if (e.flag_key) usageByKey[e.flag_key] = (usageByKey[e.flag_key] ?? 0) + 1
  }
  const rows = (flags ?? []).map((f) => ({
    ...f,
    usage: (usageById[f.id] ?? 0) + (usageByKey[f.key] ?? 0),
  }))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-h1 font-medium">Eligibility Flags</h2>
        <p className="text-small text-muted-foreground">
          The flag types dealers toggle and templates gate on. Keys are stable; edit
          labels and grouping freely.
        </p>
      </div>
      <EligibilityFlagsTable flags={rows} />
    </div>
  )
}
