"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { savePmas } from "@/app/(app)/dealers/[id]/settings/actions"
import { SortableList, arrayMove } from "@/components/wizard/sortable-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

let uid = 0
const mkId = () => `pma-${uid++}`

export function PmasTab({ dealerId, pmas, primaryCity }) {
  const router = useRouter()
  const [items, setItems] = useState(() => pmas.map((p) => ({ id: mkId(), label: p.city })))
  const [primary, setPrimary] = useState(primaryCity ?? pmas[0]?.city ?? "")
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  function add() {
    const v = draft.trim()
    if (!v) return
    if (items.length >= 9) return toast.error("Up to 9 PMAs.")
    if (items.some((i) => i.label.toLowerCase() === v.toLowerCase()))
      return toast.error(`${v} is already added.`)
    setItems((prev) => [...prev, { id: mkId(), label: v }])
    setDraft("")
  }

  async function save() {
    const cities = items.map((i) => i.label)
    if (!cities.length) return toast.error("Add at least one PMA.")
    setSaving(true)
    const res = await savePmas(dealerId, cities, cities.includes(primary) ? primary : cities[0])
    setSaving(false)
    if (res?.error) return toast.error(res.error)
    toast.success("PMAs saved — pages re-scored.")
    router.refresh()
  }

  const cities = items.map((i) => i.label)

  return (
    <div className="grid max-w-xl gap-4">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add a city"
        />
        <Button type="button" onClick={add} disabled={items.length >= 9}>
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag to reorder by priority — top = highest mod score. {items.length}/9.
      </p>
      <SortableList
        items={items}
        onReorder={(from, to) => setItems((prev) => arrayMove(prev, from, to))}
        onRemove={(i) => setItems((prev) => prev.filter((_, idx) => idx !== i))}
      />
      <div className="grid gap-2">
        <Label>Primary PMA</Label>
        <Select value={primary || "none"} onValueChange={(v) => setPrimary(v === "none" ? "" : v)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select primary" />
          </SelectTrigger>
          <SelectContent>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save PMAs"}
        </Button>
      </div>
    </div>
  )
}
