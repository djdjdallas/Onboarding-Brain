# SEO Page Manager — Design System (V3)

The calm professional skin. Inspired by Notion (calm, focused), Linear (density,
keyboard-first, status pills as dots) and Airtable (database views). Goal: when an
account manager demos this to a Kia dealer's GM, it reads "enterprise-grade tool,"
not "MVP."

This app is **Next.js 16 (App Router) + Tailwind v4 + shadcn (Nova preset)**, JavaScript
only. There is **no `tailwind.config.js`** — the theme lives in `@theme` blocks inside
`app/globals.css`. Tokens are CSS variables; utilities are generated from them.

---

## How the tokens are wired

The V3 palette is applied by **recoloring shadcn's semantic CSS variables** in `:root`
(`app/globals.css`). Every existing route already styles with shadcn utilities
(`bg-background`, `text-muted-foreground`, `bg-primary`, `border`, …), so recoloring
re-skins all 23 routes at once. On top of that we add a small set of **net-new tokens**
that shadcn doesn't have: a status palette and a type scale.

### PRD token name → utility to actually use

The original PRD invents token names (`bg-surface-base`, `text-text-primary`,
`bg-accent`). To avoid colliding with shadcn's own `accent`/`muted`/etc., **use the
mapped utility on the right** when restyling:

| PRD name            | Use this utility                          | Value      |
| ------------------- | ----------------------------------------- | ---------- |
| surface-base        | `bg-background`                           | `#ffffff`  |
| surface-subtle      | `bg-muted` (or `bg-secondary`)            | `#f7f7f6`  |
| surface-hover       | `bg-accent` / `hover:bg-accent`           | `#f1f0ee`  |
| border-default      | `border` / `border-border`                | `#e4e3e0`  |
| border-subtle       | `border-border/60`                        | —          |
| text-primary        | `text-foreground`                         | `#2b2a28`  |
| text-secondary      | `text-muted-foreground`                   | `#6f6e6b`  |
| text-tertiary       | `text-muted-foreground/70`                | —          |
| **accent (brand)**  | `bg-primary` + `text-primary-foreground`  | `#2f6feb`  |
| accent-hover        | `hover:bg-primary/90`                     | —          |
| accent-subtle       | `bg-primary/10`                           | —          |
| accent-text         | `text-primary`                            | `#2f6feb`  |
| text-on-accent      | `text-primary-foreground`                 | `#ffffff`  |
| focus ring          | `ring-ring` (already `#2f6feb`)           | `#2f6feb`  |

> `bg-accent` is shadcn's **hover surface**, NOT the brand color. The brand blue is
> `primary`. Never restyle a hover state with `bg-primary`.

---

## Color

- **Surfaces** — base `#ffffff`, subtle `#f7f7f6`, hover `#f1f0ee`. Warm neutral, never
  pure gray.
- **Borders** — default `#e4e3e0`, subtle `border/60`.
- **Text** — primary `#2b2a28`, secondary `#6f6e6b`, tertiary `muted-foreground/70`.
- **Accent** — one blue, `#2f6feb`. Used for primary buttons, active nav/tab indicators,
  focus rings, selected rows. **One accent per UI section.** Never combine accent border
  + accent bg + accent text on the same element.

### Status palette (net-new tokens → StatusPill)

Each status has a dot/text color and a background. Utilities:
`text-status-{name}` (dot + text) and `bg-status-{name}-bg` (pill background).

| Status     | Dot / text          | Background            | Maps to (our data)                    |
| ---------- | ------------------- | --------------------- | ------------------------------------- |
| `live`     | `text-status-live`     `#1f9d57` | `bg-status-live-bg`     `#e8f6ee` | LIVE pages                            |
| `build`    | `text-status-build`    `#c07a12` | `bg-status-build-bg`    `#fbf1e0` | MISSING / Available-for-Build         |
| `strategy` | `text-status-strategy` `#2f6feb` | `bg-status-strategy-bg` `#eef3fe` | Strategy / in-planning                |
| `backlog`  | `text-status-backlog`  `#8a8a86` | `bg-status-backlog-bg`  `#f0efed` | Backlog / overflow                    |
| `error`    | `text-status-error`    `#d23b3b` | `bg-status-error-bg`    `#fbecec` | open findings / broken                |

