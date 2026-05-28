import {
  FINDING_TYPE_LABELS,
  STATUS_VARIANT,
  findingDetail,
  findingUrl,
} from "@/lib/findings"
import { FindingActions } from "@/components/finding-actions"
import { Badge } from "@/components/ui/badge"

/**
 * Dealer Findings tab — findings grouped by type. Presentational (server-
 * rendered); the per-finding Resolve/Ignore buttons are the client island.
 */
export function FindingsList({ findings }) {
  if (!findings?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No findings. Run an audit to check this dealer&apos;s live URLs.
      </p>
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
          <h3 className="text-sm font-medium">
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
                      <Badge variant={STATUS_VARIANT[f.status] ?? "outline"}>
                        {f.status}
                      </Badge>
                      <span className="text-sm">{findingDetail(f)}</span>
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-muted-foreground underline"
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
