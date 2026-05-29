"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
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

/**
 * Edit-only editor for a small, closed set of reference rows (cadence rules,
 * package tiers). Renders each row as a card with an Edit dialog. Server
 * actions validate; client surfaces errors via toast.
 *
 * Props are all serializable (no functions except the server `action`):
 *   items     — rows, each with `id`, a `_badge` string, and the field values
 *   titleField — which field is the card heading
 *   fields    — [{ name, label, type: 'int'|'text'|'textarea' }]
 *   action    — server action (id, values) => { ok } | { error }
 */
export function ReferenceEditor({ items, titleField, fields, action }) {
  const router = useRouter()
  const [editing, setEditing] = useState(null)
  const form = useForm()

  function openEdit(item) {
    const values = {}
    for (const f of fields) values[f.name] = item[f.name] ?? ""
    form.reset(values)
    setEditing(item)
  }

  async function onSubmit(values) {
    const res = await action(editing.id, values)
    if (res?.error) return toast.error(res.error)
    toast.success("Saved.")
    setEditing(null)
    router.refresh()
  }

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base">{item[titleField]}</CardTitle>
              {item._badge ? (
                <Badge variant="outline">{item._badge}</Badge>
              ) : null}
            </div>
            <Button size="xs" variant="outline" onClick={() => openEdit(item)}>
              Edit
            </Button>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {fields.map((f) => {
              const v = item[f.name]
              if (v == null || v === "") return null
              return (
                <div key={f.name} className="grid grid-cols-[10rem_1fr] gap-2">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="whitespace-pre-wrap">{String(v)}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editing?.[titleField]}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            {fields.map((f) => (
              <div key={f.name} className="grid gap-2">
                <Label htmlFor={f.name}>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea id={f.name} rows={3} {...form.register(f.name)} />
                ) : (
                  <Input
                    id={f.name}
                    type={f.type === "int" ? "number" : "text"}
                    {...form.register(f.name)}
                  />
                )}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
