"use client"

import { useMemo, useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

const ALL = "__all__"

function fmtValue(v) {
  if (v == null) return "—"
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export function HistoryTab({ entries }) {
  const [field, setField] = useState(ALL)
  const [actor, setActor] = useState(ALL)

  const fields = useMemo(
    () => [...new Set(entries.map((e) => e.field_name).filter(Boolean))].sort(),
    [entries]
  )
  const actors = useMemo(
    () => [...new Set(entries.map((e) => e.actor_name).filter(Boolean))].sort(),
    [entries]
  )

  const filtered = entries.filter(
    (e) => (field === ALL || e.field_name === field) && (actor === ALL || e.actor_name === actor)
  )

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={field} onValueChange={setField}>
          <SelectTrigger size="sm" className="w-auto min-w-40">
            <SelectValue placeholder="Field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Field: All</SelectItem>
            {fields.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger size="sm" className="w-auto min-w-40">
            <SelectValue placeholder="Who" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Who: All</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        {filtered.map((e) => (
          <div key={e.id} className="rounded-md border px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                <Badge variant="outline" className="mr-2">
                  {e.entity_type}
                </Badge>
                {e.field_name ?? "created"}
              </span>
              <span className="text-xs text-muted-foreground">
                {e.actor_name ?? "system"} ·{" "}
                {String(e.changed_at ?? "").slice(0, 16).replace("T", " ")} UTC
              </span>
            </div>
            {e.field_name && e.field_name !== "__created" ? (
              <div className="mt-1 text-xs text-muted-foreground">
                <span className="line-through">{fmtValue(e.old_value)}</span>
                {" → "}
                <span className="text-foreground">{fmtValue(e.new_value)}</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
