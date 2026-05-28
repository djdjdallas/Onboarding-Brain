/**
 * Seed page_templates from the Google Sheets `Main_Page_Library` export.
 *
 * WHY THIS EXISTS
 * ---------------
 * The sheet stores ~180 rows because it pre-expands every model × PMA combo
 * for ONE dealer (Kia of East Hartford). If we seeded those verbatim, the app
 * would be hard-wired to that dealer's cities. Instead we DEDUPLICATE into
 * ~40-50 generic templates; the page generator (Step 7) expands them per
 * dealer based on that dealer's own PMAs and priority models. That dedup is
 * what makes the app multi-tenant.
 *
 * DEDUP RULES
 * -----------
 *  1. "<Model> in PMA <City>"  -> one template per model: "<Model> PMA Local"
 *                                 (requires_pma=true, requires_model=false).
 *                                 The model is baked into page_type and parsed
 *                                 back out by the generator.
 *  2. "Dealer Near PMA <City>" -> one template "Dealer Near PMA"
 *                                 (requires_pma=true).
 *  3. "<Model> <Suffix>"       -> one generic template per suffix: "Model <Suffix>"
 *     (e.g. "K5 SRP")            (requires_model=true, requires_pma=false).
 *  4. Everything else          -> kept as-is (both flags false).
 *
 * USAGE
 * -----
 *   1. Export the Main_Page_Library tab as CSV to seed/main_page_library.csv
 *      (see seed/README.md).
 *   2. Dry run (no DB writes) — inspect the dedup result:
 *        node scripts/seed-page-templates.mjs --dry-run
 *   3. Real run (writes to Supabase via the service-role key):
 *        node --env-file=.env.local scripts/seed-page-templates.mjs
 *      (Node 20.6+ loads .env.local via --env-file. The dry run doesn't need it.)
 */

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Papa from "papaparse"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const csvArg = process.argv.find((a) => a.startsWith("--csv="))
const CSV_PATH = csvArg
  ? resolve(csvArg.slice("--csv=".length))
  : resolve(ROOT, "seed/main_page_library.csv")
const DRY_RUN = process.argv.includes("--dry-run")
const OEM = "KIA"

// Kia models, longest-first so multi-token names match before substrings.
const MODELS = [
  "Sportage",
  "Sorento",
  "Telluride",
  "Carnival",
  "Seltos",
  "Niro",
  "EV6",
  "EV9",
  "K5",
]
const MODEL_ALT = MODELS.join("|")
// "<Model> in PMA <City>" -> per-model PMA-local templates.
const RE_MODEL_PMA = new RegExp(`^(${MODEL_ALT})\\s+in\\s+PMA\\s+.+$`, "i")
// "<Topic> Near PMA <City>" -> per-topic, city stripped (incl. "Dealer Near PMA").
const RE_NEAR_PMA = /^(.+?)\s+Near\s+PMA\s+.+$/i
// "<RealModel> <Suffix>" (e.g. "K5 SRP") -> generic "Model <Suffix>".
const RE_MODEL_PREFIX = new RegExp(`^(${MODEL_ALT})\\s+(.+)$`, "i")
// Literal "Model <Suffix>" placeholder rows the sheet already genericized.
const RE_MODEL_LITERAL = /^Model\s+(.+)$/i

// ---------------------------------------------------------------------------
// Eligibility / Gate parsing
// ---------------------------------------------------------------------------
// The sheet's "Eligibility / Gate" column holds human labels, sometimes with
// stray "TRUE"/"FALSE" tokens (e.g. "New Inventory, TRUE, TRUE"). We split on
// commas, drop the noise, and map each label to a flag_key. Unknown labels are
// slugified so nothing is silently lost.
const GATE_MAP = {
  "applies to all clients": null, // -> no gate
  "new inventory": "new_inventory",
  "used inventory": "used_inventory",
  "cpo inventory": "cpo_inventory",
  "certified pre-owned": "cpo_inventory",
  cpo: "cpo_inventory",
  "service department": "service_department",
  "service dept": "service_department",
  "service loaners": "service_loaners",
  loaners: "service_loaners",
  "bad credit financing": "bad_credit_financing",
  "bad credit": "bad_credit_financing",
  "credit application": "credit_application",
  "credit app": "credit_application",
  "value your trade": "value_your_trade",
  "trade in": "value_your_trade",
  "collision center": "collision_center",
  collision: "collision_center",
  "parts department": "parts_department",
  parts: "parts_department",
  "commercial fleet": "commercial_fleet",
  fleet: "commercial_fleet",
  "community involvement": "community_involvement",
  community: "community_involvement",
  "spanish speakers": "spanish_speakers",
  spanish: "spanish_speakers",
  "french speakers": "french_speakers",
  french: "french_speakers",
  "mandarin speakers": "mandarin_speakers",
  mandarin: "mandarin_speakers",
}

