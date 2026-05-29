/**
 * Seed subtask_types from the Work_Type_Subtasks tab. Export it to
 * seed/work_type_subtasks.csv (or pass --csv=path). Columns are matched by
 * normalized header name, so minor header differences are fine. Upserts by
 * work_type. No built-in defaults — there's nothing to seed without the CSV
 * (you can also add subtask types in /admin/subtask-types).
 *
 *   node scripts/seed-subtask-types.mjs --dry-run
 *   node --env-file=.env.local scripts/seed-subtask-types.mjs
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"
import { getServiceClient, DRY_RUN, csvArgPath } from "./_supabase.mjs"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const CSV_PATH = resolve(ROOT, csvArgPath() ?? "seed/work_type_subtasks.csv")

const FIELD_HINTS = {
  work_type: ["worktype", "type", "name"],
  summary_pattern: ["summary", "pattern"],
  trigger_description: ["trigger"],
  standard_inputs: ["standardinputs", "inputs"],
  process_doc: ["process", "sop", "doc"],
  definition_of_done: ["definitionofdone", "dod", "done"],
  likely_owner: ["likelyowner", "owner"],
  qa_reviewer: ["qa", "reviewer"],
  where_it_lives: ["whereit", "lives", "location"],
  notes: ["notes"],
  sort_order: ["sortorder", "order"],
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "")

function main() {
  let csv
  try {
    csv = readFileSync(CSV_PATH, "utf8")
  } catch {
    // Not an error — there's just nothing to seed without the CSV. Exit 0 so
    // `seed:all` isn't blocked; subtask types can be added in /admin.
    console.log(
      `(no ${CSV_PATH} — skipping. Export the Work_Type_Subtasks tab or add types in /admin/subtask-types.)`
    )
    return null
  }

  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: "greedy" })
  const headers = data.length ? Object.keys(data[0]) : []
  const headerFor = {}
  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    headerFor[field] = headers.find((h) => hints.some((hint) => norm(h).includes(hint)))
  }
  if (!headerFor.work_type) {
    console.error(`\nCouldn't find a "work type" column. Headers: ${headers.join(", ")}\n`)
    process.exit(1)
  }

  const rows = []
  data.forEach((r, i) => {
    const work_type = String(r[headerFor.work_type] ?? "").trim()
    if (!work_type) return
    const row = { work_type, sort_order: i }
    for (const [field, header] of Object.entries(headerFor)) {
      if (field === "work_type" || !header) continue
      const v = String(r[header] ?? "").trim()
      if (field === "sort_order") {
        const n = parseInt(v, 10)
        if (Number.isFinite(n)) row.sort_order = n
      } else if (v) {
        row[field] = v
      }
    }
    rows.push(row)
  })

  console.log(`Parsed ${rows.length} subtask types:`)
  for (const r of rows) console.log(`  - ${r.work_type}`)

  if (DRY_RUN) {
    console.log("\n[--dry-run] Nothing written.\n")
    return rows
  }
  return rows
}

async function run() {
  const rows = main()
  if (DRY_RUN || !rows || rows.length === 0) return
  const supabase = await getServiceClient()
  const { error } = await supabase.from("subtask_types").upsert(rows, { onConflict: "work_type" })
  if (error) {
    console.error("\nUpsert failed:", error.message, "\n")
    process.exit(1)
  }
  console.log(`\n✓ Upserted ${rows.length} subtask_types.\n`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
