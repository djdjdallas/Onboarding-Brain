"use server"

import { revalidatePath } from "next/cache"
import Papa from "papaparse"

import { createClient } from "@/lib/supabase/server"
import { normalizeUrl } from "@/lib/auditor"

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "")
const numOf = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[%,]/g, ""))
  return Number.isFinite(n) ? n : null
}

/**
 * Import a Google Search Console "Pages" CSV export and attach metrics to the
 * dealer's pages by URL. Columns are matched by normalized header name.
 * Returns { imported, unmatched } or { error }.
 */
export async function importDealerMetrics(dealerId, csvText) {
  if (!String(csvText || "").trim()) return { error: "Paste a GSC CSV export." }
  const supabase = await createClient()

  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: "greedy" })
  const headers = data.length ? Object.keys(data[0]) : []
  const find = (hints) => headers.find((h) => hints.some((x) => norm(h).includes(x)))
  const urlH = find(["toppages", "page", "url", "landingpage", "address"])
  const clicksH = find(["clicks"])
  const imprH = find(["impressions"])
  const ctrH = find(["ctr"])
  const posH = find(["position"])
  if (!urlH) return { error: `Couldn't find a page/URL column. Headers: ${headers.join(", ")}` }

  // Map dealer pages by normalized URL.
  const { data: pages } = await supabase
    .from("pages")
    .select("id, url")
    .eq("dealer_id", dealerId)
    .not("url", "is", null)
  const pageByUrl = new Map((pages ?? []).map((p) => [normalizeUrl(p.url), p.id]))

  const today = new Date().toISOString().slice(0, 10)
  const rows = []
  let unmatched = 0
  for (const r of data) {
    const url = r[urlH]
    if (!url) continue
    const pageId = pageByUrl.get(normalizeUrl(url))
    if (!pageId) {
      unmatched++
      continue
    }
    rows.push({
      page_id: pageId,
      captured_at: today,
      clicks: clicksH ? Math.round(numOf(r[clicksH]) ?? 0) : null,
      impressions: imprH ? Math.round(numOf(r[imprH]) ?? 0) : null,
      ctr: ctrH ? numOf(r[ctrH]) : null,
      avg_position: posH ? numOf(r[posH]) : null,
      source: "gsc_csv",
    })
  }

  if (rows.length) {
    const { error } = await supabase.from("page_metrics").insert(rows)
    if (error) return { error: error.message }
  }

  revalidatePath(`/dealers/${dealerId}`)
  return { ok: true, imported: rows.length, unmatched }
}
