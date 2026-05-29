import {
  expandDealerCombos,
  comboKey,
  isEligible,
  NEXT_STEP,
} from "@/lib/page-generator"
import { KIA_MODELS } from "@/lib/eligibility"

/**
 * V2 dealer recalc engine (server-only; call from server actions).
 *
 * These operate SURGICALLY on existing pages — they never delete-and-recreate
 * the whole plan — so page IDs (and their audit_findings), URLs, notes, labels,
 * and manual adjustments survive edits:
 *
 *   recomputeScores    — re-score every page (after a PMA/model reorder)
 *   reconcileStructure — add pages for new PMAs/models, drop pages for removed
 *                        ones, then re-score (after PMA/model add/remove)
 *   applyEligibility    — flip flags, move newly-ineligible pages to Backlog,
 *                        restore/create newly-eligible ones
 *   previewEligibility  — counts for the pre-save warning, applies nothing
 */

const CHUNK = 25

function priorityScore({ base, modelMod, pmaMod, status, adj }) {
  let s = Number(base) || 0
  if (modelMod != null) s *= Number(modelMod)
  if (pmaMod != null) s *= Number(pmaMod)
  if (status === "MISSING") s *= 1.1
  s += Number(adj || 0)
  return Math.round(s * 10000) / 10000
}

async function chunked(items, fn) {
  for (let i = 0; i < items.length; i += CHUNK) {
    await Promise.all(items.slice(i, i + CHUNK).map(fn))
  }
}

async function loadConfig(supabase, dealerId) {
  const [{ data: elig }, { data: pmas }, { data: models }, { data: templates }] =
    await Promise.all([
      supabase.from("eligibility").select("flag_key, flag_value").eq("dealer_id", dealerId),
      supabase.from("pmas").select("city, mod_score").eq("dealer_id", dealerId),
      supabase.from("priority_models").select("model, mod_score").eq("dealer_id", dealerId),
      supabase
        .from("page_templates")
        .select("id, page_type, page_family, base_priority, requires_model, requires_pma, gate_rules")
        .eq("oem", "KIA"),
    ])
  const flags = Object.fromEntries((elig ?? []).map((e) => [e.flag_key, e.flag_value]))
  return {
    flags,
    pmas: (pmas ?? []).map((p) => ({ city: p.city, mod_score: Number(p.mod_score) })),
    models: (models ?? []).map((m) => ({ model: m.model, mod_score: Number(m.mod_score) })),
    templates: templates ?? [],
  }
}

/** Re-score all of a dealer's pages from current mod scores + manual adjustment. */
export async function recomputeScores(supabase, dealerId) {
  const { pmas, models } = await loadConfig(supabase, dealerId)
  const pmaMod = new Map(pmas.map((p) => [p.city, p.mod_score]))
  const modelMod = new Map(models.map((m) => [m.model, m.mod_score]))

  const { data: pages } = await supabase
    .from("pages")
    .select("id, model, pma_city, status, priority_score, manual_priority_adjustment, page_templates(base_priority)")
    .eq("dealer_id", dealerId)

  const updates = []
  for (const p of pages ?? []) {
    const next = priorityScore({
      base: p.page_templates?.base_priority,
      modelMod: p.model ? modelMod.get(p.model) ?? 1 : null,
      pmaMod: p.pma_city ? pmaMod.get(p.pma_city) ?? 1 : null,
      status: p.status,
      adj: p.manual_priority_adjustment,
    })
    if (next !== Number(p.priority_score)) updates.push({ id: p.id, priority_score: next })
  }
  await chunked(updates, (u) =>
    supabase.from("pages").update({ priority_score: u.priority_score }).eq("id", u.id)
  )
  return updates.length
}

/** After PMA/model add/remove: drop orphaned pages, create new combos, re-score. */
export async function reconcileStructure(supabase, dealerId) {
  const cfg = await loadConfig(supabase, dealerId)
  const cities = new Set(cfg.pmas.map((p) => p.city))
  const modelNames = new Set(cfg.models.map((m) => m.model))

  const { data: pages } = await supabase
    .from("pages")
    .select("id, template_id, model, pma_city, status")
    .eq("dealer_id", dealerId)

  // Drop pages whose PMA or model is no longer in the dealer's lists.
  const orphanIds = (pages ?? [])
    .filter((p) => (p.pma_city && !cities.has(p.pma_city)) || (p.model && !modelNames.has(p.model)))
    .map((p) => p.id)
  await chunked(
    orphanIds.map((id) => id),
    (id) => supabase.from("pages").delete().eq("id", id)
  )

  const surviving = (pages ?? []).filter((p) => !orphanIds.includes(p.id))
  const existingKeys = new Set(surviving.map((p) => comboKey(p.template_id, p.model, p.pma_city)))

  const combos = expandDealerCombos({ ...cfg, knownModels: KIA_MODELS })
  const desired = combos.filter((c) => c.eligible || c.backlogFamily)

  const inserts = []
  for (const c of desired) {
    const key = comboKey(c.template_id, c.model, c.pma_city)
    if (existingKeys.has(key)) continue
    const status = c.eligible ? "MISSING" : "Backlog"
    inserts.push({
      dealer_id: dealerId,
      template_id: c.template_id,
      model: c.model,
      pma_city: c.pma_city,
      status,
      next_step: NEXT_STEP[status],
      priority_score: priorityScore({
        base: c.base_priority,
        modelMod: c.modelMod,
        pmaMod: c.pmaMod,
        status,
        adj: 0,
      }),
    })
  }
  if (inserts.length) await supabase.from("pages").insert(inserts)

  await recomputeScores(supabase, dealerId)
  return { deleted: orphanIds.length, created: inserts.length }
}

