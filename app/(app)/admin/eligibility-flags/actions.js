"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { flagTypeSchema, slugifyFlagKey } from "@/lib/validation/eligibility-flag"

// eligibility_flag_types is a reference table (not in the audit_log enum), so
// these mutations aren't audited.

function parse(input) {
  const r = flagTypeSchema.safeParse(input)
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input." }
  return {
    data: {
      label: r.data.label,
      description: r.data.description || null,
      ui_group: r.data.ui_group,
      sort_order: r.data.sort_order ?? 0,
    },
  }
}

export async function createFlagType(input) {
  const { data, error } = parse(input)
  if (error) return { error }
  const supabase = await createClient()
  const key = slugifyFlagKey(data.label)
  if (!key) return { error: "Could not derive a key from that label." }
  const { error: insErr } = await supabase
    .from("eligibility_flag_types")
    .insert({ ...data, key })
  if (insErr) {
    return { error: insErr.code === "23505" ? `A flag with key "${key}" already exists.` : insErr.message }
  }
  revalidatePath("/admin/eligibility-flags")
  return { ok: true }
}

export async function updateFlagType(id, input) {
  // key is immutable (referenced by eligibility rows + template gate_rules).
  const { data, error } = parse(input)
  if (error) return { error }
  const supabase = await createClient()
  const { error: updErr } = await supabase
    .from("eligibility_flag_types")
    .update(data)
    .eq("id", id)
  if (updErr) return { error: updErr.message }
  revalidatePath("/admin/eligibility-flags")
  return { ok: true }
}

export async function deleteFlagType(id) {
  const supabase = await createClient()

  const { data: flag } = await supabase
    .from("eligibility_flag_types")
    .select("key")
    .eq("id", id)
    .single()
  if (!flag) return { error: "Flag not found." }

  // Block deletion while any dealer's eligibility references it (by FK or legacy key).
  const [{ count: byId }, { count: byKey }] = await Promise.all([
    supabase
      .from("eligibility")
      .select("id", { count: "exact", head: true })
      .eq("eligibility_flag_type_id", id),
    supabase
      .from("eligibility")
      .select("id", { count: "exact", head: true })
      .eq("flag_key", flag.key),
  ])
  const inUse = (byId ?? 0) + (byKey ?? 0)
  if (inUse > 0) {
    return { error: `In use by ${inUse} dealer eligibility record(s). Remove those first.` }
  }

  const { error } = await supabase.from("eligibility_flag_types").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/eligibility-flags")
  return { ok: true }
}
