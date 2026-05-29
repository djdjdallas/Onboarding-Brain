import { KIA_MODELS } from "@/lib/eligibility"

/**
 * Model lineup for an OEM, from the oem_models table. Falls back to the Kia
 * constant if the table is empty/unseeded (keeps V1/V2 behavior intact).
 */
export async function loadOemModels(supabase, oem) {
  const { data } = await supabase
    .from("oem_models")
    .select("model, sort_order")
    .eq("oem", oem || "KIA")
    .order("sort_order")
  const models = (data ?? []).map((m) => m.model)
  if (models.length) return models
  return oem === "KIA" || !oem ? KIA_MODELS : []
}
