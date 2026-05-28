/** Display helpers for audit findings (pure, shared client + server). */

export const FINDING_TYPE_LABELS = {
  broken_url: "Broken URL",
  missing_from_sitemap: "Missing from sitemap",
  title_mismatch: "Title mismatch",
  discovered_unplanned: "Unplanned page",
}

export const STATUS_VARIANT = {
  open: "destructive",
  resolved: "secondary",
  ignored: "outline",
}

/** A one-line, human description of a finding's specifics from its details jsonb. */
export function findingDetail(finding) {
  const d = finding.details ?? {}
  switch (finding.finding_type) {
    case "broken_url":
      return d.status ? `HTTP ${d.status}` : d.error === "timeout" ? "Timed out" : "Unreachable"
    case "missing_from_sitemap":
      return "URL not found in the sitemap"
    case "title_mismatch":
      return `Expected "${d.rule}" in the title — got "${d.title || d.h1 || "(empty)"}"`
    case "discovered_unplanned":
      return "In the sitemap but not in the page plan"
    default:
      return ""
  }
}

/** The most relevant URL to show for a finding. */
export function findingUrl(finding) {
  return finding.page_url ?? finding.details?.url ?? null
}
