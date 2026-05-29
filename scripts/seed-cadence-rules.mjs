/**
 * Seed cadence_rules (High / Medium / Low). Seeds built-in defaults; if you
 * export the Cadence_Rules tab to seed/cadence_rules.csv (or pass --csv=path),
 * matching fields override the defaults by normalized header name.
 *
 *   node scripts/seed-cadence-rules.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-cadence-rules.mjs
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"
import { getServiceClient, DRY_RUN, csvArgPath } from "./_supabase.mjs"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CSV_PATH = resolve(ROOT, csvArgPath() ?? "seed/cadence_rules.csv")

const DEFAULTS = [
  {
    cadence_key: "High",
    default_review_months: 3,
    when_to_use: "Pages tied to inventory, pricing, or promotions that change often.",
    typical_examples: "SRPs, Specials, Local/PMA pages.",
    due_date_behavior: "Re-review roughly every 3 months.",
    override_guidance: "Lower the cadence once a page stabilizes.",
    risks_notes: "High effort; reserve for pages that genuinely move rankings/leads.",
  },
  {
    cadence_key: "Medium",
    default_review_months: 6,
    when_to_use: "Pages that shift with brand/positioning changes.",
    typical_examples: "Home, model overviews, finance/service landing pages.",
    due_date_behavior: "Re-review roughly every 6 months.",
    override_guidance: "Bump to High during a rebrand or major campaign.",
    risks_notes: "",
  },
  {
    cadence_key: "Low",
    default_review_months: 12,
    when_to_use: "Stable, evergreen pages.",
    typical_examples: "About, directions, buyer guides, language pages.",
    due_date_behavior: "Re-review roughly once a year.",
    override_guidance: "Leave as-is unless the dealer's situation changes.",
    risks_notes: "",
  },
]

const FIELD_HINTS = {
  default_review_months: ["reviewmonths", "months", "defaultmonths"],
  when_to_use: ["whentouse", "when"],
  typical_examples: ["examples", "typical"],
  due_date_behavior: ["duedate", "behavior", "behaviour"],
  override_guidance: ["override", "guidance"],
  risks_notes: ["risks", "notes"],
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "")

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
  const keyHeader = headers.find((h) => norm(h).includes("cadence")) ?? headers[0]

  for (const csvRow of data) {
    const key = String(csvRow[keyHeader] ?? "").trim()
    const target = rows.find((r) => r.cadence_key.toLowerCase() === key.toLowerCase())
    if (!target) continue
    for (const [field, hints] of Object.entries(FIELD_HINTS)) {
      const h = findHeader(hints)
      if (h && csvRow[h] != null && String(csvRow[h]).trim() !== "") {
        target[field] =
          field === "default_review_months"
            ? parseInt(csvRow[h], 10) || target[field]
            : String(csvRow[h]).trim()
      }
    }
  }
  console.log(`(applied overrides from ${CSV_PATH})`)
  return rows
}

async function main() {
  const rows = applyCsvOverrides(DEFAULTS.map((r) => ({ ...r })))
  console.log("\nCadence rules:")
  for (const r of rows) console.log(`  ${r.cadence_key}: review every ${r.default_review_months} months`)

  if (DRY_RUN) {
    console.log("\n[--dry-run] Nothing written.\n")
    return
  }
  const supabase = await getServiceClient()
  const { error } = await supabase.from("cadence_rules").upsert(rows, { onConflict: "cadence_key" })
  if (error) {
    console.error("\nUpsert failed:", error.message, "\n")
    process.exit(1)
  }
  console.log(`\n✓ Upserted ${rows.length} cadence_rules.\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
