"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { dealerWizardSchema } from "@/lib/validation/dealer"
import { generatePages } from "@/lib/page-generator"
import { loadTierCapacity } from "@/lib/scheduler"
import { loadOemModels } from "@/lib/oem"

/**
 * Creates a dealer + its PMAs, priority models, and eligibility rows from the
 * onboarding wizard, then generates the full page plan from page_templates.
 * Returns { error } on failure; redirects to the new dealer on success.
 *
 * mod_score is a generated column — we only send priority_order (the array
 * index + 1) and read the computed score back for page scoring.
 */
export async function createDealer(input) {
  const parsed = dealerWizardSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid form data." }
  }
  const data = parsed.data
  const supabase = await createClient()

  // 1. Dealer
  const { data: dealer, error: dealerErr } = await supabase
    .from("dealers")
    .insert({
      name: data.name,
      oem: data.oem || "KIA",
      package_tier: data.package_tier,
      website: data.website || null,
      address: data.address || null,
      am_id: data.am_id || null,
    })
    .select("id")
    .single()

  if (dealerErr || !dealer) {
    return { error: dealerErr?.message ?? "Could not create the dealer." }
  }

  // 2. PMAs, models, eligibility. If any fail, roll back by deleting the dealer
  //    (cascade removes any children already written) so we don't orphan it.
  const pmas = data.pmas.map((p, i) => ({
    dealer_id: dealer.id,
    city: p.city,
    priority_order: i + 1,
  }))
  const models = data.models.map((m, i) => ({
    dealer_id: dealer.id,
    model: m.model,
    priority_order: i + 1,
  }))
  const eligibility = Object.entries(data.eligibility).map(
    ([flag_key, flag_value]) => ({
      dealer_id: dealer.id,
      flag_key,
      flag_value: !!flag_value,
    })
  )

  // Insert children. PMAs/models are read back with their generated mod_score
  // for page scoring.
  const [pmaRes, modelRes, eligRes] = await Promise.all([
    supabase.from("pmas").insert(pmas).select("city, mod_score, priority_order"),
    supabase
      .from("priority_models")
      .insert(models)
      .select("model, mod_score, priority_order"),
    supabase.from("eligibility").insert(eligibility),
  ])
  const childErr = [pmaRes, modelRes, eligRes].find((r) => r.error)?.error
  if (childErr) {
    await supabase.from("dealers").delete().eq("id", dealer.id)
    return { error: `Could not save dealer details: ${childErr.message}` }
  }

  // Generate the page plan from the OEM's templates.
  const { data: templates, error: tplErr } = await supabase
    .from("page_templates")
    .select(
      "id, page_type, page_family, base_priority, requires_model, requires_pma, gate_rules"
    )
    .eq("oem", data.oem || "KIA")
  if (tplErr || !templates?.length) {
    await supabase.from("dealers").delete().eq("id", dealer.id)
    return {
      error: tplErr
        ? `Could not load page templates: ${tplErr.message}`
        : "No page templates found — run the seed script first.",
    }
  }

  const byOrder = (a, b) => a.priority_order - b.priority_order
  const capacity = await loadTierCapacity(supabase)
  const knownModels = await loadOemModels(supabase, data.oem || "KIA")
  const pageRows = generatePages({
    templates,
    pmas: pmaRes.data
      .sort(byOrder)
      .map((p) => ({ city: p.city, mod_score: Number(p.mod_score) })),
    models: modelRes.data
      .sort(byOrder)
      .map((m) => ({ model: m.model, mod_score: Number(m.mod_score) })),
    flags: data.eligibility,
    tier: data.package_tier,
    urls: data.urls,
    knownModels,
    campaignStart: new Date(),
    capacity,
  }).map((row) => ({ ...row, dealer_id: dealer.id }))

  const { error: pagesErr } = await supabase.from("pages").insert(pageRows)
  if (pagesErr) {
    await supabase.from("dealers").delete().eq("id", dealer.id)
    return { error: `Could not generate pages: ${pagesErr.message}` }
  }

  revalidatePath("/")
  redirect(`/dealers/${dealer.id}`)
}
