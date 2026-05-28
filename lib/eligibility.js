/**
 * Eligibility flags. These gate which page_templates become pages for a dealer.
 *
 * CANONICAL_FLAGS is the baseline set (from the onboarding deliverables). The
 * wizard ALSO unions in every distinct flag_key actually used in any template's
 * gate_rules — see getEligibilityFlags() — so a checkbox always exists for any
 * gate, even one added to the catalog later.
 */
export const CANONICAL_FLAGS = [
  "new_inventory",
  "used_inventory",
  "cpo_inventory",
  "service_department",
  "service_loaners",
  "parts_department",
  "collision_center",
  "bad_credit_financing",
  "credit_application",
  "value_your_trade",
  "commercial_fleet",
  "community_involvement",
  "spanish_speakers",
  "french_speakers",
  "mandarin_speakers",
]

// Acronyms / words that shouldn't be naively title-cased.
const LABEL_OVERRIDES = {
  cpo: "CPO",
  ev: "EV",
  srp: "SRP",
  oem: "OEM",
}

/** "bad_credit_financing" -> "Bad Credit Financing", "cpo_inventory" -> "CPO Inventory". */
export function humanizeFlag(key) {
  return key
    .split("_")
    .map((w) => LABEL_OVERRIDES[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Union of CANONICAL_FLAGS and every flag_key referenced by template gate_rules,
 * sorted by display label. `templateGateRules` is an array of jsonb arrays.
 */
export function unionFlags(templateGateRules = []) {
  const set = new Set(CANONICAL_FLAGS)
  for (const rules of templateGateRules) {
    if (Array.isArray(rules)) for (const k of rules) set.add(k)
  }
  return [...set].sort((a, b) => humanizeFlag(a).localeCompare(humanizeFlag(b)))
}

/** Kia priority models, in the agency's default priority order. */
export const KIA_MODELS = [
  "K5",
  "Sportage",
  "Seltos",
  "Sorento",
  "Carnival",
  "Telluride",
  "EV6",
  "EV9",
  "Niro",
]
