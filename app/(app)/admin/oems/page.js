import { createClient } from "@/lib/supabase/server"
import { OemsManager } from "@/components/admin/oems-manager"

export default async function OemsPage() {
  const supabase = await createClient()
  const [{ data: oems }, { data: models }, { data: dealers }] = await Promise.all([
    supabase.from("oems").select("name, label").order("name"),
    supabase.from("oem_models").select("oem, model, sort_order").order("sort_order"),
    supabase.from("dealers").select("oem"),
  ])

  const modelsByOem = {}
  for (const m of models ?? []) (modelsByOem[m.oem] ??= []).push(m.model)
  const dealerCount = {}
  for (const d of dealers ?? []) if (d.oem) dealerCount[d.oem] = (dealerCount[d.oem] ?? 0) + 1

  const rows = (oems ?? []).map((o) => ({
    ...o,
    models: modelsByOem[o.name] ?? [],
    dealer_count: dealerCount[o.name] ?? 0,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">OEMs</h2>
        <p className="text-sm text-muted-foreground">
          Brands and their model lineups. Drives the onboarding wizard&apos;s OEM and
          model pickers. Seed page templates + keywords per OEM with the seed scripts.
        </p>
      </div>
      <OemsManager oems={rows} />
    </div>
  )
}
