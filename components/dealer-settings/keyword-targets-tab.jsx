"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { saveKeywordTargets } from "@/app/(app)/dealers/[id]/settings/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

const cellKey = (kid, pid) => `${kid}|${pid}`

export function KeywordTargetsTab({ dealerId, keywords, pmas, targeted }) {
  const router = useRouter()
  const [set, setSet] = useState(() => new Set(targeted))
  const [saving, setSaving] = useState(false)

  const total = keywords.length * pmas.length
  const active = useMemo(() => {
    let n = 0
    for (const k of keywords) for (const p of pmas) if (set.has(cellKey(k.id, p.id))) n++
    return n
  }, [set, keywords, pmas])

  function mutate(fn) {
    setSet((prev) => {
      const next = new Set(prev)
      fn(next)
      return next
    })
  }
  const toggle = (kid, pid) =>
    mutate((s) => (s.has(cellKey(kid, pid)) ? s.delete(cellKey(kid, pid)) : s.add(cellKey(kid, pid))))
  const selectRow = (kid) => mutate((s) => pmas.forEach((p) => s.add(cellKey(kid, p.id))))
  const selectCol = (pid) => mutate((s) => keywords.forEach((k) => s.add(cellKey(k.id, pid))))
  const invert = () =>
    mutate((s) => {
      for (const k of keywords)
        for (const p of pmas) {
          const key = cellKey(k.id, p.id)
          s.has(key) ? s.delete(key) : s.add(key)
        }
    })

  async function save() {
    const cells = []
    for (const k of keywords)
      for (const p of pmas)
        cells.push({ keyword_id: k.id, pma_id: p.id, is_targeted: set.has(cellKey(k.id, p.id)) })
    setSaving(true)
    const res = await saveKeywordTargets(dealerId, cells)
    setSaving(false)
    if (res?.error) return toast.error(res.error)
    toast.success("Keyword targets saved.")
    router.refresh()
  }

  if (keywords.length === 0 || pmas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {keywords.length === 0
          ? "No keywords yet — seed or add them in Admin → Keywords."
          : "Add PMAs first."}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {active} of {total} keyword × PMA targets active
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={invert}>
            Invert
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save targets"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="text-sm">
          <thead>
            <tr className="border-b">
              <th className="sticky left-0 bg-background px-3 py-2 text-left font-medium">
                Keyword
              </th>
              {pmas.map((p) => (
                <th key={p.id} className="px-2 py-2 text-center font-medium">
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => selectCol(p.id)}
                    title="Select all in column"
                  >
                    {p.city}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keywords.map((k) => (
              <tr key={k.id} className="border-b last:border-0">
                <td className="sticky left-0 bg-background px-3 py-1.5 whitespace-nowrap">
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => selectRow(k.id)}
                    title="Select all in row"
                  >
                    {k.keyword}
                  </button>
                </td>
                {pmas.map((p) => (
                  <td key={p.id} className="px-2 py-1.5 text-center">
                    <Checkbox
                      checked={set.has(cellKey(k.id, p.id))}
                      onCheckedChange={() => toggle(k.id, p.id)}
                      aria-label={`${k.keyword} in ${p.city}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
