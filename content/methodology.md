# SEO Page Manager — How It Works

This document is the source of truth for the app's scoring, scheduling, eligibility, and audit logic.

## 1. The big picture

The app turns three inputs into a working SEO plan for any auto dealership:

- **Page Templates** — the catalog of SEO page types (Home Page, Model SRP, Service Center, etc.) defined globally in `/admin/page-templates`.
- **Dealer Configuration** — the specific dealership's settings: brand (OEM), markets (PMAs), priority models, eligibility flags, package tier.
- **Live URL State** — what's actually on the dealer's website right now (LIVE vs MISSING).

From these three inputs, the generator produces a **per-dealer page plan**: every page that should exist, what priority it has, when it should be built or refreshed, and whether it's currently live.

## 2. How pages are generated

The page generator runs whenever you onboard a new dealer or click "Generate Pages" on an existing one. It's deterministic — same inputs always produce the same plan.

For each `page_template` in the catalog, the generator asks three questions:

### 2a. Does this dealer qualify for this template? (Eligibility gate)

Each template has a `gate_rules` array of required eligibility flags. The generator checks the dealer's eligibility flags. If any required flag is `false` or missing, the template is **skipped entirely** — no page is created for that dealer.

Example: The "Collision Center Near PMA" template has `gate_rules: ["collision_center"]`. A dealer without a collision center doesn't get that page at all.

Exception: Pages in the **Core** and **Required Page** families that fail gating still get created with `status='Backlog'` so they appear in a manual review list.

### 2b. Should this template be fanned out per model/PMA?

Page templates have two flags:

- `requires_model: true` — generator creates one page per priority model (up to 9)
- `requires_pma: true` — generator creates one page per PMA (up to 9)
- both true — generator creates one page per (model × PMA) combination (up to 81)
- both false — generator creates exactly one page

This is why `Model SRP` is stored as one generic template but produces 9 actual pages for a dealer with 9 priority models (one for K5, one for Sportage, etc.).

### 2c. What's the live state?

If the dealer provided a known URL for this page during onboarding (matched by page type), the page is created with `status='LIVE'` and the URL attached. Otherwise it's `status='MISSING'`.

## 3. How priority scores are calculated

Every page gets a `priority_score` (typically 0.0 to 6.0). The formula:

```
priority_score = base_priority
                 × model_mod_score      (if page is tied to a model)
                 × pma_mod_score        (if page is tied to a PMA)
                 × missing_boost        (1.1 if MISSING, else 1.0)
                 + manual_adjustment    (default 0, set by AM)
```

### 3a. base_priority

Comes from the template (set in `/admin/page-templates`). Common values:

| Page family | Typical base_priority |
|---|---|
| Core (Home, About, Contact) | 4.0–5.0 |
| Required (Oil Change, Tire Center, CPO) | 5.0 |
| Inventory (SRPs, Specials) | 4.0–5.0 |
| Model (SRP, Overview, vs. Competition) | 2.0–4.0 |
| Local (Model in PMA, Dealer Near PMA) | 4.0–5.5 |
| Service (Brake, Battery, Transmission) | 3.0–5.5 |
| Finance | 3.0–4.0 |
| Parts / Collision | 2.0–3.0 |
| Buyer Guides | 2.0–3.0 |

### 3b. mod_score (the city/model multiplier)

Each PMA and each priority model has a `priority_order` (1 = most important, 9 = least). Their `mod_score` is computed:

```
mod_score = 1 - ((priority_order - 1) × 0.111)
```

| priority_order | mod_score |
|---|---|
| 1 (primary) | 1.000 |
| 2 | 0.889 |
| 3 | 0.778 |
| 4 | 0.667 |
| 5 | 0.556 |
| 6 | 0.444 |
| 7 | 0.333 |
| 8 | 0.222 |
| 9 | 0.111 |

This means a page about your #1 model in your #1 PMA has the full base priority. A page about your #9 model in your #9 PMA gets only ~1.2% of base — effectively deprioritized.

### 3c. missing_boost

If a page is `status='MISSING'` (i.e. needs to be built), its score gets multiplied by 1.1. This pushes new-build work above optimization work of the same base value, so the calendar fills builds first.

### 3d. manual_adjustment

The AM can override scoring on any page from the Page detail view. Adjustment is **added** to the final score (not multiplied). Use this when strategic context overrides the algorithm — e.g., a client requested specific focus on a model, or competitive pressure makes a page urgent.

### 3e. Worked example

A K5 page targeted at East Hartford (a 9-PMA dealer), with K5 as the #1 model and East Hartford as the #1 PMA, status MISSING, no manual adjustment:

```
base × model_mod × pma_mod × missing_boost + adjustment
5.00 × 1.000     × 1.000   × 1.1           + 0
= 5.50
```

That matches what you see in the Pages tab.

