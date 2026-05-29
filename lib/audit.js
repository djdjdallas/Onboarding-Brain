/**
 * Audit-log helpers (server-only; call from within server actions).
 *
 * recordAudit writes one row per actually-changed field. Valid entity_type
 * values are constrained by the audit_log CHECK (see migration 0004):
 *   dealer, page, page_template, pma, priority_model, eligibility,
 *   keyword_target, discovered_page
 * Reference tables (account_managers, package_tiers, etc.) are NOT audited.
 */

/** Map the signed-in auth user to their account_managers row id (by email), or null. */
export async function getActorId(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data } = await supabase
    .from("account_managers")
    .select("id")
    .ilike("email", user.email)
    .maybeSingle()
  return data?.id ?? null
}

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * @param supabase
 * @param {object} opts
 * @param {string} opts.entityType  one of the audited entity types
 * @param {string} opts.entityId
 * @param {string|null} opts.actorId  account_managers.id (from getActorId)
 * @param {Array<{field:string, old:any, new:any}>} opts.changes
 */
export async function recordAudit(supabase, { entityType, entityId, actorId, changes }) {
  const rows = (changes ?? [])
    .filter((c) => !sameJson(c.old, c.new))
    .map((c) => ({
      entity_type: entityType,
      entity_id: entityId,
      changed_by: actorId ?? null,
      field_name: c.field ?? null,
      old_value: c.old ?? null,
      new_value: c.new ?? null,
    }))
  if (rows.length) await supabase.from("audit_log").insert(rows)
  return rows.length
}
