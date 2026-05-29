"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { updatePageFields } from "@/app/(app)/dealers/[id]/page-actions"
import { TagInput } from "@/components/admin/tag-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STATUS_OPTIONS = ["LIVE", "MISSING", "Strategy", "Available for Build", "Backlog"]
const NEXT_OPTIONS = ["Build", "Optimize", "Backlog"]

export function PageDetailForm({ pageId, page }) {
  const router = useRouter()
  const [form, setForm] = useState({
    url: page.url ?? "",
    status: page.status,
    next_step: page.next_step ?? "",
    manual_priority_adjustment: page.manual_priority_adjustment ?? 0,
    manually_scheduled_due_date: page.manually_scheduled_due_date ?? "",
    notes: page.notes ?? "",
    labels: page.labels ?? [],
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    const res = await updatePageFields(pageId, {
      url: form.url.trim() || null,
      status: form.status,
      next_step: form.next_step || null,
      manual_priority_adjustment: parseFloat(form.manual_priority_adjustment) || 0,
      manually_scheduled_due_date: form.manually_scheduled_due_date || null,
      notes: form.notes.trim() || null,
      labels: form.labels,
    })
    setSaving(false)
    if (res?.error) return toast.error(res.error)
    toast.success("Page saved.")
    router.refresh()
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="p-url">URL</Label>
        <Input id="p-url" value={form.url} onChange={(e) => set("url")(e.target.value)} placeholder="https://…" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={set("status")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Next step</Label>
          <Select value={form.next_step || "none"} onValueChange={(v) => set("next_step")(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {NEXT_OPTIONS.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="p-adj">Manual priority adjustment</Label>
          <Input
            id="p-adj"
            type="number"
            step="0.1"
            value={form.manual_priority_adjustment}
            onChange={(e) => set("manual_priority_adjustment")(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="p-due">Manual due date</Label>
          <Input
            id="p-due"
            type="date"
            value={form.manually_scheduled_due_date}
            onChange={(e) => set("manually_scheduled_due_date")(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="p-notes">Notes</Label>
        <Textarea id="p-notes" rows={4} value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label>Labels</Label>
        <TagInput value={form.labels} onChange={set("labels")} />
      </div>
      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save page"}
        </Button>
      </div>
    </div>
  )
}
