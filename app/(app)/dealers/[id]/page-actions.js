"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { recordAudit, getActorId } from "@/lib/audit"
import { recomputeScores } from "@/lib/dealer-recalc"

const EDITABLE = new Set([
  "status",
  "url",
  "next_step",
  "manual_priority_adjustment",
  "manually_scheduled_due_date",
  "notes",
  "labels",
])

function priorityScore({ base, modelMod, pmaMod, status, adj }) {
  let s = Number(base) || 0
  if (modelMod != null) s *= Number(modelMod)
  if (pmaMod != null) s *= Number(pmaMod)
  if (status === "MISSING") s *= 1.1
  s += Number(adj || 0)
  return Math.round(s * 10000) / 10000
}

/**
 * Inline-edit a single page. Only whitelisted fields are written; status or
 * adjustment changes re-score that one page. Audited (entity_type 'page').
 * Returns { priority_score } so the client can update its optimistic row.
 */
export async function updatePageFields(pageId, patch) {
  const supabase = await createClient()

  const clean = {}
  for (const [k, v] of Object.entries(patch)) if (EDITABLE.has(k)) clean[k] = v
  if (Object.keys(clean).length === 0) return { error: "Nothing to update." }

  const { data: page } = await supabase
    .from("pages")
    .select(
      "id, dealer_id, model, pma_city, status, url, next_step, manual_priority_adjustment, manually_scheduled_due_date, notes, labels, page_templates(base_priority)"
    )
    .eq("id", pageId)
    .single()
  if (!page) return { error: "Page not found." }

  // Re-score if the inputs to the score changed.
  let nextScore
  if ("status" in clean || "manual_priority_adjustment" in clean) {
    const status = clean.status ?? page.status
    const adj = "manual_priority_adjustment" in clean ? clean.manual_priority_adjustment : page.manual_priority_adjustment
    const [{ data: pma }, { data: model }] = await Promise.all([
      page.pma_city
        ? supabase.from("pmas").select("mod_score").eq("dealer_id", page.dealer_id).eq("city", page.pma_city).maybeSingle()
        : Promise.resolve({ data: null }),
      page.model
        ? supabase.from("priority_models").select("mod_score").eq("dealer_id", page.dealer_id).eq("model", page.model).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    nextScore = priorityScore({
      base: page.page_templates?.base_priority,
      modelMod: model?.mod_score ?? null,
      pmaMod: pma?.mod_score ?? null,
      status,
      adj,
    })
    clean.priority_score = nextScore
  }

  const { error } = await supabase.from("pages").update(clean).eq("id", pageId)
  if (error) return { error: error.message }

  const changes = Object.keys(clean)
    .filter((f) => f !== "priority_score")
    .map((f) => ({ field: f, old: page[f] ?? null, new: clean[f] ?? null }))
  await recordAudit(supabase, {
    entityType: "page",
    entityId: pageId,
    actorId: await getActorId(supabase),
    changes,
  })

  revalidatePath(`/dealers/${page.dealer_id}`)
  return { ok: true, priority_score: nextScore }
}

/** Bulk: move selected pages to Backlog, then re-score the dealer. */
export async function bulkBacklogPages(dealerId, pageIds) {
  if (!pageIds?.length) return { ok: true }
  const supabase = await createClient()
  const { error } = await supabase
    .from("pages")
    .update({ status: "Backlog", next_step: "Backlog", due_date: null })
    .in("id", pageIds)
  if (error) return { error: error.message }
  await recomputeScores(supabase, dealerId)
  await recordAudit(supabase, {
    entityType: "dealer",
    entityId: dealerId,
    actorId: await getActorId(supabase),
    changes: [{ field: "bulk: backlog", old: null, new: `${pageIds.length} pages` }],
  })
  revalidatePath(`/dealers/${dealerId}`)
  return { ok: true }
}

/** Bulk: append a label to selected pages (de-duped per page). */
export async function bulkApplyLabel(dealerId, pageIds, label) {
  const tag = String(label || "").trim()
  if (!tag || !pageIds?.length) return { error: "Pick pages and enter a label." }
  const supabase = await createClient()
  const { data: pages } = await supabase.from("pages").select("id, labels").in("id", pageIds)
  for (const p of pages ?? []) {
    const labels = Array.isArray(p.labels) ? p.labels : []
    if (labels.includes(tag)) continue
    await supabase.from("pages").update({ labels: [...labels, tag] }).eq("id", p.id)
  }
  await recordAudit(supabase, {
    entityType: "dealer",
    entityId: dealerId,
    actorId: await getActorId(supabase),
    changes: [{ field: "bulk: label", old: null, new: `"${tag}" → ${pageIds.length} pages` }],
  })
  revalidatePath(`/dealers/${dealerId}`)
  return { ok: true }
}
