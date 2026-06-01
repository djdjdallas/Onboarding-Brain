import Link from "next/link"
import { format, parseISO } from "date-fns"
import { CalendarDays } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { pageLabel } from "@/lib/jira-export"
import { CalendarControls } from "@/components/calendar-controls"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusPill, statusVariant } from "@/components/ui/status-pill"

export const metadata = { title: "Calendar · SEO Page Manager" }

// First/last day strings for a YYYY-MM (no Date math, TZ-safe).
function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number)
  const start = `${y}-${String(m).padStart(2, "0")}-01`
  const lastDay = new Date(y, m, 0).getDate() // m is 1-based -> day 0 of next month
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  return { start, end }
}

export default async function CalendarPage({ searchParams }) {
  const sp = (await searchParams) ?? {}
  const today = format(new Date(), "yyyy-MM")
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month : today
  const amId = sp.am || null
  const { start, end } = monthRange(month)

  const supabase = await createClient()
  const [{ data: rawPages }, { data: ams }] = await Promise.all([
    supabase
      .from("pages")
      .select(
        "id, dealer_id, model, pma_city, status, next_step, due_date, " +
          "page_templates(page_type), dealers(name, am_id, account_managers(name))"
      )
      .gte("due_date", start)
      .lte("due_date", end)
      .neq("status", "Backlog")
      .order("due_date"),
    supabase.from("account_managers").select("id, name").eq("is_active", true).order("name"),
  ])

  const pages = (rawPages ?? []).filter((p) => !amId || p.dealers?.am_id === amId)

  // Group by due date.
  const byDay = {}
  for (const p of pages) (byDay[p.due_date] ??= []).push(p)
  const days = Object.keys(byDay).sort()

  const monthLabel = format(parseISO(`${month}-01`), "MMMM yyyy")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display font-medium tracking-tight">Calendar</h1>
          <p className="text-small text-muted-foreground">
            Everything due across all dealers, by month. {pages.length} item
            {pages.length === 1 ? "" : "s"}.
          </p>
        </div>
        <CalendarControls
          month={month}
          monthLabel={monthLabel}
          amId={amId}
          accountManagers={ams ?? []}
        />
      </div>

      {days.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={`Nothing due in ${monthLabel}`}
          description={
            amId
              ? "No scheduled work for this AM this month. Try another month or clear the AM filter."
              : "No pages are scheduled this month. Try another month."
          }
        />
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <div key={day} className="space-y-2">
              <h3 className="text-small font-medium">
                {format(parseISO(day), "EEE, MMM d")}{" "}
                <span className="text-muted-foreground">({byDay[day].length})</span>
              </h3>
              <div className="grid gap-1.5">
                {byDay[day].map((p) => (
                  <Link
                    key={p.id}
                    href={`/dealers/${p.dealer_id}/pages/${p.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-small hover:bg-accent"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{p.dealers?.name}</span>
                      <span className="text-muted-foreground"> · </span>
                      {pageLabel({ page_type: p.page_templates?.page_type, model: p.model, pma_city: p.pma_city })}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {p.dealers?.account_managers?.name ? (
                        <span className="text-tiny text-muted-foreground">{p.dealers.account_managers.name}</span>
                      ) : null}
                      <StatusPill status={statusVariant(p.next_step ?? p.status)} label={p.next_step ?? p.status} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
