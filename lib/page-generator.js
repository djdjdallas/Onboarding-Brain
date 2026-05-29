import { addMonths, endOfMonth, format } from "date-fns"

/**
 * Page generator
 * ==============
 * Expands the OEM-agnostic page_templates into a dealer's concrete page plan.
 * Everything here is a PURE function of its inputs (no DB, no Date.now) so it's
 * unit-testable and deterministic — the caller passes `campaignStart`.
 *
 * Pipeline (see generatePages):
 *   1. expand   — templates -> rows, applying gate rules and model/PMA fan-out
 *   2. status   — LIVE (a seed URL matched) or MISSING; gate-ineligible
 *                 Core/Required pages become Backlog
 *   3. score    — base_priority x model.mod_score x pma.mod_score x (1.1 if MISSING)
 *   4. schedule — split into build (MISSING) and optimize (LIVE) queues, bucket
 *                 into months by tier capacity; overflow past 12 months -> Backlog
 *   5. next_step — LIVE->Optimize, MISSING->Build, Backlog->Backlog
 */

// Gate-ineligible pages in these families are kept as Backlog (the agency still
// tracks them); ineligible pages in any other family are dropped entirely.
const BACKLOG_FAMILIES = new Set(["Core", "Required Page"])

// Monthly throughput per package tier (per Package_Assumptions).
export const TIER_CAPACITY = {
  Elite: { builds: 2, optimizes: 4 },
  Advanced: { builds: 1, optimizes: 3 },
  Essential: { builds: 0, optimizes: 2 },
}

const SCHEDULE_HORIZON_MONTHS = 12

// Tokens that carry no matching signal when comparing a page to a URL.
const STOP_TOKENS = new Set([
  "page", "the", "in", "pma", "near", "model", "and", "of", "a", "kia",
  "dealership", "dealer", "vehicle", "vehicles", "car", "cars",
])

/** True if every gate flag is enabled for the dealer. Empty gate => applies to all. */
export function isEligible(gateRules, flags) {
  if (!Array.isArray(gateRules) || gateRules.length === 0) return true
  return gateRules.every((key) => flags?.[key] === true)
}

/**
 * For per-model PMA templates the model is baked into the page_type
 * ("K5 PMA Local"). Returns that model name if `page_type` is one, else null.
 * `knownModels` is the full OEM model list (so we recognize models the dealer
 * didn't necessarily prioritize).
 */
export function extractBakedModel(pageType, knownModels) {
  const m = /^(.+)\s+PMA Local$/i.exec(pageType ?? "")
  if (!m) return null
  const candidate = m[1].trim()
  return knownModels.find((k) => k.toLowerCase() === candidate.toLowerCase()) ?? null
}

/** base x model.mod_score x pma.mod_score x (1.1 if MISSING). */
export function computePriorityScore({ base, modelMod, pmaMod, missing }) {
  let score = Number(base) || 0
  if (modelMod != null) score *= Number(modelMod)
  if (pmaMod != null) score *= Number(pmaMod)
  if (missing) score *= 1.1
  return Math.round(score * 10000) / 10000
}

function normalizeUrl(u) {
  return String(u || "").trim().replace(/\s+/g, "")
}

function urlPath(u) {
  try {
    return new URL(u).pathname.toLowerCase()
  } catch {
    // Not a full URL — treat the whole thing as a path-ish string.
    return String(u).toLowerCase()
  }
}

function isRootUrl(u) {
  const p = urlPath(u)
  return p === "" || p === "/"
}

function pageTokens(page) {
  const text = [page._pageType, page.model, page.pma_city].filter(Boolean).join(" ")
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP_TOKENS.has(t))
}

/** Fraction of a page's tokens that appear in the URL path (0..1). */
function matchScore(tokens, url) {
  if (tokens.length === 0) return 0
  const path = urlPath(url)
  const hits = tokens.filter((t) => path.includes(t)).length
  return hits / tokens.length
}

/**
 * Assigns seed URLs to pages (best-effort, conservative). The homepage gets the
 * site root; every other URL is matched to its best page by token overlap above
 * a high threshold so we don't mislabel. Matched pages become LIVE; the rest
 * stay MISSING. Each URL is used at most once.
 */
