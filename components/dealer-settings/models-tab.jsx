"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { saveModels } from "@/app/(app)/dealers/[id]/settings/actions"
import { KIA_MODELS } from "@/lib/eligibility"
import { SortableList, arrayMove } from "@/components/wizard/sortable-list"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

let uid = 0
const mkId = () => `mdl-${uid++}`

export function ModelsTab({ dealerId, models }) {
  const router = useRouter()
  const [items, setItems] = useState(() =>
    models.map((m) => ({ id: mkId(), label: m.model, model: m.model, tracked: m.tracked !== false }))
  )
  const [saving, setSaving] = useState(false)

  const added = new Set(items.map((i) => i.model))

  function addModel(model) {
    if (items.length >= 9) return toast.error("Up to 9 models.")
    if (added.has(model)) return
    setItems((prev) => [...prev, { id: mkId(), label: model, model, tracked: true }])
  }

  function setTracked(id, tracked) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, tracked } : i)))
  }

  async function save() {
    const list = items.map((i) => ({ model: i.model, tracked: i.tracked }))
    if (!list.length) return toast.error("Add at least one model.")
    setSaving(true)
    const res = await saveModels(dealerId, list)
    setSaving(false)
    if (res?.error) return toast.error(res.error)
    toast.success("Models saved — pages re-scored.")
    router.refresh()
  }

  return (
    <div className="grid max-w-xl gap-4">
      <div className="flex flex-wrap gap-2">
        {KIA_MODELS.map((m) => (
          <Button
            key={m}
            type="button"
            size="sm"
            variant="outline"
            disabled={added.has(m) || items.length >= 9}
            onClick={() => addModel(m)}
          >
            {m}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Drag to reorder. &quot;Tracked&quot; flags the model for cross-dealer reports. {items.length}/9.
      </p>
      <SortableList
        items={items}
        onReorder={(from, to) => setItems((prev) => arrayMove(prev, from, to))}
        onRemove={(i) => setItems((prev) => prev.filter((_, idx) => idx !== i))}
        renderAccessory={(item) => (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={item.tracked}
              onCheckedChange={(c) => setTracked(item.id, !!c)}
            />
            Tracked
          </label>
        )}
      />
      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save models"}
        </Button>
      </div>
    </div>
  )
}
