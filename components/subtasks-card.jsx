"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { generatePageSubtasks, setSubtaskStatus } from "@/app/(app)/dealers/[id]/page-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const STATUSES = ["open", "in_progress", "done"]
const cellCls =
  "rounded-md border border-border bg-transparent px-2 py-1 text-small outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"

export function SubtasksCard({ dealerId, pageId, subtasks }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function generate() {
    setBusy(true)
    const res = await generatePageSubtasks(dealerId, pageId)
    setBusy(false)
    if (res?.error) return toast.error(res.error)
    toast.success(res.created ? `Generated ${res.created} subtasks.` : "Subtasks already exist.")
    router.refresh()
  }

  async function setStatus(subtaskId, status) {
    const res = await setSubtaskStatus(dealerId, pageId, subtaskId, status)
    if (res?.error) toast.error(res.error)
    else router.refresh()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Subtasks ({subtasks.length})</CardTitle>
          <CardDescription>Auto-generated when the page moves to Optimize.</CardDescription>
        </div>
        {subtasks.length === 0 ? (
          <Button size="sm" variant="outline" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate subtasks"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {subtasks.length === 0 ? (
          <span className="text-muted-foreground">None yet.</span>
        ) : (
          subtasks.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 border-b pb-1.5 last:border-0">
              <div className="min-w-0">
                <p className="truncate">{s.summary}</p>
                {s.owner ? <p className="text-xs text-muted-foreground">{s.owner}</p> : null}
              </div>
              <select className={cellCls} value={s.status} onChange={(e) => setStatus(s.id, e.target.value)}>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
