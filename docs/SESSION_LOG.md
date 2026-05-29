# SEO Page Manager — build log (V1 → V2.0)

Internal tool for an auto-dealer SEO agency. Replaces a complex Google Sheets
workflow: onboard dealers, generate each dealer's page plan, export to Jira,
audit live URLs, and (V2.0) manage all reference data + edit everything in-app.

This log captures everything built in one session: V1 (12 steps) and V2.0 (17
steps), plus the fixes and decisions made along the way.

---

## Stack & environment decisions

- **Next.js 16, App Router, JavaScript only** (no TypeScript) — per the owner's
  preference. `create-next-app@latest` resolved to v16 (not the PRD's 15);
  kept it (App Router / Server Actions are compatible).
- **Next 16 breaking change handled**: `middleware` was renamed to `proxy` —
  the app uses a root `proxy.js`.
- **shadcn/ui** (Nova preset, neutral palette) + Tailwind. The shadcn CLI's
  `--base-color` flag is gone; used the Nova preset. `form` wasn't installed by
  the CLI, so `components/ui/form.jsx` was hand-written to match the consolidated
  `radix-ui` import style (`Slot.Root`).
- **Supabase** (Postgres + Auth + RLS). Migrations are applied by the owner
  (dashboard SQL editor / `supabase db push`); the assistant writes the files.
- **Local quirks**: the global npm cache is broken → installs use
  `NPM_CONFIG_CACHE=/tmp/npm-cache-seo`. Node 20.11 lacks global `WebSocket`, so
  `supabase-js` (builds a Realtime client at construction) is polyfilled with
  `ws` in scripts and `createServiceClient`.

---

## V1 — ship the core product (12 steps)

**Goal:** onboard a dealer in <15 min and auto-audit live URLs.

1. **Project setup** — Next 16 (JS), shadcn + all V1 components, Supabase
   browser/server/service clients (`@supabase/ssr`), auth route-guard via
   `proxy.js`, Toaster + TooltipProvider. Libs: zod, papaparse, cheerio,
   date-fns, react-hook-form.
2. **Database schema** (`0001_initial_schema.sql`) — 9 tables: account_managers,
   dealers, pmas, priority_models, eligibility, page_templates, pages,
   audit_runs, audit_findings. `mod_score` is a **generated column**
   `1 - ((priority_order-1) × 0.111)`. RLS: authenticated full access.
3. **Auth** — magic-link login (server action + `useActionState`),
   `/auth/confirm` handling **both** PKCE `code` flow and `token_hash`
   (a mid-build fix once the real link arrived as `?code=`), sign-out, and the
   `(app)` route group with a sidebar shell.
4. **Seed: page templates** (`seed-page-templates.mjs`) — reads the
   `Main_Page_Library` CSV by header name and **deduplicates** ~180 sheet rows
   into ~72 multi-tenant templates:
   - `<Model> in PMA <City>` → one `<Model> PMA Local` per model (`requires_pma`)
   - `<Topic> Near PMA <City>` → one `<Topic> Near PMA` (city stripped)
   - `<Model> <Suffix>` / literal `Model <X>` → generic `Model <Suffix>` (`requires_model`)
   - everything else kept as-is. `gate_rules` parsed from the eligibility column
     (strips `TRUE`/`FALSE` noise). `--dry-run` + `--csv=` flags.
5. **Dashboard** (`0002_dealer_dashboard_view.sql`) — a `dealer_dashboard`
   view aggregating open-findings count + last-audit per dealer; table with
   tier/findings badges and relative dates; row → dealer detail.
6. **Onboarding wizard** (`/dealers/new`) — 5 steps (basics, PMAs with
   drag-reorder via dnd-kit, models, eligibility checkboxes from template
   gate_rules, known URLs), react-hook-form + zod, single submit that inserts
   dealer + children.
7. **Page generator** (`lib/page-generator.js`) — pure/deterministic. Gate
   check → fan-out (per-model PMA, model×pma, etc.) → status (LIVE if a seeded
   URL matches, else MISSING) → `priority_score = base × model_mod × pma_mod ×
   (1.1 if MISSING)` → schedule build/optimize queues by tier capacity over 12
   months → next_step. Wired into onboarding; a manual "Generate pages" button
   covers pre-existing dealers.
8. **Dealer detail** — tabbed (Pages / Findings / Settings); filterable Pages
   table (family/status/next_step/model/PMA), bulk-select.
9. **Jira CSV export** (`lib/jira-export.js`) — server action builds the 8-column
   Jira import format (Summary, Description, Status, Due Date, Update Cadence,
   URL, Reporter, Issue Type); `pageLabel` reconstructs readable names from the
   generic templates.
10. **Auditor** (`lib/auditor.js`) — per-dealer: load sitemap (with index
    expansion), check each LIVE URL (concurrency 5, 10s timeout) → broken_url /
    missing_from_sitemap / title_mismatch (cheerio) / discovered_unplanned.
11. **Audit endpoints** — `/api/cron/audit-all-dealers` (CRON_SECRET, daily via
    `vercel.json`) + `/api/audit/[dealerId]` (POST, auth-gated). Proxy exempts
    `/api/*`. "Run audit" button on the Findings tab.
12. **Findings UI** (`0003_audit_findings_detail_view.sql`) — dealer Findings
    tab (grouped by type, Resolve/Ignore) + global `/findings` view (filter by
    dealer/type/status).

**V1 fixes:** PKCE auth-confirm flow; the seed dedup classification was tuned
twice against the real 176-row sheet (Near-PMA generalization + literal-`Model`
handling); WebSocket polyfill for the seed script.

---

## V2.0 — Admin UI + full editability (17 steps)

**Goal:** every Google Sheet tab becomes editable in-app; no more hopping to
Sheets. Built on branch `v2-admin-ui`.

1. **Migration** (`0004_v2_admin.sql`, + `_down`) — additive & reversible.
   New tables: eligibility_flag_types, keywords, keyword_targets, subtask_types,
   cadence_rules, package_tiers, discovered_pages, audit_log. New columns on
   pages (manual_priority_adjustment, manually_scheduled_due_date, notes,
   labels), dealers (package_tier_id, service_start_month, primary_pma_id),
   page_templates (content/spec URLs, default_labels, stakeholder_notes),
   account_managers (is_active), priority_models (tracked), eligibility
   (eligibility_flag_type_id). Legacy columns kept for backward compatibility.
2. **Static seeds** — `seed-eligibility-flag-types` (19 grouped flags),
   `seed-cadence-rules`, `seed-package-tiers` (defaults match the generator's
   tier capacities; optional CSV override). `seed:all` orchestrates them.
3. **Data backfill** (`migrate-v1-to-v2.mjs`) — idempotent: tier text → tier_id,
   primary PMA, eligibility flag_key → FK, keyword_targets default-on. Dry-run
   shows the plan; flagged 3 unmatched slugged flags.
4. **`/admin` layout** — role gating (`lib/auth/roles.js`, `ADMIN_EMAILS`
   allowlist; open to all signed-in users until set), section sub-nav, sidebar
   Admin link.
5. **Account Managers** — CRUD, soft deactivate (preserves audit integrity),
   dealer count. Established the reusable `ConfirmDialog`.
6. **Eligibility Flags** — CRUD; key auto-derived & immutable; delete blocked
   when a dealer uses the flag.
7. **Cadence Rules + Package Tiers** — edit-only (closed sets) via a shared
   `ReferenceEditor`; affected-counts (pages per cadence / dealers per tier).
8. **Subtask Types** — full CRUD + `seed-subtask-types` (CSV-driven, graceful
   skip).
9. **Page Templates** — the big one: filterable list → full detail editor
   (text fields, family/cadence selects, base_priority, requires flags,
   `gate_rules` multi-toggle, `default_labels` TagInput). **First audited
   entity** — per-field `audit_log` entries on save. Delete blocked when pages
   reference it.
10. **Keywords** — table grouped by OEM, add + bulk import (paste), soft delete;
    `seed-keywords` + re-run `migrate:v2` backfills keyword_targets.
11. **Editable dealer Settings** (`/dealers/[id]/settings`) — sub-tabs Info /
    PMAs (drag + primary) / Models (drag + tracked) / Eligibility (toggle →
    impact preview → apply) / Keyword Targets (matrix grid + row/col/invert) /
    History. Backed by **`lib/dealer-recalc.js`** — surgical recalc
    (recomputeScores, reconcileStructure, applyEligibility) that preserves page
    IDs/findings/manual fields. Migration **`0005`** drops
    `unique(dealer_id, priority_order)` so reorder updates in place without
    cascading away keyword_targets.
12. **Pages inline editing** — optimistic edits of status/next_step/URL/
    adjustment/manual-due (lightweight native inputs for scale), new columns,
    bulk Backlog / Apply-label, extra filters. Page type links to detail.
13. **Per-page detail** (`/dealers/[id]/pages/[pageId]`) — editable form +
    read-only priority breakdown + template brief + history, and a **Generate
    Jira Description** button (fills the brief with dealer/page vars, copy).
14. **Discovered pages** — auditor now upserts `discovered_pages` with a
    suggested template; dealer Discovered tab with Accept (→ creates a LIVE
    page) / Dismiss / Flag + bulk dismiss.
15. **Fact Sheet** — read-only dealer summary (info, PMAs, models, eligibility,
    URLs by family) + Copy as Markdown.
16. **Audit-log coverage** — every dealer mutation (PMAs, models, eligibility,
    keyword targets, discovered, bulk page actions) writes audit entries,
    anchored to `dealerId` so they surface in the History panels.
17. **Verification** — clean build (23 routes), recalc engine unit-tested,
    `docs/V2_RUNBOOK.md` written.

**V2.0 fixes:** dealer-detail 404 after 0004 (a second FK from `dealers` to
`pmas` made the PostgREST `pmas(...)` embed ambiguous → disambiguated with
`pmas!pmas_dealer_id_fkey`); gate-key cleanup script for the 3 slugged flags.

---

## Migrations (apply in order)
`0001` schema · `0002` dashboard view · `0003` findings view · `0004` V2 admin
tables/columns · `0005` drop pma/model order-unique. Each has a `*_down.sql`.

## Scripts (`package.json`)
- V1: `seed:templates[:dry]`
- V2 seeds: `seed:eligibility-types`, `seed:cadence`, `seed:packages`,
  `seed:subtasks`, `seed:keywords`, `seed:all`
- Data: `migrate:v2[:dry]`, `cleanup:gate-keys[:dry]`

## Known notes / deferred
- Admin is open to all signed-in users until `ADMIN_EMAILS` is set.
- Audit "who" + CSV Reporter resolve via `account_managers.email` = auth email.
- `npm run lint` needs the `typescript` package (JS-only project, not installed);
  `npm run build` is the gate.
- `package_tiers` capacity is reference data; the generator still uses its own
  `TIER_CAPACITY` (kept in sync) until the V2.1 scheduler.
- **Deferred:** V2.1 (auto-cadence scheduler, subtask generation, cross-dealer
  calendar), V2.2 (Jira two-way sync), V2.3 (LLM drafting, multi-OEM,
  rank tracking).

See `docs/V2_RUNBOOK.md` for the setup + 8-deliverable test steps.
