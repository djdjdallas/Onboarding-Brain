/**
 * Jira CSV export shaping. Pure functions (no DB) so they're testable.
 *
 * The export matches the spreadsheet's SEO_Onboarding_Tasks columns so it
 * imports straight into Jira:
 *   Summary | Description | Status | Due Date |
 *   Custom field [Update Cadence] | Custom field [URL] | Reporter | Issue Type
 */

const ISSUE_TYPE = "Managed Website Page"

/**
 * Reconstructs a human page name from the generic template + the page's model
 * and PMA. The seed deliberately genericized these for multi-tenancy, so we
 * expand them back here:
 *   "Model SRP"  + K5                       -> "K5 SRP"
 *   "K5 PMA Local" + East Hartford          -> "K5 in PMA East Hartford"
 *   "Collision Center Near PMA" + Hartford  -> "Collision Center Near PMA Hartford"
 *   "Home Page"                             -> "Home Page"
 */
export function pageLabel({ page_type, model, pma_city }) {
  let t = page_type ?? ""

  // "Model <X>" placeholder -> actual model name.
  if (model && /^Model\b/i.test(t)) {
    t = t.replace(/^Model\b/i, model)
  }

  if (pma_city) {
    if (/PMA Local$/i.test(t)) {
      // "K5 PMA Local" -> "K5 in PMA East Hartford"
      t = `${t.replace(/\s*PMA Local$/i, "")} in PMA ${pma_city}`
    } else if (/Near PMA$/i.test(t)) {
      // "Collision Center Near PMA" -> "... Near PMA East Hartford"
      t = `${t} ${pma_city}`
    } else {
      t = `${t} — ${pma_city}`
    }
  } else if (model && !new RegExp(`\\b${model}\\b`, "i").test(t)) {
    t = `${model} ${t}`
  }

  return t.trim()
}

/** "2026-07-31" -> "7/31/2026" (M/D/YYYY, matching the sheet). Blank if null. */
export function formatJiraDate(due) {
  if (!due) return ""
  const [y, m, d] = String(due).split("-")
  if (!y || !m || !d) return String(due)
  return `${Number(m)}/${Number(d)}/${y}`
}

/**
 * @param {string} dealerName
 * @param {string|null} reporter  AM's jira_user_string
 * @param {Array} pages  flattened page rows incl. page_type, cadence, description
 * @returns {Array<object>} one row per page, keyed by Jira column header
 */
export function buildJiraRows(dealerName, reporter, pages) {
  return pages.map((p) => ({
    Summary: `Web Page: ${dealerName} - ${pageLabel(p)}`,
    Description: p.description ?? "",
    Status: p.status ?? "",
    "Due Date": formatJiraDate(p.due_date),
    "Custom field [Update Cadence]": p.cadence ?? "",
    "Custom field [URL]": p.url ?? "",
    Reporter: reporter ?? "",
    "Issue Type": ISSUE_TYPE,
  }))
}
