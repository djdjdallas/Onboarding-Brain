import { createClient } from "@/lib/supabase/server"
import { unionFlags } from "@/lib/eligibility"
import { DealerWizard } from "@/components/wizard/dealer-wizard"

export const metadata = { title: "Add Dealer · SEO Page Manager" }

export default async function NewDealerPage() {
  const supabase = await createClient()

  // Account managers for the assignment dropdown.
  const { data: accountManagers } = await supabase
    .from("account_managers")
    .select("id, name")
    .order("name")

  // Every flag_key referenced by a template gate, unioned with the canonical
  // set — so the wizard always has a checkbox for anything that gates a page.
  const { data: templates } = await supabase
    .from("page_templates")
    .select("gate_rules")
  const flags = unionFlags((templates ?? []).map((t) => t.gate_rules))

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
      />
    </div>
  )
}
