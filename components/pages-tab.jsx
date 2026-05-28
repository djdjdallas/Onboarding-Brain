"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Download } from "lucide-react"

import { exportPagesCsv } from "@/app/(app)/dealers/[id]/actions"
import { RegeneratePagesButton } from "@/components/regenerate-pages-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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

const STATUS_VARIANT = {
  LIVE: "default",
  MISSING: "outline",
  Backlog: "secondary",
  Strategy: "secondary",
  "Available for Build": "outline",
}

// Distinct, sorted, non-null values for a key — used to build filter options.
function distinct(rows, key) {
  return [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort()
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-36" size="sm">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: All</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function PagesTab({ dealerId, dealerName, pages }) {
  const [filters, setFilters] = useState({
    page_family: ALL,
    status: ALL,
    next_step: ALL,
    model: ALL,
    pma_city: ALL,
  })
  const [selected, setSelected] = useState(() => new Set())
  const [exporting, startExport] = useTransition()

  const options = useMemo(
    () => ({
      page_family: distinct(pages, "page_family"),
      status: distinct(pages, "status"),
      next_step: distinct(pages, "next_step"),
      model: distinct(pages, "model"),
      pma_city: distinct(pages, "pma_city"),
    }),
    [pages]
  )

  const filtered = useMemo(
    () =>
      pages.filter((p) =>
        Object.entries(filters).every(
          ([k, v]) => v === ALL || p[k] === v
        )
      ),
    [pages, filters]
  )

  const setFilter = (key) => (value) =>
    setFilters((f) => ({ ...f, [key]: value }))

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id))
      else filtered.forEach((p) => next.add(p.id))
      return next
    })
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function clearFilters() {
    setFilters({
      page_family: ALL,
      status: ALL,
      next_step: ALL,
      model: ALL,
      pma_city: ALL,
    })
  }

  // Jira-format CSV, built server-side (keeps long descriptions off the client).
  // Exports the selected rows, or all filtered rows if none are selected.
  function exportCsv() {
    const ids = (selected.size
      ? filtered.filter((p) => selected.has(p.id))
      : filtered
    ).map((p) => p.id)

    startExport(async () => {
      const res = await exportPagesCsv(dealerId, ids)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${ids.length} page${ids.length === 1 ? "" : "s"}.`)
    })
  }

  const hasFilters = Object.values(filters).some((v) => v !== ALL)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Family" value={filters.page_family} onChange={setFilter("page_family")} options={options.page_family} />
        <FilterSelect label="Status" value={filters.status} onChange={setFilter("status")} options={options.status} />
        <FilterSelect label="Next step" value={filters.next_step} onChange={setFilter("next_step")} options={options.next_step} />
        <FilterSelect label="Model" value={filters.model} onChange={setFilter("model")} options={options.model} />
        <FilterSelect label="PMA" value={filters.pma_city} onChange={setFilter("pma_city")} options={options.pma_city} />
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <RegeneratePagesButton dealerId={dealerId} hasPages={pages.length > 0} />
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0 || exporting}
          >
            <Download />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} of {pages.length} pages
        {selected.size ? ` · ${selected.size} selected` : ""}
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Page type</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>PMA</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next step</TableHead>
              <TableHead className="text-right">Priority</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No pages match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleOne(p.id)}
                      aria-label={`Select ${p.page_type}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{p.page_type}</TableCell>
                  <TableCell className="text-muted-foreground">{p.model ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.pma_city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status] ?? "outline"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.next_step ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.priority_score != null ? Number(p.priority_score).toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {p.due_date ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" className="underline">
                        {p.url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
