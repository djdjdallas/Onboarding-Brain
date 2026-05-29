/**
 * One-time cleanup of messy auto-slugged eligibility keys that came from verbose
 * values in the sheet's "Eligibility / Gate" column. Maps each slug to its clean
 * equivalent in BOTH places it lives:
 *   - page_templates.gate_rules (so templates gate on the canonical key)
 *   - eligibility rows (collapse the duplicate into the canonical row)
 *
 *   node --env-file=.env.local scripts/cleanup-gate-keys.mjs --dry-run
 *   node --env-file=.env.local scripts/cleanup-gate-keys.mjs
 *
 * Idempotent: re-running after a clean pass finds nothing to do.
 * Note: the canonical flag has the same value as the slug for the existing
 * dealer (both true), so page eligibility is unchanged — no regeneration needed.
 */
import { getServiceClient, DRY_RUN } from "./_supabase.mjs"

const ALIASES = {
  commercial_fleet_inventory: "commercial_fleet",
  warranty_protection_plans: "warranty_protection",
  use_if_client_wants_education_conversion_support: "education_conversion_support",
}

async function main() {
  const supabase = await getServiceClient()

  const { data: flagTypes } = await supabase
    .from("eligibility_flag_types")
    .select("id, key")
  const typeIdByKey = new Map((flagTypes ?? []).map((f) => [f.key, f.id]))

  // --- Templates: rewrite gate_rules ----------------------------------------
  const { data: templates } = await supabase
    .from("page_templates")
    .select("id, page_type, gate_rules")
  const templateUpdates = []
  for (const t of templates ?? []) {
    const rules = Array.isArray(t.gate_rules) ? t.gate_rules : []
    if (!rules.some((k) => ALIASES[k])) continue
    const next = [...new Set(rules.map((k) => ALIASES[k] ?? k))]
    templateUpdates.push({ id: t.id, page_type: t.page_type, gate_rules: next })
  }

  // --- Eligibility: collapse duplicates into the canonical row ---------------
  const { data: elig } = await supabase
    .from("eligibility")
    .select("id, dealer_id, flag_key, flag_value, eligibility_flag_type_id")
  const byDealerKey = new Map() // `${dealer}|${key}` -> row
  for (const e of elig ?? []) byDealerKey.set(`${e.dealer_id}|${e.flag_key}`, e)

  const eligRenames = [] // orphan -> canonical (no existing canonical row)
  const eligDeletes = [] // orphan removed (canonical row exists)
  const eligEnables = [] // set canonical row true because orphan was true
  for (const e of elig ?? []) {
    const canonical = ALIASES[e.flag_key]
    if (!canonical) continue
    const existing = byDealerKey.get(`${e.dealer_id}|${canonical}`)
    if (existing) {
      if (e.flag_value && !existing.flag_value) eligEnables.push(existing.id)
      eligDeletes.push({ id: e.id, from: e.flag_key, into: canonical })
    } else {
      eligRenames.push({
        id: e.id,
        from: e.flag_key,
        to: canonical,
        type_id: typeIdByKey.get(canonical) ?? null,
      })
    }
  }

  // --- Report ----------------------------------------------------------------
  console.log("\nGate-key cleanup plan:")
  console.log(`  Templates to rewrite gate_rules: ${templateUpdates.length}`)
  for (const t of templateUpdates) console.log(`    - ${t.page_type}: ${t.gate_rules.join(", ")}`)
  console.log(`  Eligibility rows to rename -> canonical: ${eligRenames.length}`)
  for (const r of eligRenames) console.log(`    - ${r.from} -> ${r.to}`)
  console.log(`  Eligibility duplicates to delete (canonical exists): ${eligDeletes.length}`)
  for (const d of eligDeletes) console.log(`    - ${d.from} (dupe of ${d.into})`)
  console.log(`  Canonical rows to enable (orphan was true): ${eligEnables.length}`)

  if (DRY_RUN) {
    console.log("\n[--dry-run] Nothing written.\n")
    return
  }

  for (const t of templateUpdates) {
    const { error } = await supabase
      .from("page_templates")
      .update({ gate_rules: t.gate_rules })
      .eq("id", t.id)
    if (error) console.error(`  ! template ${t.page_type}: ${error.message}`)
  }
  for (const id of eligEnables) {
    await supabase.from("eligibility").update({ flag_value: true }).eq("id", id)
  }
  for (const d of eligDeletes) {
    await supabase.from("eligibility").delete().eq("id", d.id)
  }
  for (const r of eligRenames) {
    const { error } = await supabase
      .from("eligibility")
      .update({ flag_key: r.to, eligibility_flag_type_id: r.type_id })
      .eq("id", r.id)
    if (error) console.error(`  ! eligibility ${r.from}: ${error.message}`)
  }

  console.log(
    `\n✓ Cleaned: ${templateUpdates.length} templates, ` +
      `${eligRenames.length} renamed, ${eligDeletes.length} merged.\n`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
