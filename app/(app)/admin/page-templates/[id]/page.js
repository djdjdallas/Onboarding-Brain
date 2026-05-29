import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { TemplateForm } from "@/components/admin/template-form"
import { Button } from "@/components/ui/button"

const CADENCE_ORDER = { High: 0, Medium: 1, Low: 2 }

export default async function EditTemplatePage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: template }, { data: flags }, { data: cadences }, { count }] =
    await Promise.all([
      supabase.from("page_templates").select("*").eq("id", id).single(),
      supabase.from("eligibility_flag_types").select("key, label").order("sort_order"),
      supabase.from("cadence_rules").select("cadence_key"),
      supabase.from("pages").select("id", { count: "exact", head: true }).eq("template_id", id),
    ])

  if (!template) notFound()

  const cadenceOptions = (cadences ?? [])
    .map((c) => c.cadence_key)
    .sort((a, b) => (CADENCE_ORDER[a] ?? 9) - (CADENCE_ORDER[b] ?? 9))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">{template.page_type}</h2>
          <p className="text-sm text-muted-foreground">Edit template · {count ?? 0} pages use it</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/page-templates">Back</Link>
        </Button>
      </div>
      <TemplateForm
        template={template}
        flagOptions={flags ?? []}
        cadenceOptions={cadenceOptions}
        pageUsage={count ?? 0}
      />
    </div>
  )
}