A Niro page in New Britain (#9 model, #9 PMA), status LIVE, with a +1.0 manual adjustment from the AM:

```
base × model_mod × pma_mod × missing_boost + adjustment
5.00 × 0.111     × 0.111   × 1.0           + 1.0
= 1.06
```

## 4. How due dates are assigned

The page generator also acts as a scheduler. It sorts all pages by `priority_score` (highest first) and assigns them to calendar months based on the dealer's package tier capacity:

| Tier | Builds per month | Optimizations per month |
|---|---|---|
| Essential | 0 | 2 |
| Advanced | 1 | 3 |
| Elite | 2 | 4 |

Pages with `status='MISSING'` go into the **build queue**. Pages with `status='LIVE'` go into the **optimize queue**. Each queue is filled month-by-month starting from the dealer's `service_start_month`, respecting tier capacity.

If a dealer has more pages queued than 12 months of capacity can handle, the leftover pages get `status='Backlog'` with `due_date=null`. They're visible in the Pages tab but unscheduled until the AM manually pulls them forward via priority adjustment or manual due date.

**Manual override**: an AM can set a `manually_scheduled_due_date` on any page. This overrides the generator's scheduled date. Useful for syncing work with a client campaign or model launch.

## 5. How cadence works

Cadence is set per template and determines how often a LIVE page should be refreshed after each touch:

| Cadence | Refresh interval | Use for |
|---|---|---|
| High | 3 months | Specials pages, high-value SRPs, model offer pages |
| Medium | 6 months | Model SRPs, model/city pages, service pages, finance/trade |
| Low | 12 months | FAQs, About, community, buyer guides |

When an AM marks a page Optimization as complete, the next due date auto-resets based on its template's cadence. Cadence rules live in `/admin/cadence-rules` and can be edited if your team wants different defaults.

## 6. How the URL auditor works

Every dealer has a daily audit job that runs at 6 AM UTC via Vercel cron. For each dealer:

1. Fetch the dealer's sitemap.xml (with fallback to sitemap_index.xml).
2. Build a set of all URLs currently on the site.
3. For every page in the plan with `status='LIVE'` and a URL:
   - HEAD request the URL (10s timeout). Non-2xx → **broken_url** finding.
   - If URL isn't in the sitemap set → **missing_from_sitemap** finding.
   - GET the URL, parse `<title>` and first `<h1>`. If they don't relate to the expected page intent → **title_mismatch** finding.
4. For URLs in the sitemap that aren't in the plan → **discovered_unplanned** finding (with a suggested template match if confidence > 0.8).

Concurrency capped at 5 parallel fetches per dealer to avoid hammering sites. Findings appear in the dealer's Findings tab and the global `/findings` view. AMs Resolve or Ignore each finding.

Discovered URLs land in the Discovered tab where AMs can Accept (creates a LIVE page tied to a template), Dismiss (status=dismissed), or Flag for strategist review.

## 7. Reading the Pages tab

Status pills tell you the current state of each page:

| Pill | Meaning |
|---|---|
| **LIVE** | Page exists on the site, URL is captured, audits run against it |
| **MISSING** | Page is in the build queue — scheduled to be created |
| **STRATEGY** | Page is awaiting strategist input before build or optimization |
| **BACKLOG** | Page is in the plan but unscheduled (over capacity or manually pushed) |

Next-step values:
- **Build** — page doesn't exist yet, create it
- **Optimize** — page exists, refresh it on cadence
- **Backlog** — no action scheduled

Priority score and due date columns let you sort and filter the queue. Inline editing on status, URL, next_step, manual adjustment, and manual due date is supported — click any cell to edit.

## 8. How to edit and override

You can override the algorithm anywhere it matters:

- **Per-page** manual priority adjustment (added to the calculated score) and manual due date (overrides scheduling)
- **Per-dealer** PMA reorder, model reorder, eligibility toggles (re-runs page generation)
- **Per-template** base_priority, gate_rules, cadence (re-runs scoring across all dealers using that template)

Every edit is captured in the audit_log with timestamp, actor, field, old value, new value. View History on any dealer page or the per-page detail view.

## 9. CSV export to Jira

The Jira CSV export (Pages tab → "Export to Jira") builds an 8-column file matching the agency's Jira import format:

| Column | Source |
|---|---|
| Summary | "Web Page: {dealer} - {page_type}" |
| Description | Full SEO brief generated from template + dealer + page vars |
| Status | Maps app status → Jira status |
| Due Date | The page's calculated or manually set due date |
| Update Cadence | From the template's cadence |
| URL | The page's current URL (blank if MISSING) |
| Reporter | The assigned AM's Jira user string |
| Issue Type | "Managed Website Page" |

Selected pages only export; use bulk-select to scope the export.

## 10. Glossary

| Term | Meaning |
|---|---|
| **PMA** | Primary Market Area — a city the dealer wants to rank for |
| **OEM** | Original Equipment Manufacturer (the car brand: Kia, Honda, etc.) |
| **Page Family** | High-level grouping (Core, Required, Inventory, Local, Model, Service, Finance, Parts, Buyer Guide) |
| **Page Template** | Generic page definition in the catalog (e.g., "Model SRP") |
| **Page** | A specific instance for a specific dealer (e.g., "K5 SRP for Kia of East Hartford") |
| **Gate Rule** | An eligibility flag a dealer must have for a template to apply |
| **Mod Score** | Multiplier (1.0 → 0.11) based on priority order, applied to base_priority |
| **Cadence** | Refresh frequency (High/Medium/Low → 3/6/12 months) |
| **Audit Run** | A scheduled or manual sweep of a dealer's live URLs |
| **Audit Finding** | A specific issue detected during an audit (broken URL, mismatch, etc.) |
| **Discovered Page** | A URL found on a dealer's site that isn't in the plan |
