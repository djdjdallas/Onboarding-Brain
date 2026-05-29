/**
 * Jira Cloud REST client (server-only). Credential-gated: everything no-ops with
 * a clear error until these env vars are set —
 *   JIRA_BASE_URL     e.g. https://youragency.atlassian.net
 *   JIRA_EMAIL        the account email for the API token
 *   JIRA_API_TOKEN    https://id.atlassian.com/manage-profile/security/api-tokens
 *   JIRA_PROJECT_KEY  e.g. SEO
 *   JIRA_PAGE_ISSUE_TYPE   (optional) issue type for pages; default "Task"
 *   JIRA_SUBTASK_ISSUE_TYPE (optional) default "Sub-task"
 *
 * Uses REST API v2 so descriptions can be plain text (v3 requires ADF).
 */

export function jiraConfig() {
  return {
    baseUrl: (process.env.JIRA_BASE_URL || "").replace(/\/+$/, ""),
    email: process.env.JIRA_EMAIL || "",
    token: process.env.JIRA_API_TOKEN || "",
    projectKey: process.env.JIRA_PROJECT_KEY || "",
    pageIssueType: process.env.JIRA_PAGE_ISSUE_TYPE || "Task",
    subtaskIssueType: process.env.JIRA_SUBTASK_ISSUE_TYPE || "Sub-task",
  }
}

export function isJiraConfigured() {
  const c = jiraConfig()
  return Boolean(c.baseUrl && c.email && c.token && c.projectKey)
}

function authHeaders() {
  const c = jiraConfig()
  const basic = Buffer.from(`${c.email}:${c.token}`).toString("base64")
  return {
    Authorization: `Basic ${basic}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  }
}

/** Jira labels can't contain spaces. */
function safeLabels(labels) {
  return (labels ?? [])
    .map((l) => String(l).trim().replace(/\s+/g, "-"))
    .filter(Boolean)
}

async function jiraFetch(path, init = {}) {
  const c = jiraConfig()
  const res = await fetch(`${c.baseUrl}${path}`, { ...init, headers: authHeaders() })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Jira ${init.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 300)}`)
  }
  return res.status === 204 ? null : res.json()
}

/**
 * Create an issue. Returns { key }. `parentKey` makes it a sub-task.
 */
export async function createIssue({ summary, description, issueType, labels, dueDate, parentKey }) {
  const c = jiraConfig()
  const fields = {
    project: { key: c.projectKey },
    summary: String(summary || "").slice(0, 254),
    issuetype: { name: issueType || c.pageIssueType },
  }
  if (description) fields.description = description
  if (dueDate) fields.duedate = dueDate
  const labs = safeLabels(labels)
  if (labs.length) fields.labels = labs
  if (parentKey) fields.parent = { key: parentKey }

  const data = await jiraFetch("/rest/api/2/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  })
  return { key: data.key }
}

/** Fetch a small set of fields for sync-back. Returns null if missing/410. */
export async function getIssue(key) {
  const data = await jiraFetch(
    `/rest/api/2/issue/${encodeURIComponent(key)}?fields=status,assignee,duedate,labels,resolution`
  )
  const f = data.fields ?? {}
  return {
    key: data.key,
    statusName: f.status?.name ?? null,
    statusCategory: f.status?.statusCategory?.key ?? null, // "new" | "indeterminate" | "done"
    assignee: f.assignee?.displayName ?? null,
    dueDate: f.duedate ?? null,
    labels: f.labels ?? [],
  }
}

/** Update a few fields on an existing issue. */
export async function updateIssue(key, { summary, dueDate, labels } = {}) {
  const fields = {}
  if (summary) fields.summary = summary
  if (dueDate) fields.duedate = dueDate
  if (labels) fields.labels = safeLabels(labels)
  if (Object.keys(fields).length === 0) return
  await jiraFetch(`/rest/api/2/issue/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  })
}
