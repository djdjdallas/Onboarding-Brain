"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

/**
 * Resolve / ignore / reopen a single finding. Writes to the base
 * audit_findings table (the detail view is read-only). Returns { error } on
 * failure. The client also calls router.refresh(), so revalidation here is a
 * belt-and-suspenders refresh of the global findings view.
 */
export async function setFindingStatus(findingId, status) {
  if (!["open", "resolved", "ignored"].includes(status)) {
    return { error: "Invalid status." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("audit_findings")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", findingId)

  if (error) return { error: error.message }

  revalidatePath("/findings")
  revalidatePath("/")
  return { ok: true }
}
