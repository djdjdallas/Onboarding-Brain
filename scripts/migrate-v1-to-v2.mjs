/**
 * Backfill V2.0 FK columns from existing V1 data. Idempotent — only fills
 * columns that are still NULL, and only INSERTS missing keyword targets, so it
 * never clobbers values you've since edited.
 *
 *   node --env-file=.env.local scripts/migrate-v1-to-v2.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-v1-to-v2.mjs
 *
 * (Dry run still reads the DB to compute the diff, so it needs --env-file too.)
 *
 * What it does:
 *   1. dealers.package_tier (text) -> package_tier_id  (match package_tiers.name)
 *   2. dealers.primary_pma_id      <- the dealer's priority_order = 1 PMA
 *   3. eligibility.flag_key        -> eligibility_flag_type_id  (match .key)
 *   4. keyword_targets             <- one row per dealer x keyword x PMA,
 *                                     is_targeted = true (preserves V1 behavior)
 */
import { getServiceClient, DRY_RUN } from "./_supabase.mjs"

async function main() {
  const supabase = await getServiceClient()

  // --- Lookups ---------------------------------------------------------------
  const [{ data: tiers }, { data: flagTypes }, { data: keywords }] =
    await Promise.all([
      supabase.from("package_tiers").select("id, name"),
      supabase.from("eligibility_flag_types").select("id, key"),
      supabase.from("keywords").select("id, oem"),
    ])
  const tierByName = new Map((tiers ?? []).map((t) => [t.name, t.id]))
  const flagTypeByKey = new Map((flagTypes ?? []).map((f) => [f.key, f.id]))

  if (!tiers?.length || !flagTypes?.length) {
    console.error(
      "\nReference tables look empty — run `npm run seed:all` before migrating.\n"
    )
    process.exit(1)
  }

  // --- 1 & 2. Dealers --------------------------------------------------------
  const { data: dealers } = await supabase
    .from("dealers")
    .select("id, name, oem, package_tier, package_tier_id, primary_pma_id")
  const { data: allPmas } = await supabase
    .from("pmas")
    .select("id, dealer_id, priority_order")

  const firstPmaByDealer = new Map()
  for (const p of allPmas ?? []) {
    if (p.priority_order === 1) firstPmaByDealer.set(p.dealer_id, p.id)
  }

  const dealerUpdates = []
  for (const d of dealers ?? []) {
    const patch = {}
    if (!d.package_tier_id && d.package_tier && tierByName.has(d.package_tier)) {
      patch.package_tier_id = tierByName.get(d.package_tier)
    }
    if (!d.primary_pma_id && firstPmaByDealer.has(d.id)) {
      patch.primary_pma_id = firstPmaByDealer.get(d.id)
    }
    if (Object.keys(patch).length) dealerUpdates.push({ id: d.id, name: d.name, patch })
  }

  // --- 3. Eligibility --------------------------------------------------------
  const { data: elig } = await supabase
    .from("eligibility")
    .select("id, flag_key, eligibility_flag_type_id")
  const eligUpdates = []
  const unmatchedKeys = new Map() // key -> count
  for (const e of elig ?? []) {
    if (e.eligibility_flag_type_id) continue
    const typeId = flagTypeByKey.get(e.flag_key)
    if (typeId) eligUpdates.push({ id: e.id, eligibility_flag_type_id: typeId })
    else unmatchedKeys.set(e.flag_key, (unmatchedKeys.get(e.flag_key) ?? 0) + 1)
  }

  // --- 4. keyword_targets ----------------------------------------------------
  const pmasByDealer = new Map()
  for (const p of allPmas ?? []) {
    if (!pmasByDealer.has(p.dealer_id)) pmasByDealer.set(p.dealer_id, [])
    pmasByDealer.get(p.dealer_id).push(p)
  }
  const keywordTargetRows = []
  for (const d of dealers ?? []) {
    const dealerKeywords = (keywords ?? []).filter((k) => k.oem === (d.oem || "KIA"))
    const dealerPmas = pmasByDealer.get(d.id) ?? []
    for (const k of dealerKeywords) {
      for (const p of dealerPmas) {
        keywordTargetRows.push({
          dealer_id: d.id,
          keyword_id: k.id,
          pma_id: p.id,
          is_targeted: true,
        })
      }
    }
  }

  // --- Report ----------------------------------------------------------------
  console.log("\nMigration plan:")
  console.log(`  Dealers to update (tier/primary PMA): ${dealerUpdates.length}`)
  for (const u of dealerUpdates) {
    console.log(`    - ${u.name}: ${Object.keys(u.patch).join(", ")}`)
  }
  console.log(`  Eligibility rows to map -> flag type: ${eligUpdates.length}`)
  if (unmatchedKeys.size) {
    console.log(`  Unmatched flag_keys (no eligibility_flag_type) — left as-is:`)
    for (const [k, n] of unmatchedKeys) console.log(`    - ${k} (${n})`)
  }
  console.log(
    `  keyword_targets to insert (dealer x keyword x PMA): ${keywordTargetRows.length}` +
      (keywords?.length ? "" : "  [no keywords seeded yet — run seed:keywords first]")
  )

  if (DRY_RUN) {
    console.log("\n[--dry-run] Nothing written.\n")
    return
  }

  // --- Apply -----------------------------------------------------------------
  for (const u of dealerUpdates) {
    const { error } = await supabase.from("dealers").update(u.patch).eq("id", u.id)
    if (error) console.error(`  ! dealer ${u.name}: ${error.message}`)
  }
  for (const u of eligUpdates) {
    const { error } = await supabase
      .from("eligibility")
      .update({ eligibility_flag_type_id: u.eligibility_flag_type_id })
      .eq("id", u.id)
    if (error) console.error(`  ! eligibility ${u.id}: ${error.message}`)
  }
  if (keywordTargetRows.length) {
    // ignoreDuplicates so existing (possibly user-edited) targets aren't reset.
    const { error } = await supabase
      .from("keyword_targets")
      .upsert(keywordTargetRows, {
        onConflict: "dealer_id,keyword_id,pma_id",
        ignoreDuplicates: true,
      })
    if (error) console.error(`  ! keyword_targets: ${error.message}`)
  }

  console.log(
    `\n✓ Migrated: ${dealerUpdates.length} dealers, ${eligUpdates.length} eligibility rows, ` +
      `${keywordTargetRows.length} keyword targets.\n`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