function applyUrlMatches(pages, urls) {
  const candidates = pages.filter((p) => !p.forcedBacklog)
  for (const p of candidates) {
    p.status = "MISSING"
    p.url = null
  }
  for (const p of pages) {
    if (p.forcedBacklog) {
      p.status = "Backlog"
      p.url = null
    }
  }

  const normUrls = urls.map(normalizeUrl).filter(Boolean)
  const used = new Set()

  // Homepage special case: the site root is the Home Page.
  const root = normUrls.find((u) => isRootUrl(u))
  if (root) {
    const home = candidates.find((p) => /^home/i.test(p._pageType ?? ""))
    if (home) {
      home.status = "LIVE"
      home.url = root
      used.add(root)
    }
  }

  const MATCH_THRESHOLD = 0.6
  for (const p of candidates) {
    if (p.status === "LIVE") continue
    const tokens = pageTokens(p)
    let best = null
    let bestScore = 0
    for (const u of normUrls) {
      if (used.has(u)) continue
      const s = matchScore(tokens, u)
      if (s > bestScore) {
        bestScore = s
        best = u
      }
    }
    if (best && bestScore >= MATCH_THRESHOLD) {
      p.status = "LIVE"
      p.url = best
      used.add(best)
    }
  }
}

/**
 * Buckets a queue into months. Sorted by priority desc, `perMonth` items land
 * in each successive month (due_date = that month's last day). Anything past the
 * horizon — or everything, if perMonth is 0 — becomes Backlog with no due date.
 */
function scheduleQueue(queue, perMonth, campaignStart) {
  queue.sort((a, b) => b.priority_score - a.priority_score)

  if (!perMonth || perMonth <= 0) {
    for (const p of queue) {
      p.status = "Backlog"
      p.due_date = null
    }
    return
  }

  let i = 0
  for (let month = 0; month < SCHEDULE_HORIZON_MONTHS; month++) {
    const due = format(endOfMonth(addMonths(campaignStart, month)), "yyyy-MM-dd")
    for (let k = 0; k < perMonth && i < queue.length; k++, i++) {
      queue[i].due_date = due
    }
  }
  for (; i < queue.length; i++) {
    queue[i].status = "Backlog"
    queue[i].due_date = null
  }
}

const NEXT_STEP = { LIVE: "Optimize", MISSING: "Build", Backlog: "Backlog" }

export { NEXT_STEP, BACKLOG_FAMILIES }

/** Stable composite key for a generated page: template + model + PMA. */
export function comboKey(templateId, model, pmaCity) {
  return `${templateId}|${model ?? ""}|${pmaCity ?? ""}`
}

/**
 * Structural expansion used by the V2 recalc engine (no URL match / scheduling).
 * Returns every structurally-valid (template × model × PMA) combo for the
 * dealer's CURRENT models/pmas, tagged with eligibility and base score inputs.
 * Callers decide create vs backlog vs skip.
 *
 * @returns {Array<{template_id, page_type, page_family, model, pma_city,
 *   base_priority, modelMod, pmaMod, eligible, backlogFamily}>}
 */
export function expandDealerCombos({ templates, models, pmas, flags, knownModels = [] }) {
  const modelByName = new Map(models.map((m) => [m.model, m]))
  const out = []
  for (const t of templates) {
    const eligible = isEligible(t.gate_rules, flags)
    const baked = extractBakedModel(t.page_type, knownModels)

    let combos
    if (baked) {
      if (!modelByName.has(baked)) continue
      combos = pmas.map((pma) => ({ model: baked, pma }))
    } else if (t.requires_model && t.requires_pma) {
      combos = []
      for (const m of models) for (const pma of pmas) combos.push({ model: m.model, pma })
    } else if (t.requires_model) {
      combos = models.map((m) => ({ model: m.model, pma: null }))
    } else if (t.requires_pma) {
      combos = pmas.map((pma) => ({ model: null, pma }))
    } else {
      combos = [{ model: null, pma: null }]
    }

    for (const c of combos) {
      const modelRow = c.model ? modelByName.get(c.model) : null
      out.push({
        template_id: t.id,
        page_type: t.page_type,
        page_family: t.page_family,
        model: c.model ?? null,
        pma_city: c.pma?.city ?? null,
        base_priority: Number(t.base_priority) || 3,
        modelMod: modelRow ? Number(modelRow.mod_score) : null,
        pmaMod: c.pma ? Number(c.pma.mod_score) : null,
        eligible,
        backlogFamily: BACKLOG_FAMILIES.has(t.page_family),
      })
    }
  }
  return out
}