/** Compute which templates flip eligibility given old + new flag maps. */
function eligibilityTransitions(templates, oldFlags, newFlags) {
  const becameIneligible = []
  const becameEligible = []
  for (const t of templates) {
    const was = isEligible(t.gate_rules, oldFlags)
    const now = isEligible(t.gate_rules, newFlags)
    if (was && !now) becameIneligible.push(t.id)
    else if (!was && now) becameEligible.push(t.id)
  }
  return { becameIneligible, becameEligible }
}

/** Preview the impact of a flag change without applying it. */
export async function previewEligibility(supabase, dealerId, newFlagMap) {
  const cfg = await loadConfig(supabase, dealerId)
  const newFlags = { ...cfg.flags, ...newFlagMap }
  const { becameIneligible, becameEligible } =
    eligibilityTransitions(cfg.templates, cfg.flags, newFlags)

  const { data: pages } = await supabase
    .from("pages")
    .select("template_id, status, model, pma_city")
    .eq("dealer_id", dealerId)

  const toBacklog = (pages ?? []).filter(
    (p) => becameIneligible.includes(p.template_id) && p.status !== "Backlog"
  ).length

  // Newly-eligible: existing backlog pages to restore + combos not present.
  const existingKeys = new Set(
    (pages ?? []).map((p) => comboKey(p.template_id, p.model, p.pma_city))
  )
  const combos = expandDealerCombos({ ...cfg, flags: newFlags, knownModels: KIA_MODELS })
  let toActivate = 0
  for (const c of combos) {
    if (!becameEligible.includes(c.template_id) || !c.eligible) continue
    if (!existingKeys.has(comboKey(c.template_id, c.model, c.pma_city))) toActivate++
  }
  const restore = (pages ?? []).filter(
    (p) => becameEligible.includes(p.template_id) && p.status === "Backlog"
  ).length

  return { toBacklog, toActivate: toActivate + restore }
}

/** Apply a flag change: write eligibility, transition pages, re-score. */
export async function applyEligibility(supabase, dealerId, newFlagMap, flagTypeIdByKey = {}) {
  const cfg = await loadConfig(supabase, dealerId)
  const newFlags = { ...cfg.flags, ...newFlagMap }

  // Upsert eligibility rows for the changed flags.
  const { data: existingRows } = await supabase
    .from("eligibility")
    .select("id, flag_key")
    .eq("dealer_id", dealerId)
  const rowByKey = new Map((existingRows ?? []).map((r) => [r.flag_key, r.id]))
  for (const [key, value] of Object.entries(newFlagMap)) {
    if (rowByKey.has(key)) {
      await supabase.from("eligibility").update({ flag_value: value }).eq("id", rowByKey.get(key))
    } else {
      await supabase.from("eligibility").insert({
        dealer_id: dealerId,
        flag_key: key,
        flag_value: value,
        eligibility_flag_type_id: flagTypeIdByKey[key] ?? null,
      })
    }
  }

  const { becameIneligible, becameEligible } =
    eligibilityTransitions(cfg.templates, cfg.flags, newFlags)

  // Move newly-ineligible pages to Backlog.
  if (becameIneligible.length) {
    await supabase
      .from("pages")
      .update({ status: "Backlog", next_step: "Backlog", due_date: null })
      .eq("dealer_id", dealerId)
      .in("template_id", becameIneligible)
      .neq("status", "Backlog")
  }

  // Restore newly-eligible Backlog pages, and create any missing combos.
  if (becameEligible.length) {
    await supabase
      .from("pages")
      .update({ status: "MISSING", next_step: "Build" })
      .eq("dealer_id", dealerId)
      .in("template_id", becameEligible)
      .eq("status", "Backlog")

    const { data: pages } = await supabase
      .from("pages")
      .select("template_id, model, pma_city")
      .eq("dealer_id", dealerId)
      .in("template_id", becameEligible)
    const existingKeys = new Set(
      (pages ?? []).map((p) => comboKey(p.template_id, p.model, p.pma_city))
    )
    const combos = expandDealerCombos({ ...cfg, flags: newFlags, knownModels: KIA_MODELS })
    const inserts = []
    for (const c of combos) {
      if (!becameEligible.includes(c.template_id) || !c.eligible) continue
      if (existingKeys.has(comboKey(c.template_id, c.model, c.pma_city))) continue
      inserts.push({
        dealer_id: dealerId,
        template_id: c.template_id,
        model: c.model,
        pma_city: c.pma_city,
        status: "MISSING",
        next_step: "Build",
        priority_score: priorityScore({
          base: c.base_priority,
          modelMod: c.modelMod,
          pmaMod: c.pmaMod,
          status: "MISSING",
          adj: 0,
        }),
      })
    }
    if (inserts.length) await supabase.from("pages").insert(inserts)
  }

  await recomputeScores(supabase, dealerId)
  return { backlogged: becameIneligible.length, activated: becameEligible.length }
}
