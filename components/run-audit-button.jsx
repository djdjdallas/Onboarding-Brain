"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Triggers POST /api/audit/[dealerId], then refreshes so new findings show. */
export function RunAuditButton({ dealerId }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    try {
      const res = await fetch(`/api/audit/${dealerId}`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Audit failed.")
        return
      }
      toast.success(
        `Audited ${data.pagesChecked} live page${data.pagesChecked === 1 ? "" : "s"} · ${data.errorsFound} finding${data.errorsFound === 1 ? "" : "s"}.`
      )
      router.refresh()
    } catch (e) {
      toast.error(String(e?.message ?? e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={running}>
      <RefreshCw className={running ? "animate-spin" : ""} />
      {running ? "Auditing…" : "Run audit"}
    </Button>
  )
}
