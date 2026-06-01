"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO, isBefore, startOfToday } from "date-fns"

import { StatusPill, statusVariant } from "@/components/ui/status-pill"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { ListChecks } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL = "__all__"

// Next-step pills: Build = amber (build), Optimize = blue (strategy).
function nextVariant(step) {
  if (!step) return "backlog"
  const s = step.toLowerCase()
  if (s === "build") return "build"
  if (s === "optimize") return "strategy"
  return "backlog"
}

export function WorkQueue({ rows, accountManagers }) {
  const router = useRouter()
  const [filters, setFilters] = useState({
    dealer: ALL,
    am: ALL,
    next_step: ALL,
    status: ALL,
  })

  const today = startOfToday()

  const dealers = useMemo(
    () => [...new Set(rows.map((r) => r.dealer_name).filter(Boolean))].sort(),
    [rows]
  )
  const nextSteps = useMemo(
    () => [...new Set(rows.map((r) => r.next_step).filter(Boolean))].sort(),
    [rows]
  )
  const statuses = useMemo(
    () => [...new Set(rows.map((r) => r.status).filter(Boolean))].sort(),
    [rows]
  )

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filters.dealer !== ALL && r.dealer_name !== filters.dealer) return false
        if (filters.am !== ALL) {
          if (filters.am === "__none__" ? r.am_id : r.am_id !== filters.am) return false
        }
        if (filters.next_step !== ALL && r.next_step !== filters.next_step) return false
        if (filters.status !== ALL && r.status !== filters.status) return false
        return true
      }),
    [rows, filters]
  )

  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }))
  const overdueCount = filtered.filter(
    (r) => r.due_date && isBefore(parseISO(r.due_date), today)
  ).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.dealer} onValueChange={set("dealer")}>
          <SelectTrigger size="sm" className="w-auto min-w-44">
            <SelectValue placeholder="Dealer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All dealers</SelectItem>
            {dealers.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.am} onValueChange={set("am")}>
          <SelectTrigger size="sm" className="w-auto min-w-40">
            <SelectValue placeholder="Account manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All AMs</SelectItem>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {accountManagers.map((am) => (
              <SelectItem key={am.id} value={am.id}>
                {am.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.next_step} onValueChange={set("next_step")}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue placeholder="Next step" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any step</SelectItem>
            {nextSteps.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={set("status")}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ dealer: ALL, am: ALL, next_step: ALL, status: ALL })}
        >
          Clear
        </Button>

        <span className="ml-auto text-small text-muted-foreground">
          {filtered.length} page{filtered.length === 1 ? "" : "s"}
          {overdueCount ? ` · ${overdueCount} overdue` : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing in the queue"
          description="No pages match these filters. Clear them, or all active work is done."
          action={
            <Button
              variant="outline"
              onClick={() => setFilters({ dealer: ALL, am: ALL, next_step: ALL, status: ALL })}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dealer</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>AM</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const overdue = r.due_date && isBefore(parseISO(r.due_date), today)
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dealers/${r.dealer_id}/pages/${r.id}`)}
                  >
                    <TableCell className="font-medium">{r.dealer_name}</TableCell>
                    <TableCell>{r.page_label}</TableCell>
                    <TableCell className="text-muted-foreground">{r.am_name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusPill status={statusVariant(r.status)} label={r.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {r.priority_score != null ? Number(r.priority_score).toFixed(2) : "—"}
                    </TableCell>
                    <TableCell
                      className={
                        overdue
                          ? "font-mono tabular-nums text-status-error"
                          : "font-mono tabular-nums text-muted-foreground"
                      }
                    >
                      {r.due_date ? format(parseISO(r.due_date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {r.next_step ? (
                        <StatusPill status={nextVariant(r.next_step)} label={r.next_step} />
                      ) : (
                        <span className="text-muted-foreground/70">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
