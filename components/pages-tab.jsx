"use client"

import { useMemo, useState, useTransition, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, ExternalLink, RefreshCw } from "lucide-react"

import { exportPagesCsv, pushPagesToJira, syncDealerJira } from "@/app/(app)/dealers/[id]/actions"
import {
  updatePageFields,
  bulkBacklogPages,
  bulkApplyLabel,
} from "@/app/(app)/dealers/[id]/page-actions"
import { RegeneratePagesButton } from "@/components/regenerate-pages-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
const STATUS_OPTIONS = ["LIVE", "MISSING", "Strategy", "Available for Build", "Backlog"]
const NEXT_OPTIONS = ["Build", "Optimize", "Backlog"]
const cellCls =
  "w-full rounded border bg-transparent px-1.5 py-1 text-xs outline-none focus:border-ring"

function distinct(rows, key) {
  return [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort()
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-32" size="sm">
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

export function PagesTab({ dealerId, dealerName, pages, jiraConfigured = false }) {
  const router = useRouter()
  const [rows, setRows] = useState(pages)
  const [pushing, startPush] = useTransition()
  const [syncing, startSync] = useTransition()
  const [filters, setFilters] = useState({
    page_family: ALL,
    status: ALL,
    next_step: ALL,
    model: ALL,
    pma_city: ALL,
    label: ALL,
  })
  const [flags, setFlags] = useState({ notes: false, manualDue: false, adj: false })
  const [selected, setSelected] = useState(() => new Set())
  const [bulkLabel, setBulkLabel] = useState("")
  const [exporting, startExport] = useTransition()
  const [, startEdit] = useTransition()

  // Re-sync when server data changes (e.g. after regenerate / bulk).
  useEffect(() => setRows(pages), [pages])

  const options = useMemo(
    () => ({
      page_family: distinct(rows, "page_family"),
      status: distinct(rows, "status"),
      next_step: distinct(rows, "next_step"),
      model: distinct(rows, "model"),
      pma_city: distinct(rows, "pma_city"),
      label: [...new Set(rows.flatMap((r) => r.labels ?? []))].sort(),
    }),
    [rows]
  )

  const filtered = useMemo(
    () =>
      rows.filter((p) => {
        for (const k of ["page_family", "status", "next_step", "model", "pma_city"]) {
          if (filters[k] !== ALL && p[k] !== filters[k]) return false
        }
        if (filters.label !== ALL && !(p.labels ?? []).includes(filters.label)) return false
        if (flags.notes && !p.notes) return false
        if (flags.manualDue && !p.manually_scheduled_due_date) return false
        if (flags.adj && !Number(p.manual_priority_adjustment)) return false
        return true
      }),
    [rows, filters, flags]
  )

  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }))
  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) filtered.forEach((p) => next.delete(p.id))
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

  // Optimistic inline edit.
  function commit(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    startEdit(async () => {
      const res = await updatePageFields(id, patch)
      if (res?.error) {
        toast.error(res.error)
        router.refresh()
      } else if (res.priority_score != null) {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, priority_score: res.priority_score } : r))
        )
      }
    })
  }

  async function bulkBacklog() {
    const ids = [...selected]
    const res = await bulkBacklogPages(dealerId, ids)
    if (res?.error) return toast.error(res.error)
    toast.success(`Moved ${ids.length} page(s) to Backlog.`)
    setSelected(new Set())
    router.refresh()
  }

  async function applyLabel() {
    const ids = [...selected]
    const res = await bulkApplyLabel(dealerId, ids, bulkLabel)
    if (res?.error) return toast.error(res.error)
    toast.success(`Labeled ${ids.length} page(s).`)
    setBulkLabel("")
    router.refresh()
  }

  function exportCsv() {
    const ids = (selected.size ? filtered.filter((p) => selected.has(p.id)) : filtered).map((p) => p.id)
    startExport(async () => {
      const res = await exportPagesCsv(dealerId, ids)
      if (res?.error) return toast.error(res.error)
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${ids.length} page(s).`)
    })
  }

  function pushJira() {
    const ids = (selected.size ? filtered.filter((p) => selected.has(p.id)) : filtered).map((p) => p.id)
    startPush(async () => {
      const res = await pushPagesToJira(dealerId, ids)
      if (res?.error) return toast.error(res.error)
      toast.success(
        `Pushed ${res.created} to Jira` +
          (res.skipped ? ` · ${res.skipped} already linked` : "") +
          (res.failed ? ` · ${res.failed} failed` : "")
      )
      router.refresh()
    })
  }

  function syncJira() {
    startSync(async () => {
      const res = await syncDealerJira(dealerId)
      if (res?.error) return toast.error(res.error)
      toast.success(`Synced ${res.checked} from Jira · ${res.completed} completed`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Family" value={filters.page_family} onChange={setFilter("page_family")} options={options.page_family} />
        <FilterSelect label="Status" value={filters.status} onChange={setFilter("status")} options={options.status} />
        <FilterSelect label="Next" value={filters.next_step} onChange={setFilter("next_step")} options={options.next_step} />
        <FilterSelect label="Model" value={filters.model} onChange={setFilter("model")} options={options.model} />
        <FilterSelect label="PMA" value={filters.pma_city} onChange={setFilter("pma_city")} options={options.pma_city} />
        {options.label.length ? (
          <FilterSelect label="Label" value={filters.label} onChange={setFilter("label")} options={options.label} />
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <RegeneratePagesButton dealerId={dealerId} hasPages={rows.length > 0} />
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0 || exporting}>
            <Download />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
          {jiraConfigured ? (
            <>
              <Button size="sm" variant="outline" onClick={pushJira} disabled={filtered.length === 0 || pushing}>
                <ExternalLink />
                {pushing ? "Pushing…" : "Push to Jira"}
              </Button>
              <Button size="sm" variant="outline" onClick={syncJira} disabled={syncing}>
                <RefreshCw className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing…" : "Sync from Jira"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <Checkbox checked={flags.notes} onCheckedChange={(c) => setFlags((f) => ({ ...f, notes: !!c }))} />
          Has notes
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={flags.manualDue} onCheckedChange={(c) => setFlags((f) => ({ ...f, manualDue: !!c }))} />
          Manual due date
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={flags.adj} onCheckedChange={(c) => setFlags((f) => ({ ...f, adj: !!c }))} />
          Adjusted priority
        </label>
        <span className="ml-auto">
          {filtered.length} of {rows.length}
          {selected.size ? ` · ${selected.size} selected` : ""}
        </span>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="xs" variant="outline" onClick={bulkBacklog}>
            Mark as Backlog
          </Button>
          <div className="flex items-center gap-1">
            <Input
              value={bulkLabel}
              onChange={(e) => setBulkLabel(e.target.value)}
              placeholder="label"
              className="h-7 w-32"
            />
            <Button size="xs" variant="outline" onClick={applyLabel} disabled={!bulkLabel.trim()}>
              Apply label
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Page type</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>PMA</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-28">Next</TableHead>
              <TableHead className="text-right">Priority</TableHead>
              <TableHead className="w-20">Adj</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="w-36">Manual due</TableHead>
              <TableHead className="min-w-48">URL</TableHead>
              <TableHead>Labels</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  No pages match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/dealers/${dealerId}/pages/${p.id}`} className="hover:underline">
                      {p.page_type}
                    </Link>
                    {p.notes ? <span className="ml-1 text-muted-foreground" title="Has notes">•</span> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.model ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.pma_city ?? "—"}</TableCell>
                  <TableCell>
                    <select
                      className={cellCls}
                      value={p.status}
                      onChange={(e) => commit(p.id, { status: e.target.value })}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <select
                      className={cellCls}
                      value={p.next_step ?? ""}
                      onChange={(e) => commit(p.id, { next_step: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {NEXT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.priority_score != null ? Number(p.priority_score).toFixed(2) : "—"}
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      step="0.1"
                      className={cellCls}
                      defaultValue={p.manual_priority_adjustment ?? 0}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value) || 0
                        if (v !== Number(p.manual_priority_adjustment)) commit(p.id, { manual_priority_adjustment: v })
                      }}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{p.due_date ?? "—"}</TableCell>
                  <TableCell>
                    <input
                      type="date"
                      className={cellCls}
                      defaultValue={p.manually_scheduled_due_date ?? ""}
                      onChange={(e) => commit(p.id, { manually_scheduled_due_date: e.target.value || null })}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      className={cellCls}
                      defaultValue={p.url ?? ""}
                      placeholder="https://…"
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v !== (p.url ?? "")) commit(p.id, { url: v || null })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(p.labels ?? []).map((l) => (
                        <Badge key={l} variant="secondary" className="text-xs">
                          {l}
                        </Badge>
                      ))}
                    </div>
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
