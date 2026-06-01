"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Upload } from "lucide-react"

import {
  createKeyword,
  bulkImportKeywords,
  setKeywordActive,
} from "@/app/(app)/admin/keywords/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export function KeywordsTable({ keywords }) {
  const router = useRouter()
  const [showInactive, setShowInactive] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [addForm, setAddForm] = useState({ oem: "KIA", keyword: "" })
  const [importForm, setImportForm] = useState({ oem: "KIA", text: "" })
  const [busy, setBusy] = useState(false)

  const visible = keywords.filter((k) => showInactive || k.is_active)
  const byOem = {}
  for (const k of visible) (byOem[k.oem] ??= []).push(k)

  async function submitAdd(e) {
    e.preventDefault()
    setBusy(true)
    const res = await createKeyword(addForm)
    setBusy(false)
    if (res?.error) return toast.error(res.error)
    toast.success("Keyword added.")
    setAddForm({ oem: addForm.oem, keyword: "" })
    setAddOpen(false)
    router.refresh()
  }

  async function submitImport(e) {
    e.preventDefault()
    setBusy(true)
    const res = await bulkImportKeywords(importForm)
    setBusy(false)
    if (res?.error) return toast.error(res.error)
    toast.success(`Imported ${res.count} keyword(s).`)
    setImportForm({ oem: importForm.oem, text: "" })
    setImportOpen(false)
    router.refresh()
  }

  async function toggleActive(k) {
    const res = await setKeywordActive(k.id, !k.is_active)
    if (res?.error) toast.error(res.error)
    else {
      toast.success(k.is_active ? "Deactivated." : "Reactivated.")
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showInactive} onCheckedChange={(c) => setShowInactive(!!c)} />
          Show inactive
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            Bulk import
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus />
            Add keyword
          </Button>
        </div>
      </div>

      {Object.keys(byOem).length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-small text-muted-foreground">
          No keywords. Run <code>npm run seed:keywords</code>, bulk-import, or add one.
        </p>
      ) : (
        Object.entries(byOem)
          .sort()
          .map(([oem, rows]) => (
            <div key={oem} className="space-y-2">
              <h3 className="text-sm font-medium">
                {oem} <span className="text-muted-foreground">({rows.length})</span>
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Dealers targeting</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((k) => (
                      <TableRow key={k.id} className={k.is_active ? "" : "opacity-60"}>
                        <TableCell className="font-medium">{k.keyword}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {k.target_count}
                        </TableCell>
                        <TableCell>
                          <Badge variant={k.is_active ? "default" : "outline"}>
                            {k.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="xs" variant="ghost" onClick={() => toggleActive(k)}>
                            {k.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))
      )}

      {/* Add */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add keyword</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAdd} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="kw-oem">OEM</Label>
              <Input
                id="kw-oem"
                value={addForm.oem}
                onChange={(e) => setAddForm((f) => ({ ...f, oem: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kw-name">Keyword</Label>
              <Input
                id="kw-name"
                value={addForm.keyword}
                onChange={(e) => setAddForm((f) => ({ ...f, keyword: e.target.value }))}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk import keywords</DialogTitle>
            <DialogDescription>
              One per line (or comma-separated). Duplicates are skipped.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitImport} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="imp-oem">OEM</Label>
              <Input
                id="imp-oem"
                value={importForm.oem}
                onChange={(e) => setImportForm((f) => ({ ...f, oem: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="imp-text">Keywords</Label>
              <Textarea
                id="imp-text"
                rows={8}
                value={importForm.text}
                onChange={(e) => setImportForm((f) => ({ ...f, text: e.target.value }))}
                placeholder={"kia dealer near me\nkia service\nkia lease deals"}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Importing…" : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
