"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  previewEligibilityChange,
  saveEligibility,
} from "@/app/(app)/dealers/[id]/settings/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const GROUP_ORDER = ["Departments", "Inventory", "Languages", "Programs", "Other"]

export function EligibilityTab({ dealerId, flagTypes, values }) {
  const router = useRouter()
  const [flags, setFlags] = useState(values)
  const [preview, setPreview] = useState(null) // null | {toBacklog, toActivate}
  const [busy, setBusy] = useState(false)

  const groups = {}
  for (const f of flagTypes) (groups[f.ui_group ?? "Other"] ??= []).push(f)

  function toggle(key) {
    setFlags((f) => ({ ...f, [key]: !f[key] }))
  }

  async function review() {
    setBusy(true)
    const res = await previewEligibilityChange(dealerId, flags)
    setBusy(false)
    if (res?.error) return toast.error(res.error)
    setPreview(res)
  }

  async function apply() {
    setBusy(true)
    const res = await saveEligibility(dealerId, flags)
    setBusy(false)
    setPreview(null)
    if (res?.error) return toast.error(res.error)
    toast.success(
      `Saved · ${res.backlogged ?? 0} template(s) backlogged, ${res.activated ?? 0} activated.`
    )
    router.refresh()
  }

  return (
    <div className="grid gap-6">
      {GROUP_ORDER.filter((g) => groups[g]).map((g) => (
        <div key={g} className="space-y-2">
          <h3 className="text-sm font-medium">{g}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {groups[g].map((f) => (
              <label
                key={f.key}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <Checkbox checked={!!flags[f.key]} onCheckedChange={() => toggle(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div>
        <Button onClick={review} disabled={busy}>
          {busy ? "Checking…" : "Review & save"}
        </Button>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply eligibility changes?</DialogTitle>
            <DialogDescription>
              {preview?.toBacklog
                ? `${preview.toBacklog} page(s) will move to Backlog. `
                : ""}
              {preview?.toActivate
                ? `${preview.toActivate} page(s) will be created or restored. `
                : ""}
              {!preview?.toBacklog && !preview?.toActivate
                ? "No page transitions — only the flag values change."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={busy}>
              {busy ? "Applying…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
