import { addMonths, endOfMonth, format, parseISO } from "date-fns"

import { TIER_CAPACITY } from "@/lib/page-generator"

/**
 * V2.1 cadence scheduler (server-only). Capacity and cadence now come from the
 * package_tiers / cadence_rules tables (with the V2.0 constants as fallback), so
 * the agency can tune scheduling in the admin UI without a deploy.
 */

const DEFAULT_MONTHS = { High: 3, Medium: 6, Low: 12 }
const CHUNK = 25

const todayIso = () => format(new Date(), "yyyy-MM-dd")

/** Next review date = last day of (anchor + months). */
export function computeNextDue(anchorIso, months) {
  if (!anchorIso || !months) return null
  return format(endOfMonth(addMonths(parseISO(anchorIso), months)), "yyyy-MM-dd")
}

/** { High, Medium, Low } review-month counts from cadence_rules. */
export async function loadCadenceMonths(supabase) {
  const { data } = await supabase.from("cadence_rules").select("cadence_key, default_review_months")
  const map = { ...DEFAULT_MONTHS }
  for (const r of data ?? []) {
    if (r.default_review_months != null) map[r.cadence_key] = r.default_review_months
  }
  return map
}

/** { tierName: { builds, optimizes } } from package_tiers (falls back to constants). */
export async function loadTierCapacity(supabase) {
  const { data } = await supabase
    .from("package_tiers")
    .select("name, new_pages_per_month, optimization_capacity_per_month")
  const cap = { ...TIER_CAPACITY }
  for (const t of data ?? []) {
    cap[t.name] = {
      builds: t.new_pages_per_month ?? 0,
      optimizes: t.optimization_capacity_per_month ?? 0,
    }
  }
  return cap
}

async function chunked(items, fn) {
  for (let i = 0; i < items.length; i += CHUNK) {
    await Promise.all(items.slice(i, i + CHUNK).map(fn))
  }
}

/**
 * Marks a page reviewed today and sets its next due_date from the template's
 * cadence (unless a manual due date is pinned). Returns the new values.
 */
export async function markReviewed(supabase, pageId) {
  const { data: page } = await supabase
    .from("pages")
    .select("id, manually_scheduled_due_date, page_templates(cadence)")
    .eq("id", pageId)
    .single()
  if (!page) return { error: "Page not found." }

  const months = await loadCadenceMonths(supabase)
  const cad = page.page_templates?.cadence || "Medium"
  const today = todayIso()
  const patch = { last_reviewed_at: today }
  if (!page.manually_scheduled_due_date) {
    patch.due_date = computeNextDue(today, months[cad] ?? months.Medium)
  }
  const { error } = await supabase.from("pages").update(patch).eq("id", pageId)
  if (error) return { error: error.message }
  return { ...patch }
}

/**
 * Rolls each LIVE page's due_date forward to last_reviewed_at + cadence.
 * Idempotent; respects manually-pinned due dates; only touches pages that have
 * been reviewed at least once. Returns the number of pages updated.
 */
export async function rescheduleDealer(supabase, dealerId) {
  const months = await loadCadenceMonths(supabase)
  const { data: pages } = await supabase
    .from("pages")
    .select("id, due_date, manually_scheduled_due_date, last_reviewed_at, page_templates(cadence)")
    .eq("dealer_id", dealerId)
    .eq("status", "LIVE")

  const updates = []
  for (const p of pages ?? []) {
    if (p.manually_scheduled_due_date || !p.last_reviewed_at) continue
    const cad = p.page_templates?.cadence || "Medium"
    const due = computeNextDue(p.last_reviewed_at, months[cad] ?? months.Medium)
    if (due && due !== p.due_date) updates.push({ id: p.id, due })
  }
  await chunked(updates, (u) =>
    supabase.from("pages").update({ due_date: u.due }).eq("id", u.id)
  )
  return updates.length
}
