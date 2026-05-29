import { z } from "zod"

export const optText = z.string().trim().optional().or(z.literal(""))
// Empty string -> null; otherwise an integer.
export const optInt = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int().nullable()
)

export const cadenceRuleSchema = z.object({
  default_review_months: optInt,
  when_to_use: optText,
  typical_examples: optText,
  due_date_behavior: optText,
  override_guidance: optText,
  risks_notes: optText,
})

export const packageTierSchema = z.object({
  new_pages_per_month: optInt,
  new_pages_per_year: optInt,
  optimization_capacity_per_month: optInt,
  keyword_targeting_balance: optInt,
  primary_focus: optText,
  creation_rule: optText,
})

/** Coerce a parsed schema object's "" text values to null for DB storage. */
export function nullifyBlanks(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) out[k] = v === "" ? null : v
  return out
}
