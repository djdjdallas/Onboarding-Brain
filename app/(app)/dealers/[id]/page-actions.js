"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { recordAudit, getActorId } from "@/lib/audit"
import { recomputeScores } from "@/lib/dealer-recalc"
import { markReviewed } from "@/lib/scheduler"
import { generateSubtasksForPage } from "@/lib/subtasks"
import { isLlmConfigured, draftPageContent } from "@/lib/llm"
import { pageLabel } from "@/lib/jira-export"
import { humanizeFlag } from "@/lib/eligibility"

/** Draft page content with Claude. Credential-gated; returns { draft } or { error }. */
export async function draftPageContentAction(dealerId, pageId) {
  if (!isLlmConfigured()) {
    return { error: "AI drafting isn't configured. Set ANTHROPIC_API_KEY (see Settings)." }
  }
  const supabase = await createClient()

  const { data: page } = await supabase
    .from("pages")
    .select(
      "id, model, pma_city, page_templates(page_type, page_intent, required_inputs, guardrail)"
    )
    .eq("id", pageId)
    .single()
  if (!page) return { error: "Page not found." }

  const [{ data: dealer }, { data: elig }] = await Promise.all([
    supabase.from("dealers").select("name, website, address").eq("id", dealerId).single(),
    supabase
      .from("eligibility")
      .select("flag_key, eligibility_flag_types(label)")
      .eq("dealer_id", dealerId)
      .eq("flag_value", true),
  ])

  const flags = (elig ?? [])
    .map((e) => e.eligibility_flag_types?.label ?? humanizeFlag(e.flag_key))
    .join(", ")
  const factSheet = [
    dealer?.website ? `Website: ${dealer.website}` : null,
    dealer?.address ? `Address: ${dealer.address}` : null,
    flags ? `Programs/eligibility: ${flags}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const tpl = page.page_templates ?? {}
  try {
    const draft = await draftPageContent({
      dealerName: dealer?.name ?? "the dealer",
      pageLabel: pageLabel({ page_type: tpl.page_type, model: page.model, pma_city: page.pma_city }),
      model: page.model,
      pmaCity: page.pma_city,
      intent: tpl.page_intent,
      requiredInputs: tpl.required_inputs,
      guardrail: tpl.guardrail,
      factSheet,
    })
    return { ok: true, draft }
  } catch (e) {
    return { error: String(e?.message ?? e) }
  }
}

/** Manually (re)generate subtasks for a page from subtask_types. */
export async function generatePageSubtasks(dealerId, pageId) {
  const supabase = await createClient()
  const n = await generateSubtasksForPage(supabase, pageId)
  revalidatePath(`/dealers/${dealerId}/pages/${pageId}`)
  return { ok: true, created: n }
}

/** Update a subtask's status. */
export async function setSubtaskStatus(dealerId, pageId, subtaskId, status) {
  if (!["open", "in_progress", "done"].includes(status)) return { error: "Invalid status." }
  const supabase = await createClient()
  const { error } = await supabase.from("subtasks").update({ status }).eq("id", subtaskId)
  if (error) return { error: error.message }
  revalidatePath(`/dealers/${dealerId}/pages/${pageId}`)
  return { ok: true }
}

/** Mark a page reviewed today; cadence sets its next due date. Audited. */
export async function markPageReviewed(dealerId, pageId) {
  const supabase = await createClient()
  const res = await markReviewed(supabase, pageId)
  if (res?.error) return { error: res.error }
  await recordAudit(supabase, {
    entityType: "page",
    entityId: pageId,
    actorId: await getActorId(supabase),
    changes: [{ field: "last_reviewed_at", old: null, new: res.last_reviewed_at }],
  })
  revalidatePath(`/dealers/${dealerId}`)
  revalidatePath(`/dealers/${dealerId}/pages/${pageId}`)
  return { ok: true, ...res }
}

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

  // When a page first moves to Optimize, generate its subtasks.
  if (clean.next_step === "Optimize" && page.next_step !== "Optimize") {
    await generateSubtasksForPage(supabase, pageId)
  }

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
