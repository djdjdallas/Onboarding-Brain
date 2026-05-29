# Seeding `page_templates`

The page catalog is seeded once from the Google Sheets **`Main_Page_Library`**
tab. The seed script deduplicates the sheet's ~180 rows into ~40-60 generic,
multi-tenant templates.

## 1. Export the CSV from Google Sheets
1. Open your SEO workbook → click the **`Main_Page_Library`** tab.
2. **File → Download → Comma-separated values (.csv)**.
3. Save / rename the file to exactly:
   ```
   seed/main_page_library.csv
   ```
   (in this project, next to this README).

The script reads columns **by header name**, so the scattered blank columns and
the per-dealer columns (`Due Date`, `Priority Score`, `Status`, `Summary`,
`Labels`, etc.) are ignored automatically. The columns it uses:

| Sheet header | Used as |
|---|---|
| `Page Family` | `page_family` |
| `Page Type / Template` | `page_type` (after dedup) |
| `Update Cadence` | `cadence` |
| `Page Intent / Business Use` | `page_intent` |
| `Required Inputs` | `required_inputs` |
| `Eligibility / Gate` | `gate_rules` (parsed to a JSON array) |
| `People-First Guardrail` | `guardrail` |
| `Page Initial Value` | `base_priority` (falls back to 3.0 if blank) |
| `Description` | `description_template` |

## 2. Dry run — validate the dedup BEFORE writing
No database, no env file needed:
```bash
npm run seed:templates:dry
```
Check the printed summary:
- **Total templates** is 40-60 (not ~180 → dedup didn't run).
- **requires_model && !requires_pma** is ~9.
- **requires_pma** is ~9-12.
- The model-specific list shows `Model SRP`, `Model Overview`, … and the PMA
  list shows `K5 PMA Local`, `Sportage PMA Local`, …, `Dealer Near PMA`.

## 3. Real run — write to Supabase
Make sure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, then:
```bash
npm run seed:templates
```
This **clears existing KIA templates and re-inserts** (idempotent). Run it on a
fresh DB before onboarding any dealers — once dealers/pages reference templates,
the foreign key blocks the wipe (clear `pages` first if you must re-seed).

## 4. Verify (per the data-transfer checklist)
- Supabase **Table Editor → page_templates**: 40-60 rows; `base_priority` is
  numeric; `gate_rules` shows JSON arrays like `["new_inventory"]`, not raw text.
- The three verification SQL queries return the expected ~9 / ~9-12 / family
  breakdown.

## Dedup rules (what the script does)
| Sheet rows | Become | Flags |
|---|---|---|
| `<Model> in PMA <City>` | one `"<Model> PMA Local"` per model | `requires_pma=true` |
| `Dealer Near PMA <City>` | one `"Dealer Near PMA"` | `requires_pma=true` |
| `<Model> <Suffix>` (e.g. `K5 SRP`) | one generic `"Model <Suffix>"` | `requires_model=true` |
| everything else (`Home Page`, …) | kept as-is | both `false` |

The page generator (Step 7) parses the model back out of `"<Model> PMA Local"`
and expands `requires_model` templates across each dealer's own priority models.

---

# V2.0 reference-data seeds

Run after migration `0004_v2_admin.sql`. All use `--dry-run` (no DB needed) and
upsert by unique key (safe to re-run).

| Script | npm | Source |
|---|---|---|
| `seed-eligibility-flag-types.mjs` | `seed:eligibility-types` | hardcoded (19 flags, grouped) |
| `seed-cadence-rules.mjs` | `seed:cadence` | built-in defaults; optional `seed/cadence_rules.csv` |
| `seed-package-tiers.mjs` | `seed:packages` | built-in defaults; optional `seed/package_assumptions.csv` |

Seed them all in dependency order:
```bash
npm run seed:all          # eligibility types -> cadence -> packages
```

## Optional CSV overrides
`cadence` and `packages` seed sensible defaults out of the box (the tier
capacities match the page generator). To use your real sheet values instead,
export and the scripts will override matching fields by (normalized) header name:
- `Cadence_Rules` tab → `seed/cadence_rules.csv` (needs a cadence column + any of:
  review months, when to use, examples, due-date behavior, override, risks/notes)
- `Package_Assumptions` tab → `seed/package_assumptions.csv` (needs a tier/name
  column + pages-per-month, optimization capacity, etc.)

If your headers don't match and the override doesn't take, run with `--dry-run`
to see what loaded, and adjust the header hints in the script (or share the
headers). You can also just edit these in `/admin/cadence-rules` and
`/admin/package-tiers` once the admin UI is built.
