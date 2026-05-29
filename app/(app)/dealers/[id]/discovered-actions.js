"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getActorId } from "@/lib/audit"

function priorityScore({ base, modelMod, pmaMod }) {
  let s = Number(base) || 0
  if (modelMod != null) s *= Number(modelMod)
  if (pmaMod != null) s *= Number(pmaMod)
  return Math.round(s * 10000) / 10000
}

/** Turn a discovered URL into a planned Page (status LIVE) and mark it accepted. */
export async function acceptDiscoveredPage(dealerId, discoveredId, { templateId, model, pma_city }) {
  if (!templateId) return { error: "Pick a template." }
  const supabase = await createClient()

  const { data: dp } = await supabase
    .from("discovered_pages")
    .select("url")
    .eq("id", discoveredId)
    .single()
  if (!dp) return { error: "Discovered page not found." }

  const { data: tpl } = await supabase
    .from("page_templates")
    .select("base_priority")
    .eq("id", templateId)
    .single()

  const [{ data: pma }, { data: md }] = await Promise.all([
    pma_city
      ? supabase.from("pmas").select("mod_score").eq("dealer_id", dealerId).eq("city", pma_city).maybeSingle()
      : Promise.resolve({ data: null }),
    model
      ? supabase.from("priority_models").select("mod_score").eq("dealer_id", dealerId).eq("model", model).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const { data: page, error: insErr } = await supabase
    .from("pages")
    .insert({
      dealer_id: dealerId,
      template_id: templateId,
      model: model || null,
      pma_city: pma_city || null,
      status: "LIVE",
      next_step: "Optimize",
      url: dp.url,
      priority_score: priorityScore({
        base: tpl?.base_priority,
        modelMod: md?.mod_score ?? null,
        pmaMod: pma?.mod_score ?? null,
      }),
    })
    .select("id")
    .single()
  if (insErr || !page) return { error: insErr?.message ?? "Could not create page." }

  const { error } = await supabase
    .from("discovered_pages")
    .update({
      status: "accepted",
      accepted_as_page_id: page.id,
      reviewed_by: await getActorId(supabase),
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", discoveredId)
  if (error) return { error: error.message }

  revalidatePath(`/dealers/${dealerId}`)
  return { ok: true }
}

async function review(supabase, discoveredId, patch) {
  return supabase
    .from("discovered_pages")
    .update({ ...patch, reviewed_by: await getActorId(supabase), reviewed_at: new Date().toISOString() })
    .eq("id", discoveredId)
}

export async function dismissDiscoveredPage(dealerId, discoveredId) {
  const supabase = await createClient()
  const { error } = await review(supabase, discoveredId, { status: "dismissed" })
  if (error) return { error: error.message }
  revalidatePath(`/dealers/${dealerId}`)
  return { ok: true }
}

export async function flagDiscoveredPage(dealerId, discoveredId, notes) {
  const supabase = await createClient()
  const { error } = await review(supabase, discoveredId, {
    status: "flagged",
    notes: String(notes || "").trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath(`/dealers/${dealerId}`)
  return { ok: true }
}

export async function bulkDismissDiscovered(dealerId, ids) {
  if (!ids?.length) return { ok: true }
  const supabase = await createClient()
  const { error } = await supabase
    .from("discovered_pages")
    .update({
      status: "dismissed",
      reviewed_by: await getActorId(supabase),
      reviewed_at: new Date().toISOString(),
    })
    .in("id", ids)
  if (error) return { error: error.message }
  revalidatePath(`/dealers/${dealerId}`)
  return { ok: true }
}
