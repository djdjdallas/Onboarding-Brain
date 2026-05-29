# V2.0 runbook

Everything needed to bring a database up to V2.0 and verify the 8 deliverables.
JavaScript-only Next.js 16; migrations are applied by you (Supabase SQL editor
or `supabase db push`). Back up before migrating.

## 1. Migrations (in order)
| File | Purpose | Status |
|---|---|---|
| `0001_initial_schema.sql` | V1 schema | run |
| `0002_dealer_dashboard_view.sql` | dashboard view | run |
| `0003_audit_findings_detail_view.sql` | findings view | run |
| `0004_v2_admin.sql` | V2 tables + columns | run |
| **`0005_drop_order_unique.sql`** | **enables PMA/model reorder** | **run this** |

Each has a companion `*_down.sql` for rollback.

## 2. Seed + migrate (Node 20.6+ for `--env-file`)
```bash
npm run seed:all          # eligibility flag types, cadence, packages, subtasks*, keywords*
npm run migrate:v2:dry    # review the V1->V2 backfill plan
npm run migrate:v2        # backfill tier_id / primary_pma / eligibility FK / keyword targets
npm run cleanup:gate-keys # collapse the 3 messy slugged flags (optional, recommended)
```
\*`seed:subtasks` and `seed:keywords` skip gracefully without their CSVs. To
populate them, export the `Work_Type_Subtasks` and Dealership_Info keyword
columns to `seed/work_type_subtasks.csv` and `seed/keywords.csv`, then re-run
those + `npm run migrate:v2` (to backfill keyword_targets).

## 3. Config notes
- **Admin access**: open to all signed-in users until you set `ADMIN_EMAILS`
  (comma-separated) in `.env.local` / Vercel. Then it's locked to that list.
- **Audit "who" + CSV Reporter**: both resolve via `account_managers.email`
  matching your auth email — add yourself in Admin → Account Managers with a
  `jira_user_string`.
- **Lint**: `npm run lint` needs the `typescript` package (an `eslint-config-next`
  peer) even for JS projects. Not installed by choice; `npm run build` is the gate.

## 4. Deliverables — verify live (`npm run dev`)
1. **Add eligibility flag** — Admin → Eligibility Flags → Add "Has Spanish-language website", group Languages.
2. **Edit a template (audited)** — Admin → Page Templates → Home Page → edit Page intent → Save. Check `select * from audit_log order by changed_at desc limit 3;`.
3. **PMA reorder re-scores** — Dealer → Settings → PMAs → drag Manchester above Hartford → Save → Pages tab priorities update; Settings → History shows it.
4. **Eligibility → Backlog** — Settings → Eligibility → untick Bad Credit Financing → Review & save → confirm "N pages → Backlog" → apply → Pages tab shows them Backlogged.
5. **Keyword matrix** — Settings → Keyword Targets → bulk-select a column → Save.
6. **Page detail** — Pages → click Home Page → set adjustment +1.0, add a note → Save → priority breakdown recalculates.
7. **Discovered → Accept** — Findings → Run audit → Discovered tab → Accept a URL as a template → it appears in Pages as LIVE.
8. **Fact sheet** — Fact Sheet tab → Copy as Markdown → paste into Jira.

## 5. Deferred (later phases)
V2.1 workflow automation (auto-cadence scheduler reading `cadence_rules`,
subtask generation, cross-dealer calendar), V2.2 Jira two-way sync, V2.3
LLM drafting + multi-OEM. The `package_tiers` capacity numbers are reference
data; the generator still uses its own `TIER_CAPACITY` (kept in sync) until the
V2.1 scheduler wires them together.
