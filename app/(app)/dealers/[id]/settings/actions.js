"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { recordAudit, getActorId } from "@/lib/audit"
import {
  recomputeScores,
  reconcileStructure,
  applyEligibility,
  previewEligibility,
} from "@/lib/dealer-recalc"

function revalidateDealer(id) {
  revalidatePath(`/dealers/${id}`)
  revalidatePath(`/dealers/${id}/settings`)
  revalidatePath("/")
}

// --- Info --------------------------------------------------------------------
export async function saveDealerInfo(dealerId, input) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("dealers")
    .select("name, website, address, am_id, package_tier, package_tier_id, service_start_month")
    .eq("id", dealerId)
    .single()
  if (!existing) return { error: "Dealer not found." }

  // package tier: keep both the FK and the legacy text name in sync.
  let package_tier = existing.package_tier
  if (input.package_tier_id) {
    const { data: tier } = await supabase
      .from("package_tiers")
      .select("name")
      .eq("id", input.package_tier_id)
      .single()
    if (tier) package_tier = tier.name
  }

  const patch = {
    name: String(input.name || "").trim(),
    website: input.website?.trim() || null,
    address: input.address?.trim() || null,
    am_id: input.am_id || null,
    package_tier_id: input.package_tier_id || null,
    package_tier,
    service_start_month: input.service_start_month || null,
  }
  if (!patch.name) return { error: "Name is required." }

  const { error } = await supabase.from("dealers").update(patch).eq("id", dealerId)
  if (error) return { error: error.message }

  await recordAudit(supabase, {
    entityType: "dealer",
    entityId: dealerId,
    actorId: await getActorId(supabase),
    changes: Object.keys(patch).map((f) => ({ field: f, old: existing[f] ?? null, new: patch[f] ?? null })),
  })

  revalidateDealer(dealerId)
  return { ok: true }
}

// --- PMAs --------------------------------------------------------------------
export async function savePmas(dealerId, cities, primaryCity) {
  const list = (cities ?? []).map((c) => String(c).trim()).filter(Boolean)
  if (list.length === 0) return { error: "Add at least one PMA." }
  if (list.length > 9) return { error: "Up to 9 PMAs." }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("pmas")
    .select("id, city")
    .eq("dealer_id", dealerId)
  const byCity = new Map((existing ?? []).map((p) => [p.city.toLowerCase(), p]))

  // Remove cities no longer present (cascades their keyword_targets).
  const keepLower = new Set(list.map((c) => c.toLowerCase()))
  const removeIds = (existing ?? [])
    .filter((p) => !keepLower.has(p.city.toLowerCase()))
    .map((p) => p.id)
  for (const id of removeIds) await supabase.from("pmas").delete().eq("id", id)

  // Upsert order in place (no unique constraint after migration 0005).
  for (let i = 0; i < list.length; i++) {
    const found = byCity.get(list[i].toLowerCase())
    if (found) await supabase.from("pmas").update({ priority_order: i + 1 }).eq("id", found.id)
    else await supabase.from("pmas").insert({ dealer_id: dealerId, city: list[i], priority_order: i + 1 })
  }

  // Set primary PMA.
  const { data: refreshed } = await supabase
    .from("pmas")
    .select("id, city")
    .eq("dealer_id", dealerId)
  const primary = (refreshed ?? []).find(
    (p) => p.city.toLowerCase() === String(primaryCity || list[0]).toLowerCase()
  )
  await supabase.from("dealers").update({ primary_pma_id: primary?.id ?? null }).eq("id", dealerId)

  await reconcileStructure(supabase, dealerId)
  revalidateDealer(dealerId)
  return { ok: true }
}

// --- Models ------------------------------------------------------------------
export async function saveModels(dealerId, models) {
  const list = (models ?? [])
    .map((m) => ({ model: String(m.model).trim(), tracked: !!m.tracked }))
    .filter((m) => m.model)
  if (list.length === 0) return { error: "Add at least one model." }
  if (list.length > 9) return { error: "Up to 9 models." }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("priority_models")
    .select("id, model")
    .eq("dealer_id", dealerId)
  const byModel = new Map((existing ?? []).map((m) => [m.model.toLowerCase(), m]))

  const keepLower = new Set(list.map((m) => m.model.toLowerCase()))
  const removeIds = (existing ?? [])
    .filter((m) => !keepLower.has(m.model.toLowerCase()))
    .map((m) => m.id)
  for (const id of removeIds) await supabase.from("priority_models").delete().eq("id", id)

  for (let i = 0; i < list.length; i++) {
    const found = byModel.get(list[i].model.toLowerCase())
    if (found)
      await supabase
        .from("priority_models")
        .update({ priority_order: i + 1, tracked: list[i].tracked })
        .eq("id", found.id)
    else
      await supabase.from("priority_models").insert({
        dealer_id: dealerId,
        model: list[i].model,
        priority_order: i + 1,
        tracked: list[i].tracked,
      })
  }

  await reconcileStructure(supabase, dealerId)
  revalidateDealer(dealerId)
  return { ok: true }
}

// --- Eligibility -------------------------------------------------------------
export async function previewEligibilityChange(dealerId, newFlagMap) {
  const supabase = await createClient()
  return previewEligibility(supabase, dealerId, newFlagMap)
}

export async function saveEligibility(dealerId, newFlagMap) {
  const supabase = await createClient()
  const { data: types } = await supabase.from("eligibility_flag_types").select("id, key")
  const flagTypeIdByKey = Object.fromEntries((types ?? []).map((t) => [t.key, t.id]))
  const result = await applyEligibility(supabase, dealerId, newFlagMap, flagTypeIdByKey)
  revalidateDealer(dealerId)
  return { ok: true, ...result }
}

// --- Keyword targets ---------------------------------------------------------
export async function saveKeywordTargets(dealerId, cells) {
  if (!Array.isArray(cells) || cells.length === 0) return { ok: true }
  const supabase = await createClient()
  const rows = cells.map((c) => ({
    dealer_id: dealerId,
    keyword_id: c.keyword_id,
    pma_id: c.pma_id,
    is_targeted: !!c.is_targeted,
  }))
  const { error } = await supabase
    .from("keyword_targets")
    .upsert(rows, { onConflict: "dealer_id,keyword_id,pma_id" })
  if (error) return { error: error.message }
  revalidatePath(`/dealers/${dealerId}/settings`)
  return { ok: true }
}
