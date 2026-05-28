"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { setFindingStatus } from "@/lib/actions/findings"
import { Button } from "@/components/ui/button"

/** Resolve / Ignore (when open) or Reopen (when resolved/ignored). */
export function FindingActions({ findingId, status }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function update(next) {
    startTransition(async () => {
      const res = await setFindingStatus(findingId, next)
      if (res?.error) toast.error(res.error)
      else router.refresh()
    })
  }

  if (status === "open") {
    return (
      <div className="flex gap-2">
        <Button size="xs" variant="outline" disabled={pending} onClick={() => update("resolved")}>
          Resolve
        </Button>
        <Button size="xs" variant="ghost" disabled={pending} onClick={() => update("ignored")}>
          Ignore
        </Button>
      </div>
    )
  }

  return (
    <Button size="xs" variant="ghost" disabled={pending} onClick={() => update("open")}>
      Reopen
    </Button>
  )
}
