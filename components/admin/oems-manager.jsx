"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { createOem, setOemModels, deleteOem } from "@/app/(app)/admin/oems/actions"
import { TagInput } from "@/components/admin/tag-input"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** One OEM card with an editable model list. */
function OemCard({ oem }) {
  const router = useRouter()
  const [models, setModels] = useState(oem.models)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(models) !== JSON.stringify(oem.models)

  async function save() {
    setSaving(true)
    const res = await setOemModels(oem.name, models)
    setSaving(false)
    if (res?.error) return toast.error(res.error)
    toast.success("Models saved.")
    router.refresh()
  }

  async function remove() {
    const res = await deleteOem(oem.name)
    if (res?.error) return toast.error(res.error)
    toast.success(`${oem.name} deleted.`)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">
            {oem.label ?? oem.name}{" "}
            <span className="font-mono text-xs text-muted-foreground">{oem.name}</span>
          </CardTitle>
          <CardDescription>{oem.dealer_count} dealer(s)</CardDescription>
        </div>
        <ConfirmDialog
          trigger={
            <Button size="xs" variant="ghost" className="text-destructive">
              Delete
            </Button>
          }
          title={`Delete ${oem.name}?`}
          description="Allowed only if no dealers use this OEM."
          confirmLabel="Delete"
          confirmVariant="destructive"
          onConfirm={remove}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <Label>Models (priority order)</Label>
        <TagInput value={models} onChange={setModels} placeholder="Add a model and press Enter" />
        {dirty ? (
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save models"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function OemsManager({ oems }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: "", label: "" })
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    setBusy(true)
    const res = await createOem(form)
    setBusy(false)
    if (res?.error) return toast.error(res.error)
    toast.success("OEM added.")
    setForm({ name: "", label: "" })
    setAddOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus />
          Add OEM
        </Button>
      </div>

      {oems.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No OEMs. Add one to enable onboarding dealers for that brand.
        </p>
      ) : (
        <div className="grid gap-4">
          {oems.map((o) => (
            <OemCard key={o.name} oem={o} />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add OEM</DialogTitle>
          </DialogHeader>
          <form onSubmit={add} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="oem-name">Code</Label>
              <Input
                id="oem-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="HONDA"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Uppercase code stored on dealers/templates (e.g. HONDA).
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oem-label">Label</Label>
              <Input
                id="oem-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Honda"
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
    </div>
  )
}
