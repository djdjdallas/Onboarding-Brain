"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import { regenerateDealerPages } from "@/app/(app)/dealers/[id]/actions"
import { Button } from "@/components/ui/button"

export function RegeneratePagesButton({ dealerId, hasPages }) {
  const [pending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      const res = await regenerateDealerPages(dealerId)
      if (res?.error) toast.error(res.error)
      else toast.success(`Generated ${res.count} pages.`)
    })
  }

  return (
    <Button
      size="sm"
      variant={hasPages ? "outline" : "default"}
      onClick={run}
      disabled={pending}
    >
      {pending ? "Generating…" : hasPages ? "Regenerate pages" : "Generate pages"}
    </Button>
  )
}