/**
 * @param {object}   input
 * @param {Array}    input.templates  page_templates rows for the dealer's OEM
 * @param {Array}    input.models     [{ model, mod_score }] in priority order
 * @param {Array}    input.pmas       [{ city, mod_score }]  in priority order
 * @param {object}   input.flags      { flag_key: boolean }
 * @param {string}   input.tier       'Essential' | 'Advanced' | 'Elite'
 * @param {string[]} input.urls       seed live URLs (optional)
 * @param {string[]} input.knownModels full OEM model list (for baked-model detection)
 * @param {Date}     input.campaignStart scheduling anchor
 * @returns {Array} DB-ready page rows (without dealer_id)
 */
export function generatePages({
  templates,
  models,
  pmas,
  flags,
  tier,
  urls = [],
  knownModels = [],
  campaignStart,
  capacity,
}) {
  const modelByName = new Map(models.map((m) => [m.model, m]))
  const pages = []

  for (const t of templates) {
    const eligible = isEligible(t.gate_rules, flags)
    if (!eligible && !BACKLOG_FAMILIES.has(t.page_family)) continue
    const forcedBacklog = !eligible

    const bakedModel = extractBakedModel(t.page_type, knownModels)

    // Build the (model, pma) combinations this template fans out to.
    let combos
    if (bakedModel) {
      // Per-model PMA template — only if the dealer prioritizes that model.
      if (!modelByName.has(bakedModel)) continue
      combos = pmas.map((pma) => ({ model: bakedModel, pma }))
    } else if (t.requires_model && t.requires_pma) {
      combos = []
      for (const m of models) for (const pma of pmas) combos.push({ model: m.model, pma })
    } else if (t.requires_model) {
      combos = models.map((m) => ({ model: m.model, pma: null }))
    } else if (t.requires_pma) {
      combos = pmas.map((pma) => ({ model: null, pma }))
    } else {
      combos = [{ model: null, pma: null }]
    }

    for (const c of combos) {
      const modelRow = c.model ? modelByName.get(c.model) : null
      pages.push({
        template_id: t.id,
        _pageType: t.page_type,
        model: c.model ?? null,
        pma_city: c.pma?.city ?? null,
        _base: Number(t.base_priority) || 3.0,
        _modelMod: modelRow?.mod_score ?? null,
        _pmaMod: c.pma?.mod_score ?? null,
        forcedBacklog,
        status: null,
        url: null,
        due_date: null,
      })
    }
  }

  // Status + URL seeding.
  applyUrlMatches(pages, urls)

  // Priority score (uses status for the MISSING boost).
  for (const p of pages) {
    p.priority_score = computePriorityScore({
      base: p._base,
      modelMod: p._modelMod,
      pmaMod: p._pmaMod,
      missing: p.status === "MISSING",
    })
  }

  // Schedule build (MISSING) and optimize (LIVE) queues independently.
  const cap = capacity?.[tier] ?? TIER_CAPACITY[tier] ?? TIER_CAPACITY.Essential
  scheduleQueue(pages.filter((p) => p.status === "MISSING"), cap.builds, campaignStart)
  scheduleQueue(pages.filter((p) => p.status === "LIVE"), cap.optimizes, campaignStart)

  for (const p of pages) p.next_step = NEXT_STEP[p.status] ?? null

  // Strip internal fields -> DB-ready rows.
  return pages.map((p) => ({
    template_id: p.template_id,
    model: p.model,
    pma_city: p.pma_city,
    status: p.status,
    next_step: p.next_step,
    url: p.url,
    priority_score: p.priority_score,
    due_date: p.due_date,
  }))
}
