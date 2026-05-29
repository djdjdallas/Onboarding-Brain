import { createClient } from "@/lib/supabase/server"
import { unionFlags, KIA_MODELS } from "@/lib/eligibility"
import { DealerWizard } from "@/components/wizard/dealer-wizard"

export const metadata = { title: "Add Dealer · SEO Page Manager" }

export default async function NewDealerPage() {
  const supabase = await createClient()

  const [{ data: accountManagers }, { data: templates }, { data: oems }, { data: oemModels }] =
    await Promise.all([
      supabase.from("account_managers").select("id, name").order("name"),
      supabase.from("page_templates").select("gate_rules"),
      supabase.from("oems").select("name, label").order("name"),
      supabase.from("oem_models").select("oem, model, sort_order").order("sort_order"),
    ])

  // Every flag_key referenced by a template gate, unioned with the canonical set.
  const flags = unionFlags((templates ?? []).map((t) => t.gate_rules))

  // OEM list + per-OEM model lineup (falls back to Kia if oems table unseeded).
  const oemList = oems?.length ? oems : [{ name: "KIA", label: "Kia" }]
  const modelsByOem = {}
  for (const m of oemModels ?? []) (modelsByOem[m.oem] ??= []).push(m.model)
  if (!modelsByOem.KIA) modelsByOem.KIA = KIA_MODELS

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Dealer</h1>
        <p className="text-muted-foreground">
          Onboard a new dealer in five steps.
        </p>
      </div>
      <DealerWizard
        accountManagers={accountManagers ?? []}
        flags={flags}
        oems={oemList}
        modelsByOem={modelsByOem}
      />
    </div>
  )
}
