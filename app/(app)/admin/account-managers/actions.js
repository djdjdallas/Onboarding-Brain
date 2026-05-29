"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { accountManagerSchema } from "@/lib/validation/account-manager"

// account_managers is a reference table, not in the audit_log entity_type set,
// so these mutations aren't audited (see lib/audit.js).

function normalize(input) {
  const parsed = accountManagerSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  return {
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      jira_user_string: parsed.data.jira_user_string || null,
    },
  }
}

export async function createAccountManager(input) {
  const { data, error } = normalize(input)
  if (error) return { error }
  const supabase = await createClient()
  const { error: insErr } = await supabase.from("account_managers").insert(data)
  if (insErr) {
    return {
      error: insErr.code === "23505" ? "An account manager with that email already exists." : insErr.message,
    }
  }
  revalidatePath("/admin/account-managers")
  return { ok: true }
}

export async function updateAccountManager(id, input) {
  const { data, error } = normalize(input)
  if (error) return { error }
  const supabase = await createClient()
  const { error: updErr } = await supabase.from("account_managers").update(data).eq("id", id)
  if (updErr) {
    return {
      error: updErr.code === "23505" ? "An account manager with that email already exists." : updErr.message,
    }
  }
  revalidatePath("/admin/account-managers")
  return { ok: true }
}

export async function setAccountManagerActive(id, isActive) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("account_managers")
    .update({ is_active: isActive })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/account-managers")
  return { ok: true }
}
