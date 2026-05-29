/**
 * Admin gating. Real RBAC isn't built yet, so admin access is controlled by an
 * allowlist: the ADMIN_EMAILS env var (comma-separated) plus a hardcoded list.
 *
 * Dev convenience: if ADMIN_EMAILS is unset, every signed-in user is treated as
 * an admin (this is an invite-only internal tool). Set ADMIN_EMAILS in
 * .env.local / Vercel to lock admin down to specific people.
 */
const HARDCODED_ADMINS = ["dominickjerell@gmail.com"]

export function isAdmin(email) {
  if (!email) return false
  const envList = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  // No allowlist configured -> open to all signed-in users (dev default).
  if (envList.length === 0) return true

  const allow = new Set([...HARDCODED_ADMINS.map((e) => e.toLowerCase()), ...envList])
  return allow.has(email.toLowerCase())
}
