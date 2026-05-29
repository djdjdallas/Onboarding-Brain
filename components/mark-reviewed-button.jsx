"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"

import { markPageReviewed } from "@/app/(app)/dealers/[id]/page-actions"
import { Button } from "@/components/ui/button"

/** Marks the page reviewed today; cadence sets the next due date. */
export function MarkReviewedButton({ dealerId, pageId }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    const res = await markPageReviewed(dealerId, pageId)
    setBusy(false)
    if (res?.error) return toast.error(res.error)
    toast.success(res.due_date ? `Reviewed — next due ${res.due_date}.` : "Marked reviewed.")
    router.refresh()
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy}>
      <CheckCircle2 />
      {busy ? "Saving…" : "Mark reviewed today"}
    </Button>
  )
}
