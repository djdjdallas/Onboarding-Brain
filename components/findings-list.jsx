import {
  FINDING_TYPE_LABELS,
  findingDetail,
  findingUrl,
} from "@/lib/findings"
import { CheckCircle2 } from "lucide-react"

import { FindingActions } from "@/components/finding-actions"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusPill, statusVariant } from "@/components/ui/status-pill"

/**
 * Dealer Findings tab — findings grouped by type. Presentational (server-
 * rendered); the per-finding Resolve/Ignore buttons are the client island.
 */
export function FindingsList({ findings }) {
  if (!findings?.length) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No findings"
        description="Run an audit to check this dealer's live URLs for broken links, sitemap gaps, and title mismatches."
      />
    )
  }

  const groups = {}
  for (const f of findings) {
    ;(groups[f.finding_type] ??= []).push(f)
  }

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([type, items]) => (
        <div key={type} className="space-y-2">
          <h3 className="text-small font-medium">
            {FINDING_TYPE_LABELS[type] ?? type}{" "}
            <span className="text-muted-foreground">({items.length})</span>
          </h3>
          <div className="grid gap-2">
            {items.map((f) => {
              const url = findingUrl(f)
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <StatusPill status={statusVariant(f.status)} label={f.status} />
                      <span className="text-small">{findingDetail(f)}</span>
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-mono text-tiny text-muted-foreground underline"
                      >
                        {url}
                      </a>
                    ) : null}
                  </div>
                  <FindingActions findingId={f.id} status={f.status} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
