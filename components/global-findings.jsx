"use client"

import { useMemo, useState } from "react"

import {
  FINDING_TYPE_LABELS,
  findingDetail,
  findingUrl,
} from "@/lib/findings"
import { FindingActions } from "@/components/finding-actions"
import { StatusPill, statusVariant } from "@/components/ui/status-pill"
import { Button } from "@/components/ui/button"
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
const STATUSES = ["open", "resolved", "ignored"]

export function GlobalFindings({ findings }) {
  // Default to the open work — that's what an AM cares about first.
  const [filters, setFilters] = useState({
    dealer_name: ALL,
    finding_type: ALL,
    status: "open",
  })

  const dealers = useMemo(
    () => [...new Set(findings.map((f) => f.dealer_name).filter(Boolean))].sort(),
    [findings]
  )
  const types = useMemo(
    () => [...new Set(findings.map((f) => f.finding_type))].sort(),
    [findings]
  )

  const filtered = findings.filter(
    (f) =>
      (filters.dealer_name === ALL || f.dealer_name === filters.dealer_name) &&
      (filters.finding_type === ALL || f.finding_type === filters.finding_type) &&
      (filters.status === ALL || f.status === filters.status)
  )

  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.dealer_name} onValueChange={set("dealer_name")}>
          <SelectTrigger className="w-auto min-w-44" size="sm">
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

        <Select value={filters.finding_type} onValueChange={set("finding_type")}>
          <SelectTrigger className="w-auto min-w-40" size="sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {FINDING_TYPE_LABELS[t] ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={set("status")}>
          <SelectTrigger className="w-auto min-w-32" size="sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ dealer_name: ALL, finding_type: ALL, status: ALL })}
        >
          Clear
        </Button>
        <span className="ml-auto text-small text-muted-foreground">
          {filtered.length} finding{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dealer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-small text-muted-foreground">
                  No findings match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((f) => {
                const url = findingUrl(f)
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.dealer_name ?? "—"}</TableCell>
                    <TableCell>{FINDING_TYPE_LABELS[f.finding_type] ?? f.finding_type}</TableCell>
                    <TableCell className="text-muted-foreground">{findingDetail(f)}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="font-mono text-tiny underline">
                          {url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={statusVariant(f.status)} label={f.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <FindingActions findingId={f.id} status={f.status} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
