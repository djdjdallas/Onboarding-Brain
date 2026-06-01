import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton"

/**
 * Default loading UI for every authenticated route (App Router Suspense
 * fallback). Shaped like the common page: a title/subtitle header over a
 * Linear-density table. Routes can add their own loading.js to override.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} cols={6} />
    </div>
  )
}
