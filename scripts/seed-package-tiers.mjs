/**
 * Seed package_tiers (Essential / Advanced / Elite). Defaults match the page
 * generator's tier capacity (lib/page-generator.js TIER_CAPACITY) so the
 * reference data and the engine agree. Optional override from
 * seed/package_assumptions.csv (or --csv=path) by normalized header name.
 *
 *   node scripts/seed-package-tiers.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-package-tiers.mjs
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"
import { getServiceClient, DRY_RUN, csvArgPath } from "./_supabase.mjs"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CSV_PATH = resolve(ROOT, csvArgPath() ?? "seed/package_assumptions.csv")

const DEFAULTS = [
  {
    name: "Essential",
    new_pages_per_month: 0,
    new_pages_per_year: 0,
    optimization_capacity_per_month: 2,
    keyword_targeting_balance: null,
    primary_focus: "Optimization of existing pages",
    creation_rule: "0 builds + 2 optimizes per month",
  },
  {
    name: "Advanced",
    new_pages_per_month: 1,
    new_pages_per_year: 12,
    optimization_capacity_per_month: 3,
    keyword_targeting_balance: null,
    primary_focus: "Balanced build + optimize",
    creation_rule: "1 build + 3 optimizes per month",
  },
  {
    name: "Elite",
    new_pages_per_month: 2,
    new_pages_per_year: 24,
    optimization_capacity_per_month: 4,
    keyword_targeting_balance: null,
    primary_focus: "Aggressive build + optimize",
    creation_rule: "2 builds + 4 optimizes per month",
  },
]

const FIELD_HINTS = {
  new_pages_per_month: ["pagespermonth", "buildspermonth", "newpermonth"],
  new_pages_per_year: ["pagesperyear", "peryear"],
  optimization_capacity_per_month: ["optimiz", "optspermonth"],
  keyword_targeting_balance: ["keyword", "targeting"],
  primary_focus: ["focus", "primary"],
  creation_rule: ["creationrule", "rule"],
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "")
const intFields = new Set([
  "new_pages_per_month",
  "new_pages_per_year",
  "optimization_capacity_per_month",
  "keyword_targeting_balance",
])

function applyCsvOverrides(rows) {
  let csv
  try {
    csv = readFileSync(CSV_PATH, "utf8")
  } catch {
    console.log(`(no ${CSV_PATH} — using built-in defaults)`)
    return rows
  }
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: "greedy" })
  const headers = data.length ? Object.keys(data[0]) : []
  const findHeader = (hints) =>
    headers.find((h) => hints.some((hint) => norm(h).includes(hint)))
  const keyHeader =
    headers.find((h) => ["tier", "package", "name"].some((k) => norm(h).includes(k))) ??
    headers[0]

  for (const csvRow of data) {
    const key = String(csvRow[keyHeader] ?? "").trim()
    const target = rows.find((r) => r.name.toLowerCase() === key.toLowerCase())
    if (!target) continue
    for (const [field, hints] of Object.entries(FIELD_HINTS)) {
      const h = findHeader(hints)
      if (h && csvRow[h] != null && String(csvRow[h]).trim() !== "") {
        const v = String(csvRow[h]).trim()
        target[field] = intFields.has(field) ? parseInt(v.replace(/[^0-9-]/g, ""), 10) : v
      }
    }
  }
  console.log(`(applied overrides from ${CSV_PATH})`)
  return rows
}

async function main() {
  const rows = applyCsvOverrides(DEFAULTS.map((r) => ({ ...r })))
  console.log("\nPackage tiers (builds + optimizes / month):")
  for (const r of rows)
    console.log(`  ${r.name}: ${r.new_pages_per_month} + ${r.optimization_capacity_per_month}`)

  if (DRY_RUN) {
    console.log("\n[--dry-run] Nothing written.\n")
    return
  }
  const supabase = await getServiceClient()
  const { error } = await supabase.from("package_tiers").upsert(rows, { onConflict: "name" })
  if (error) {
    console.error("\nUpsert failed:", error.message, "\n")
    process.exit(1)
  }
  console.log(`\n✓ Upserted ${rows.length} package_tiers.\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
