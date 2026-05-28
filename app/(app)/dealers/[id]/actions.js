"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { generatePages } from "@/lib/page-generator"
import { KIA_MODELS } from "@/lib/eligibility"

/**
 * (Re)generates a dealer's page plan from the current templates + dealer config.
 * Replaces any existing pages, but preserves known live URLs by feeding the
 * existing pages' URLs back in as seed URLs (so LIVE statuses survive a re-run).
 *
 * Used for dealers created before page generation existed, and for the Settings
 * "re-run generator" flow. Returns { count } or { error }.
 */
export async function regenerateDealerPages(dealerId) {
  const supabase = await createClient()

  const [{ data: dealer }, { data: pmas }, { data: models }, { data: elig }, { data: existing }] =
    await Promise.all([
      supabase.from("dealers").select("id, oem, package_tier").eq("id", dealerId).single(),
      supabase.from("pmas").select("city, mod_score, priority_order").eq("dealer_id", dealerId),
      supabase.from("priority_models").select("model, mod_score, priority_order").eq("dealer_id", dealerId),
      supabase.from("eligibility").select("flag_key, flag_value").eq("dealer_id", dealerId),
      supabase.from("pages").select("url").eq("dealer_id", dealerId).not("url", "is", null),
    ])

  if (!dealer) return { error: "Dealer not found." }

  const { data: templates, error: tplErr } = await supabase
    .from("page_templates")
    .select(
      "id, page_type, page_family, base_priority, requires_model, requires_pma, gate_rules"
    )
    .eq("oem", dealer.oem || "KIA")
  if (tplErr || !templates?.length) {
    return {
      error: tplErr
        ? `Could not load templates: ${tplErr.message}`
        : "No page templates found — run the seed script first.",
    }
  }

  const flags = Object.fromEntries((elig ?? []).map((e) => [e.flag_key, e.flag_value]))
  const byOrder = (a, b) => a.priority_order - b.priority_order

  const pageRows = generatePages({
    templates,
    pmas: (pmas ?? [])
      .sort(byOrder)
      .map((p) => ({ city: p.city, mod_score: Number(p.mod_score) })),
    models: (models ?? [])
      .sort(byOrder)
      .map((m) => ({ model: m.model, mod_score: Number(m.mod_score) })),
    flags,
    tier: dealer.package_tier,
    urls: (existing ?? []).map((p) => p.url),
    knownModels: KIA_MODELS,
    campaignStart: new Date(),
  }).map((row) => ({ ...row, dealer_id: dealerId }))

  // Replace existing pages.
  const { error: delErr } = await supabase.from("pages").delete().eq("dealer_id", dealerId)
  if (delErr) return { error: `Could not clear old pages: ${delErr.message}` }

  const { error: insErr } = await supabase.from("pages").insert(pageRows)
  if (insErr) return { error: `Could not insert pages: ${insErr.message}` }

  revalidatePath(`/dealers/${dealerId}`)
  revalidatePath("/")
  return { count: pageRows.length }
}
