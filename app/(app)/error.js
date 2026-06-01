"use client"

import { useEffect } from "react"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

/**
 * Full-page error boundary for the authenticated app. App Router renders this
 * when a route segment throws. Calm, centered, with a Try again that re-runs
 * the failed render via reset().
 */
export default function AppError({ error, reset }) {
  useEffect(() => {
    // Surface to the console for debugging; no PII in the UI.
    console.error(error)
  }, [error])

  return (
    <EmptyState
      icon={TriangleAlert}
      title="Something went wrong"
      description="This page hit an unexpected error. Try again — if it keeps happening, let an admin know."
      action={
        <Button variant="outline" onClick={() => reset()}>
          Try again
        </Button>
      }
    />
  )
}
