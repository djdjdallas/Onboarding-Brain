/**
 * Seed the master keyword list from seed/keywords.csv (the keyword column from
 * Dealership_Info — just the names, one per line; a header row is ignored).
 * Upserts into keywords for OEM=KIA. Re-run migrate:v2 afterward to backfill
 * keyword_targets for existing dealers.
 *
 *   node scripts/seed-keywords.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-keywords.mjs
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"
import { getServiceClient, DRY_RUN, csvArgPath } from "./_supabase.mjs"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CSV_PATH = resolve(ROOT, csvArgPath() ?? "seed/keywords.csv")
const OEM = (process.argv.find((a) => a.startsWith("--oem=")) ?? "--oem=KIA").slice(6) || "KIA"

function main() {
  let csv
  try {
    csv = readFileSync(CSV_PATH, "utf8")
  } catch {
    console.log(
      `(no ${CSV_PATH} — skipping. Export the keyword column from Dealership_Info, or add keywords in /admin/keywords.)`
    )
    return null
  }

  // First column only; header row (e.g. "Keyword") ignored.
  const { data } = Papa.parse(csv, { header: false, skipEmptyLines: "greedy" })
  const seen = new Set()
  const keywords = []
  data.forEach((row, i) => {
    const name = String(row[0] ?? "").trim()
    if (!name) return
    if (i === 0 && /^keywords?$/i.test(name)) return // header
    const key = name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    keywords.push(name)
  })

  console.log(`Parsed ${keywords.length} keywords. First few: ${keywords.slice(0, 8).join(", ")}`)
  return keywords
}

async function run() {
  const keywords = main()
  if (DRY_RUN || !keywords || keywords.length === 0) {
    if (DRY_RUN) console.log("\n[--dry-run] Nothing written.\n")
    return
  }
  const supabase = await getServiceClient()
  const rows = keywords.map((keyword) => ({ oem: OEM, keyword, is_active: true }))
  const { error } = await supabase
    .from("keywords")
    .upsert(rows, { onConflict: "oem,keyword", ignoreDuplicates: true })
  if (error) {
    console.error("\nUpsert failed:", error.message, "\n")
    process.exit(1)
  }
  console.log(`\n✓ Upserted ${rows.length} keywords for ${OEM}. Re-run migrate:v2 to backfill targets.\n`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
