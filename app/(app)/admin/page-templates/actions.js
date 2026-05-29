"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { recordAudit, getActorId } from "@/lib/audit"
import {
  pageTemplateSchema,
  TEMPLATE_AUDIT_FIELDS,
} from "@/lib/validation/page-template"
import { nullifyBlanks } from "@/lib/validation/reference"

function parse(input) {
  const r = pageTemplateSchema.safeParse(input)
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input." }
  return { data: nullifyBlanks(r.data) }
}

export async function createTemplate(input) {
  const { data, error } = parse(input)
  if (error) return { error }
  const supabase = await createClient()
  const { data: row, error: insErr } = await supabase
    .from("page_templates")
    .insert({ ...data, oem: "KIA" })
    .select("id")
    .single()
  if (insErr || !row) return { error: insErr?.message ?? "Could not create template." }

  await recordAudit(supabase, {
    entityType: "page_template",
    entityId: row.id,
    actorId: await getActorId(supabase),
    changes: [{ field: "__created", old: null, new: { page_type: data.page_type } }],
  })

  revalidatePath("/admin/page-templates")
  return { ok: true, id: row.id }
}

export async function updateTemplate(id, input) {
  const { data, error } = parse(input)
  if (error) return { error }
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("page_templates")
    .select("*")
    .eq("id", id)
    .single()
  if (!existing) return { error: "Template not found." }

  const { error: updErr } = await supabase.from("page_templates").update(data).eq("id", id)
  if (updErr) return { error: updErr.message }

  const changes = TEMPLATE_AUDIT_FIELDS.map((f) => ({
    field: f,
    old: existing[f] ?? null,
    new: data[f] ?? null,
  }))
  await recordAudit(supabase, {
    entityType: "page_template",
    entityId: id,
    actorId: await getActorId(supabase),
    changes,
  })

  revalidatePath("/admin/page-templates")
  revalidatePath(`/admin/page-templates/${id}`)
  return { ok: true }
}

export async function deleteTemplate(id) {
  const supabase = await createClient()
  // pages.template_id has no cascade — a referenced template can't be deleted.
  const { count } = await supabase
    .from("pages")
    .select("id", { count: "exact", head: true })
    .eq("template_id", id)
  if ((count ?? 0) > 0) {
    return {
      error: `Used by ${count} page(s) across dealers. Delete or reassign those pages first.`,
    }
  }
  const { error } = await supabase.from("page_templates").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/page-templates")
  return { ok: true }
}
