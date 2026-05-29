import * as cheerio from "cheerio"

/**
 * URL auditor
 * ===========
 * Per-dealer audit: fetch the sitemap, check every LIVE page's URL, and record
 * findings. Network work is concurrency-limited (5) and each URL is wrapped in
 * try/catch so one bad page never fails the whole run.
 *
 * The pure helpers (normalizeUrl, parseSitemapLocs, checkTitleIntent) are
 * exported for unit testing; auditDealer orchestrates and talks to Supabase
 * (pass a SERVICE-ROLE client — the cron/manual trigger has no user session).
 */

const FETCH_TIMEOUT_MS = 10_000
const CONCURRENCY = 5
const MAX_DISCOVERED = 100
const USER_AGENT = "SEO-Page-Manager-Auditor/1.0 (+audit bot)"

// Light intent checks: if a page's type matches `match`, its <title> should
// contain something from `expect`, else we flag a title_mismatch. Kept narrow
// to avoid false positives.
const INTENT_RULES = [
  { key: "recall", match: /recall/i, expect: /recall|safety/i },
  { key: "collision", match: /collision/i, expect: /collision|body shop|repair/i },
  { key: "oil change", match: /oil change/i, expect: /oil change|oil|service/i },
  { key: "finance", match: /financ/i, expect: /financ|loan|credit/i },
  { key: "lease", match: /lease/i, expect: /lease|leasing/i },
  { key: "trade", match: /trade/i, expect: /trade|value|appraisal/i },
  { key: "parts", match: /parts/i, expect: /parts|accessories/i },
]

/** Canonical form for comparing URLs: drop protocol, leading www, trailing slash, lowercase. */
export function normalizeUrl(u) {
  if (!u) return ""
  let s = String(u).trim().toLowerCase()
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "")
  s = s.replace(/\/+$/, "")
  return s
}

/** Extract <loc> values from sitemap (or sitemap-index) XML. */
export function parseSitemapLocs(xml) {
  const $ = cheerio.load(xml, { xmlMode: true })
  const locs = []
  $("loc").each((_, el) => {
    const v = $(el).text().trim()
    if (v) locs.push(v)
  })
  const isIndex = $("sitemapindex").length > 0
  return { locs, isIndex }
}

/** Best-matching template for a discovered URL by token overlap, or null. */
export function suggestTemplate(url, templates) {
  let best = null
  let bestScore = 0
  for (const t of templates ?? []) {
    const tokens = String(t.page_type || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOP_TOKENS.has(w))
    if (!tokens.length) continue
    const path = (() => {
      try {
        return new URL(url).pathname.toLowerCase()
      } catch {
        return String(url).toLowerCase()
      }
    })()
    const hits = tokens.filter((w) => path.includes(w)).length
    const score = hits / tokens.length
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  return bestScore >= 0.5 ? { id: best.id, confidence: Math.round(bestScore * 100) / 100 } : null
}

/** Returns a title_mismatch detail object, or null if the title looks fine. */
export function checkTitleIntent(pageType, title) {
  if (!pageType || !title) return null
  for (const rule of INTENT_RULES) {
    if (rule.match.test(pageType) && !rule.expect.test(title)) {
      return { rule: rule.key, expected: rule.expect.source, title }
    }
  }
  return null
}

function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, {
    ...opts,
    signal: controller.signal,
    headers: { "User-Agent": USER_AGENT, ...(opts.headers || {}) },
    redirect: "follow",
  }).finally(() => clearTimeout(timer))
}

/** Run `fn` over items with a fixed worker pool. Never rejects (errors -> null). */
async function mapPool(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await fn(items[i], i)
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  )
  return results
}

/** Fetch and parse the dealer's sitemap into a Set of normalized URLs. */
async function loadSitemapSet(website) {
  if (!website) return new Set()
  let base
  try {
    base = new URL(website)
  } catch {
    return new Set()
  }

  async function fetchXml(path) {
    try {
      const res = await fetchWithTimeout(new URL(path, base).toString())
      if (!res.ok) return null
      return await res.text()
    } catch {
      return null
    }
  }

  let xml = await fetchXml("/sitemap.xml")
  if (!xml) xml = await fetchXml("/sitemap_index.xml")
  if (!xml) return new Set()

  const { locs, isIndex } = parseSitemapLocs(xml)
  const urls = new Set()

  if (isIndex) {
    // One level of expansion: each loc is a child sitemap.
    const childXmls = await mapPool(locs.slice(0, 25), CONCURRENCY, async (loc) => {
      try {
        const res = await fetchWithTimeout(loc)
        return res.ok ? await res.text() : null
      } catch {
        return null
      }
    })
    for (const childXml of childXmls) {
      if (!childXml) continue
      for (const u of parseSitemapLocs(childXml).locs) urls.add(normalizeUrl(u))
    }
  } else {
    for (const u of locs) urls.add(normalizeUrl(u))
  }
  return urls
}

