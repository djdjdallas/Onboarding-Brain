import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { TemplateForm } from "@/components/admin/template-form"
import { Button } from "@/components/ui/button"

const CADENCE_ORDER = { High: 0, Medium: 1, Low: 2 }

export default async function NewTemplatePage() {
  const supabase = await createClient()
  const [{ data: flags }, { data: cadences }] = await Promise.all([
    supabase.from("eligibility_flag_types").select("key, label").order("sort_order"),
    supabase.from("cadence_rules").select("cadence_key"),
  ])
  const cadenceOptions = (cadences ?? [])
    .map((c) => c.cadence_key)
    .sort((a, b) => (CADENCE_ORDER[a] ?? 9) - (CADENCE_ORDER[b] ?? 9))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h1 font-medium">New template</h2>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/page-templates">Back</Link>
        </Button>
      </div>
      <TemplateForm template={null} flagOptions={flags ?? []} cadenceOptions={cadenceOptions} />
    </div>
  )
}
