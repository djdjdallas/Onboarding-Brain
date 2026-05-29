"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  acceptDiscoveredPage,
  dismissDiscoveredPage,
  flagDiscoveredPage,
  bulkDismissDiscovered,
} from "@/app/(app)/dealers/[id]/discovered-actions"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL = "__all__"
const DISC_VARIANT = { open: "error", accepted: "live", dismissed: "backlog", flagged: "strategy" }

export function DiscoveredTab({ dealerId, discovered, templates, models, pmas }) {
  const router = useRouter()
  const tplById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])
  const [statusFilter, setStatusFilter] = useState("open")
  const [minConf, setMinConf] = useState(ALL)
  const [selected, setSelected] = useState(() => new Set())
  const [accept, setAccept] = useState(null) // {row, templateId, model, pma_city}
  const [flag, setFlag] = useState(null) // {row, notes}
  const [busy, setBusy] = useState(false)

  const filtered = discovered.filter((d) => {
    if (statusFilter !== ALL && d.status !== statusFilter) return false
    if (minConf !== ALL && (d.suggested_confidence ?? 0) < Number(minConf)) return false
    return true
  })

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function openAccept(row) {
    setAccept({ row, templateId: row.suggested_template_id ?? "", model: "", pma_city: "" })
  }

  async function doAccept() {
    setBusy(true)
    const res = await acceptDiscoveredPage(dealerId, accept.row.id, {
      templateId: accept.templateId,
      model: accept.model || null,
      pma_city: accept.pma_city || null,
    })
    setBusy(false)
    if (res?.error) return toast.error(res.error)
    toast.success("Accepted — page created.")
    setAccept(null)
    router.refresh()
  }

  async function doDismiss(row) {
    const res = await dismissDiscoveredPage(dealerId, row.id)
    if (res?.error) return toast.error(res.error)
    toast.success("Dismissed.")
    router.refresh()
  }

  async function doFlag() {
    setBusy(true)
    const res = await flagDiscoveredPage(dealerId, flag.row.id, flag.notes)
    setBusy(false)
    if (res?.error) return toast.error(res.error)
    toast.success("Flagged for strategist.")
    setFlag(null)
    router.refresh()
  }

  async function doBulkDismiss() {
    const ids = [...selected]
    const res = await bulkDismissDiscovered(dealerId, ids)
    if (res?.error) return toast.error(res.error)
    toast.success(`Dismissed ${ids.length}.`)
    setSelected(new Set())
    router.refresh()
  }

  const acceptTpl = accept ? tplById.get(accept.templateId) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Status: All</SelectItem>
            {["open", "accepted", "dismissed", "flagged"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={minConf} onValueChange={setMinConf}>
          <SelectTrigger size="sm" className="w-auto min-w-40">
            <SelectValue placeholder="Confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any confidence</SelectItem>
            <SelectItem value="0.5">≥ 50%</SelectItem>
            <SelectItem value="0.8">≥ 80%</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-small text-muted-foreground">{filtered.length} pages</span>
        {selected.size ? (
          <Button size="sm" variant="outline" className="ml-auto" onClick={doBulkDismiss}>
            Dismiss {selected.size}
          </Button>
        ) : null}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>URL</TableHead>
              <TableHead>First seen</TableHead>
              <TableHead>Suggested template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nothing here. Run an audit to discover unplanned pages from the sitemap.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggle(d.id)} />
                  </TableCell>
                  <TableCell className="max-w-72 truncate">
                    <a href={d.url} target="_blank" rel="noreferrer" className="font-mono text-tiny underline">
                      {d.url}
                    </a>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {String(d.first_seen_at ?? "").slice(0, 10)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.suggested_template_id ? (
                      <>
                        {tplById.get(d.suggested_template_id)?.page_type ?? "—"}
                        {d.suggested_confidence != null ? (
                          <span className="ml-1 text-xs">({Math.round(d.suggested_confidence * 100)}%)</span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={DISC_VARIANT[d.status] ?? "backlog"} label={d.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {d.status === "open" || d.status === "flagged" ? (
                      <div className="flex justify-end gap-2">
                        <Button size="xs" variant="outline" onClick={() => openAccept(d)}>
                          Accept
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setFlag({ row: d, notes: d.notes ?? "" })}>
                          Flag
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => doDismiss(d)}>
                          Dismiss
                        </Button>
                      </div>
                    ) : (
                      <span className="text-tiny text-muted-foreground">reviewed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Accept dialog */}
      <Dialog open={!!accept} onOpenChange={(o) => !o && setAccept(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept as a page</DialogTitle>
          </DialogHeader>
          {accept ? (
            <div className="grid gap-4">
              <p className="truncate text-sm text-muted-foreground">{accept.row.url}</p>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Template</label>
                <Select
                  value={accept.templateId || "none"}
                  onValueChange={(v) => setAccept((a) => ({ ...a, templateId: v === "none" ? "" : v, model: "", pma_city: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.page_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {acceptTpl?.requires_model ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Model</label>
                  <Select value={accept.model || "none"} onValueChange={(v) => setAccept((a) => ({ ...a, model: v === "none" ? "" : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {models.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {acceptTpl?.requires_pma ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">PMA</label>
                  <Select value={accept.pma_city || "none"} onValueChange={(v) => setAccept((a) => ({ ...a, pma_city: v === "none" ? "" : v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a PMA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {pmas.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccept(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doAccept} disabled={busy || !accept?.templateId}>
              {busy ? "Creating…" : "Accept & create page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag dialog */}
      <Dialog open={!!flag} onOpenChange={(o) => !o && setFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag for strategist</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={4}
            value={flag?.notes ?? ""}
            onChange={(e) => setFlag((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Why does this need a strategist's eyes?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlag(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={doFlag} disabled={busy}>
              {busy ? "Saving…" : "Flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