function slugify(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

/** Parse "Eligibility / Gate" -> array of flag_keys (ALL required). */
function parseGateRules(raw) {
  if (!raw) return []
  const keys = []
  for (const part of String(raw).split(",")) {
    const label = part.trim()
    if (!label) continue
    const lower = label.toLowerCase()
    if (lower === "true" || lower === "false") continue // stray noise tokens
    if (lower === "applies to all clients" || lower === "all clients") continue
    const mapped = GATE_MAP[lower]
    if (mapped === null) continue // explicit "no gate" label
    const key = mapped ?? slugify(label)
    if (key && !keys.includes(key)) keys.push(key)
  }
  return keys
}

function num(raw, fallback) {
  const n = parseFloat(String(raw ?? "").replace(/[^0-9.\-]/g, ""))
  return Number.isFinite(n) ? n : fallback
}

function clean(raw) {
  const s = String(raw ?? "").trim()
  return s.length ? s : null
}

// ---------------------------------------------------------------------------
// Build templates from CSV rows (dedup happens here)
// ---------------------------------------------------------------------------
function buildTemplates(rows) {
  /** dedupKey -> template object */
  const byKey = new Map()

  // Base fields shared by every classification, pulled by HEADER NAME (so the
  // scattered blank columns are skipped automatically — we never reference them).
  const baseOf = (row, pageType, { requires_model, requires_pma }) => ({
    oem: OEM,
    page_family: clean(row["Page Family"]),
    page_type: pageType,
    cadence: clean(row["Update Cadence"]),
    base_priority: num(row["Page Initial Value"], 3.0),
    page_intent: clean(row["Page Intent / Business Use"]),
    required_inputs: clean(row["Required Inputs"]),
    guardrail: clean(row["People-First Guardrail"]),
    description_template: clean(row["Description"]),
    requires_model,
    requires_pma,
    gate_rules: parseGateRules(row["Eligibility / Gate"]),
  })

  // First occurrence wins for collapsed groups (keeps the brief/intent/value
  // from the representative row).
  const addOnce = (key, template) => {
    if (!byKey.has(key)) byKey.set(key, template)
  }

  for (const row of rows) {
    const pageType = clean(row["Page Type / Template"])
    if (!pageType) continue // blank/footer row

    // Rule 1: Model + PMA -> one per model
    const mPma = pageType.match(RE_MODEL_PMA)
    if (mPma) {
      const model = MODELS.find((m) => m.toLowerCase() === mPma[1].toLowerCase())
      addOnce(
        `model-pma:${model}`,
        baseOf(row, `${model} PMA Local`, {
          requires_model: false,
          requires_pma: true,
        })
      )
      continue
    }

    // Rule 2: "<Topic> Near PMA <City>" -> one template per topic, city stripped.
    // Covers "Dealer Near PMA" plus service pages (Collision Center, Oil Change,
    // Service Center, New/Used Cars, Sell/Trade Car, Service & Parts Specials).
    const mNear = pageType.match(RE_NEAR_PMA)
    if (mNear) {
      const topic = mNear[1].trim()
      addOnce(
        `near-pma:${topic.toLowerCase()}`,
        baseOf(row, `${topic} Near PMA`, {
          requires_model: false,
          requires_pma: true,
        })
      )
      continue
    }

    // Rule 3: Single-model (non-PMA), e.g. "K5 SRP" -> generic "Model <Suffix>".
    const mPrefix = pageType.match(RE_MODEL_PREFIX)
    if (mPrefix) {
      const finalType = `Model ${mPrefix[2].trim()}`
      addOnce(
        `model:${finalType.toLowerCase()}`,
        baseOf(row, finalType, { requires_model: true, requires_pma: false })
      )
      continue
    }

    // Rule 3b: Literal "Model <Suffix>" placeholder rows (Showroom, Trim/Feature,
    // Lease/Finance, Year Launch) -> kept as-is, expanded per model.
    if (RE_MODEL_LITERAL.test(pageType)) {
      addOnce(
        `model:${pageType.toLowerCase()}`,
        baseOf(row, pageType, { requires_model: true, requires_pma: false })
      )
      continue
    }

    // Rule 4: Generic -> keep as-is
    addOnce(
      `generic:${pageType.toLowerCase()}`,
      baseOf(row, pageType, { requires_model: false, requires_pma: false })
    )
  }

  return [...byKey.values()]
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function report(templates) {
  const modelOnly = templates.filter((t) => t.requires_model && !t.requires_pma)
  const pma = templates.filter((t) => t.requires_pma)
  const generic = templates.filter((t) => !t.requires_model && !t.requires_pma)

  const byFamily = {}
  for (const t of templates) {
    const f = t.page_family ?? "(none)"
    byFamily[f] = (byFamily[f] ?? 0) + 1
  }

  console.log(`\nTotal templates: ${templates.length}`)
  console.log(`  requires_model && !requires_pma : ${modelOnly.length}`)
  console.log(`  requires_pma                    : ${pma.length}`)
  console.log(`  generic (both false)            : ${generic.length}`)

  console.log("\nBy page_family:")
  for (const [f, n] of Object.entries(byFamily).sort()) {
    console.log(`  ${String(n).padStart(3)}  ${f}`)
  }

  console.log("\nModel-specific (requires_model) page types:")
  for (const t of modelOnly) console.log(`  - ${t.page_type}`)
  console.log("\nPMA (requires_pma) templates:")
  for (const t of pma) console.log(`  - ${t.page_type}`)

  // Diagnostic: the generic bucket is where un-collapsed rows hide. If a
  // model/PMA page slips through the patterns it lands here, inflating the
  // count. Listed by family so it's easy to spot strays.
  console.log("\nGeneric (kept as-is) page types, by family:")
  const genByFamily = {}
  for (const t of generic) {
    const f = t.page_family ?? "(none)"
    ;(genByFamily[f] ??= []).push(t.page_type)
  }
  for (const [f, types] of Object.entries(genByFamily).sort()) {
    console.log(`  ${f}:`)
    for (const pt of types.sort()) console.log(`    - ${pt}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let csv
  try {
    csv = readFileSync(CSV_PATH, "utf8")
  } catch {
    console.error(
      `\nCould not read ${CSV_PATH}\n` +
        `Export the Main_Page_Library tab to that path first — see seed/README.md.\n`
    )
    process.exit(1)
  }

  const { data, errors } = Papa.parse(csv, {
    header: true,
    skipEmptyLines: "greedy",
  })
  if (errors.length) {
    console.warn(`PapaParse reported ${errors.length} issue(s); first:`, errors[0])
  }

  const templates = buildTemplates(data)
  console.log(`Parsed ${data.length} CSV rows -> ${templates.length} templates.`)
  report(templates)

  if (DRY_RUN) {
    console.log("\n[--dry-run] Nothing written to the database.\n")
    return
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error(
      "\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Run with:  node --env-file=.env.local scripts/seed-page-templates.mjs\n"
    )
    process.exit(1)
  }

  // supabase-js spins up a Realtime client on construction, which needs a
  // global WebSocket. Node < 22 doesn't have one — polyfill with `ws`. (The
  // seed only uses the REST/Postgres API, so Realtime is never actually used.)
  if (typeof globalThis.WebSocket === "undefined") {
    const { default: ws } = await import("ws")
    globalThis.WebSocket = ws
  }

  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })

  // Idempotent: clear existing KIA templates, then insert fresh.
  // (Safe on a pre-onboarding DB; pages.template_id would block this once
  // dealers exist — clear pages first if you re-seed later.)
  const { error: delErr } = await supabase
    .from("page_templates")
    .delete()
    .eq("oem", OEM)
  if (delErr) {
    console.error(
      "\nDelete of existing KIA templates failed:",
      delErr.message,
      "\nIf this is a foreign-key error, dealers/pages already reference these " +
        "templates. Clear pages first or seed on a fresh DB.\n"
    )
    process.exit(1)
  }

  const { error: insErr, count } = await supabase
    .from("page_templates")
    .insert(templates, { count: "exact" })
  if (insErr) {
    console.error("\nInsert failed:", insErr.message, "\n")
    process.exit(1)
  }

  console.log(`\n✓ Inserted ${count ?? templates.length} page_templates for ${OEM}.\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
