"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { pageTemplateSchema, PAGE_FAMILIES } from "@/lib/validation/page-template"
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/app/(app)/admin/page-templates/actions"
import { TagInput } from "@/components/admin/tag-input"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const BLANK = {
  page_type: "",
  page_family: "",
  cadence: "",
  base_priority: 3,
  requires_model: false,
  requires_pma: false,
  gate_rules: [],
  default_labels: [],
  page_intent: "",
  required_inputs: "",
  guardrail: "",
  stakeholder_notes: "",
  description_template: "",
  content_example_url: "",
  specifications_doc_url: "",
}

const TEXTAREAS = [
  ["page_intent", "Page intent / business use"],
  ["required_inputs", "Required inputs"],
  ["guardrail", "People-first guardrail"],
  ["stakeholder_notes", "Stakeholder notes"],
  ["description_template", "Description template (SEO brief)"],
]

export function TemplateForm({ template, cadenceOptions, flagOptions, pageUsage = 0 }) {
  const router = useRouter()
  const isEdit = !!template

  const form = useForm({
    resolver: zodResolver(pageTemplateSchema),
    defaultValues: template
      ? { ...BLANK, ...Object.fromEntries(Object.keys(BLANK).map((k) => [k, template[k] ?? BLANK[k]])) }
      : BLANK,
  })
  const { register, handleSubmit, watch, setValue, formState } = form

  const family = watch("page_family")
  const cadence = watch("cadence")
  const gateRules = watch("gate_rules")
  const requiresModel = watch("requires_model")
  const requiresPma = watch("requires_pma")

  function toggleGate(key) {
    setValue(
      "gate_rules",
      gateRules.includes(key) ? gateRules.filter((k) => k !== key) : [...gateRules, key]
    )
  }

  async function onSubmit(values) {
    const res = isEdit ? await updateTemplate(template.id, values) : await createTemplate(values)
    if (res?.error) return toast.error(res.error)
    toast.success(isEdit ? "Saved." : "Template created.")
    router.push("/admin/page-templates")
    router.refresh()
  }

  async function remove() {
    const res = await deleteTemplate(template.id)
    if (res?.error) return toast.error(res.error)
    toast.success("Template deleted.")
    router.push("/admin/page-templates")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid max-w-3xl gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="page_type">Page type</Label>
          <Input id="page_type" {...register("page_type")} />
          {formState.errors.page_type ? (
            <p className="text-tiny text-destructive">{formState.errors.page_type.message}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label>Family</Label>
          <Select value={family} onValueChange={(v) => setValue("page_family", v, { shouldValidate: true })}>
            <SelectTrigger>
              <SelectValue placeholder="Select family" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_FAMILIES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formState.errors.page_family ? (
            <p className="text-tiny text-destructive">{formState.errors.page_family.message}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label>Cadence</Label>
          <Select value={cadence || "none"} onValueChange={(v) => setValue("cadence", v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {cadenceOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="base_priority">Base priority</Label>
          <Input id="base_priority" type="number" step="0.1" {...register("base_priority")} />
        </div>

        <div className="flex items-end gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={requiresModel}
              onCheckedChange={(c) => setValue("requires_model", !!c)}
            />
            Requires model
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={requiresPma} onCheckedChange={(c) => setValue("requires_pma", !!c)} />
            Requires PMA
          </label>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Gate rules (all required to be eligible)</Label>
        <div className="flex flex-wrap gap-1.5">
          {flagOptions.length === 0 ? (
            <span className="text-small text-muted-foreground">No eligibility flags defined.</span>
          ) : (
            flagOptions.map((f) => {
              const on = gateRules.includes(f.key)
              return (
                <button key={f.key} type="button" onClick={() => toggleGate(f.key)}>
                  <Badge variant={on ? "default" : "outline"} className="cursor-pointer">
                    {f.label}
                  </Badge>
                </button>
              )
            })
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Empty = applies to all dealers.
        </p>
      </div>

      <div className="grid gap-2">
        <Label>Default labels</Label>
        <TagInput
          value={watch("default_labels")}
          onChange={(v) => setValue("default_labels", v)}
          placeholder="Add a Jira label and press Enter"
        />
      </div>

      {TEXTAREAS.map(([name, label]) => (
        <div key={name} className="grid gap-2">
          <Label htmlFor={name}>{label}</Label>
          <Textarea id={name} rows={name === "description_template" ? 6 : 2} {...register(name)} />
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="content_example_url">Content example URL</Label>
          <Input id="content_example_url" {...register("content_example_url")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="specifications_doc_url">Specifications doc URL</Label>
          <Input id="specifications_doc_url" {...register("specifications_doc_url")} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        {isEdit ? (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="ghost" className="text-destructive">
                Delete template
              </Button>
            }
            title={`Delete "${template.page_type}"?`}
            description={
              pageUsage > 0
                ? `This template is used by ${pageUsage} page(s). You'll need to delete or reassign those first.`
                : "No pages use this template. This can't be undone."
            }
            confirmLabel="Delete"
            confirmVariant="destructive"
            onConfirm={remove}
          />
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/page-templates")}>
            Cancel
          </Button>
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create template"}
          </Button>
        </div>
      </div>
    </form>
  )
}
