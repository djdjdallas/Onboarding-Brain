/**
 * Seed eligibility_flag_types — the labeled, grouped, sortable replacement for
 * V1's hardcoded flag keys. Keys match what V1's template gate_rules and the
 * onboarding wizard used, so migrate-v1-to-v2 can backfill eligibility rows.
 *
 *   node scripts/seed-eligibility-flag-types.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-eligibility-flag-types.mjs
 */
import { getServiceClient, DRY_RUN } from "./_supabase.mjs"

// [key, label, ui_group] in display order. sort_order is assigned by position.
const FLAGS = [
  ["service_department", "Service Department", "Departments"],
  ["parts_department", "Parts Department", "Departments"],
  ["collision_center", "Collision Center", "Departments"],
  ["express_service", "Express Service", "Departments"],

  ["new_inventory", "New Inventory", "Inventory"],
  ["used_inventory", "Used Inventory", "Inventory"],
  ["cpo_inventory", "CPO Inventory", "Inventory"],
  ["ev_hybrid_inventory", "EV / Hybrid Inventory", "Inventory"],
  ["commercial_fleet", "Commercial / Fleet", "Inventory"],
  ["service_loaners", "Service Loaners", "Inventory"],

  ["spanish_speakers", "Spanish Speakers", "Languages"],
  ["french_speakers", "French Speakers", "Languages"],
  ["mandarin_speakers", "Mandarin Speakers", "Languages"],

  ["bad_credit_financing", "Bad Credit Financing", "Programs"],
  ["credit_application", "Credit Application", "Programs"],
  ["value_your_trade", "Value Your Trade", "Programs"],
  ["warranty_protection", "Warranty / Protection Plans", "Programs"],
  ["community_involvement", "Community Involvement", "Programs"],

  ["education_conversion_support", "Education / Conversion Support", "Other"],
]

const rows = FLAGS.map(([key, label, ui_group], i) => ({
  key,
  label,
  ui_group,
  sort_order: i,
}))

async function main() {
  console.log(`${rows.length} eligibility flag types across groups:`)
  for (const g of ["Departments", "Inventory", "Languages", "Programs", "Other"]) {
    console.log(`  ${g}: ${rows.filter((r) => r.ui_group === g).map((r) => r.key).join(", ")}`)
  }

  if (DRY_RUN) {
    console.log("\n[--dry-run] Nothing written.\n")
    return
  }

  const supabase = await getServiceClient()
  const { error } = await supabase
    .from("eligibility_flag_types")
    .upsert(rows, { onConflict: "key" })
  if (error) {
    console.error("\nUpsert failed:", error.message, "\n")
    process.exit(1)
  }
  console.log(`\n✓ Upserted ${rows.length} eligibility_flag_types.\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