Tier badges reuse the palette: Elite = `accent-subtle` (primary/10), Advanced =
`strategy`, Essential = `backlog`.

---

## Typography

Two fonts: **Inter** (UI) via `font-sans`, **JetBrains Mono** (URLs, priority scores,
code) via `font-mono`. **Two weights only: 400 and 500.** No 600/700 anywhere — use
`font-normal` / `font-medium`.

Type scale (net-new utilities):

| Utility        | Size / line-height | Use                              |
| -------------- | ------------------ | -------------------------------- |
| `text-tiny`    | 12 / 16            | labels, table headers, hints     |
| `text-small`   | 13 / 18            | secondary text, dense table cells |
| `text-body`    | 14 / 20            | body / default                   |
| `text-h2`      | 16 / 22            | dialog titles, section headers   |
| `text-h1`      | 20 / 26            | page / step titles               |
| `text-display` | 24 / 30            | dashboard / dealer name          |

Table headers: `text-tiny uppercase tracking-wide font-medium text-muted-foreground`.

---

## Spacing, radii, shadows

- **Spacing scale (only):** 4, 8, 12, 16, 24, 32px → `1 2 3 4 6 8`. **Never** `p-5`,
  `m-7`, or any off-scale value.
- **Radii:** `--radius: 0.5rem`. Use `rounded-md` (~6px) for buttons/inputs/cards,
  `rounded-lg` (8px) for dialogs, `rounded-sm` (~5px) / `rounded-[3px]` for status pills.
- **Shadows:** cards are **border-only, no shadow**. Only popovers/dropdowns
  (`shadow-sm`) and dialogs (`shadow-md`) get elevation.

---

## Component patterns

- **Button** — 12px/500 text, `rounded-md`. Heights sm=28 / default=32 / lg=36px.
  primary=`bg-primary text-primary-foreground hover:bg-primary/90`;
  secondary=`border bg-background hover:bg-accent`; ghost=`hover:bg-accent`;
  destructive=outline in `text-destructive border-destructive`. Icon-only: 28×28, ghost,
  **requires `aria-label`**.
- **Input** — 32px tall, `rounded-md`, 12px h-padding, `border`. Focus → accent border +
  `ring-2 ring-ring/20`. Disabled → `bg-muted text-muted-foreground/70`.
- **Card** — `bg-background border rounded-md p-4`, no shadow. Clickable → `hover:bg-accent`.
- **Table (Linear density)** — row 36px, cells `py-2 px-3`, **no row borders** (separate
  with `hover:bg-accent`). Header sticky, `text-tiny uppercase`. Selected row →
  `bg-primary/10` + 2px inset left border in primary.
- **StatusPill** — 20px tall, 8px h-padding, `rounded-[3px]`, `bg-status-{s}-bg`; inside:
  6px dot in `bg-status-{s}` + label `text-tiny font-medium text-foreground`.
- **Dialog** — `bg-popover rounded-lg shadow-md p-6`, backdrop `bg-black/40`, 200ms
  fade+scale.
- **Dropdown / Popover** — `bg-popover border rounded-md shadow-sm p-1`; items 28px,
  `text-small`, `hover:bg-accent`, selected `bg-primary/10 text-primary`.
- **Toaster (sonner)** — bottom-right, 2s success / 4s error, no icons.

---

## Screen states (Phase 5)

- **Empty** — centered, max-w-80, 40px lucide icon in `text-muted-foreground`, `text-h2`
  title, `text-small text-muted-foreground` description, one primary CTA. No illustrations.
- **Loading** — `.skeleton` blocks shaped like the real content (rows for tables, cards
  for galleries). No spinners except explicit user-triggered actions ("Generating CSV…").
- **Error** — inline field errors `text-tiny text-destructive`; action failures → toast;
  full-page → centered warning icon + "Something went wrong" + "Try again".
- **Success** — toast only (2s). No banner confirmations.

---

## Hard rules (enforced in review)

1. JavaScript only — no TypeScript.
2. No raw Tailwind palette (`bg-gray-100`, `text-slate-500`) and no off-scale spacing.
3. Two font weights: 400 and 500.
4. One accent per section; never accent border + bg + text together.
5. Status pills are 20px tall with a 6px dot — no exceptions.
6. Cards are border-only, no shadow.
7. Don't change routes, business logic, schema, or server actions — V3 is skin only.
8. When a decision isn't covered here, ask before inventing.