/**
 * Audits one dealer end to end. Creates an audit_runs row, checks LIVE pages,
 * records findings, then completes the run and stamps pages.last_audited_at.
 *
 * @param {object} supabase  service-role Supabase client
 * @param {string} dealerId
 * @returns {Promise<{runId:string, pagesChecked:number, errorsFound:number}>}
 */
export async function auditDealer(supabase, dealerId) {
  const nowIso = new Date().toISOString()

  const { data: dealer, error: dealerErr } = await supabase
    .from("dealers")
    .select("id, website")
    .eq("id", dealerId)
    .single()
  if (dealerErr || !dealer) {
    throw new Error(`Dealer not found: ${dealerErr?.message ?? dealerId}`)
  }

  const { data: run, error: runErr } = await supabase
    .from("audit_runs")
    .insert({ dealer_id: dealerId, started_at: nowIso })
    .select("id")
    .single()
  if (runErr || !run) {
    throw new Error(`Could not start audit run: ${runErr?.message}`)
  }

  const { data: templates } = await supabase
    .from("page_templates")
    .select("id, page_type")
    .eq("oem", "KIA")

  const { data: pages } = await supabase
    .from("pages")
    .select("id, url, status, page_templates(page_type)")
    .eq("dealer_id", dealerId)

  const allPages = pages ?? []
  const livePages = allPages.filter((p) => p.status === "LIVE" && p.url)
  const plannedSet = new Set(
    allPages.map((p) => normalizeUrl(p.url)).filter(Boolean)
  )

  const sitemapSet = await loadSitemapSet(dealer.website)
  const findings = []

  // Check each LIVE page.
  await mapPool(livePages, CONCURRENCY, async (page) => {
    const pageType = page.page_templates?.page_type
    let res
    try {
      res = await fetchWithTimeout(page.url, { headers: { Accept: "text/html" } })
    } catch (e) {
      findings.push({
        page_id: page.id,
        finding_type: "broken_url",
        details: { url: page.url, error: e.name === "AbortError" ? "timeout" : "fetch_failed" },
      })
      return
    }

    if (!res.ok) {
      findings.push({
        page_id: page.id,
        finding_type: "broken_url",
        details: { url: page.url, status: res.status },
      })
      // A broken page can't be checked further.
      return
    }

    if (sitemapSet.size > 0 && !sitemapSet.has(normalizeUrl(page.url))) {
      findings.push({
        page_id: page.id,
        finding_type: "missing_from_sitemap",
        details: { url: page.url },
      })
    }

    // Title / H1 intent check.
    try {
      const html = await res.text()
      const $ = cheerio.load(html)
      const title = $("title").first().text().trim()
      const h1 = $("h1").first().text().trim()
      const mismatch = checkTitleIntent(pageType, title || h1)
      if (mismatch) {
        findings.push({
          page_id: page.id,
          finding_type: "title_mismatch",
          details: { url: page.url, page_type: pageType, title, h1, ...mismatch },
        })
      }
    } catch {
      // Body unreadable — not fatal; the URL itself resolved 2xx.
    }
  })

  // Sitemap URLs we don't have a planned page for. Recorded both as a finding
  // and in the discovered_pages workflow table (upsert preserves prior review
  // status — a previously dismissed URL re-found stays dismissed).
  let discovered = 0
  let discoveredTruncated = false
  const discoveredRows = []
  for (const url of sitemapSet) {
    if (plannedSet.has(url)) continue
    if (discovered >= MAX_DISCOVERED) {
      discoveredTruncated = true
      break
    }
    findings.push({ page_id: null, finding_type: "discovered_unplanned", details: { url } })
    const suggestion = suggestTemplate(url, templates)
    discoveredRows.push({
      dealer_id: dealerId,
      url,
      last_seen_at: nowIso,
      suggested_template_id: suggestion?.id ?? null,
      suggested_confidence: suggestion?.confidence ?? null,
    })
    discovered++
  }
  if (discoveredRows.length) {
    await supabase
      .from("discovered_pages")
      .upsert(discoveredRows, { onConflict: "dealer_id,url" })
  }

  // Persist findings.
  if (findings.length) {
    await supabase
      .from("audit_findings")
      .insert(findings.map((f) => ({ ...f, run_id: run.id })))
  }

  // Stamp checked pages.
  if (livePages.length) {
    await supabase
      .from("pages")
      .update({ last_audited_at: nowIso })
      .in(
        "id",
        livePages.map((p) => p.id)
      )
  }

  // Complete the run.
  await supabase
    .from("audit_runs")
    .update({
      completed_at: new Date().toISOString(),
      pages_checked: livePages.length,
      errors_found: findings.length,
    })
    .eq("id", run.id)

  return {
    runId: run.id,
    pagesChecked: livePages.length,
    errorsFound: findings.length,
    discoveredTruncated,
  }
}
