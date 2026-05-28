"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { dealerWizardSchema } from "@/lib/validation/dealer"

/**
 * Creates a dealer and its PMAs, priority models, and eligibility rows from the
 * onboarding wizard. Returns { error } on failure; redirects to the new dealer
 * on success. (Page generation from the templates happens in Step 7.)
 *
 * mod_score is a generated column — we only send priority_order (the array
 * index + 1), and the database computes the score.
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

  const results = await Promise.all([
    supabase.from("pmas").insert(pmas),
    supabase.from("priority_models").insert(models),
    supabase.from("eligibility").insert(eligibility),
  ])
  const childErr = results.find((r) => r.error)?.error
  if (childErr) {
    await supabase.from("dealers").delete().eq("id", dealer.id)
    return { error: `Could not save dealer details: ${childErr.message}` }
  }

  // TODO (Step 7): generate pages from page_templates here, seeding LIVE status
  // for any data.urls that match a generated page.

  revalidatePath("/")
  redirect(`/dealers/${dealer.id}`)
}
