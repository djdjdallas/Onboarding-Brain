"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { cadenceRuleSchema, nullifyBlanks } from "@/lib/validation/reference"

export async function updateCadenceRule(id, input) {
  const parsed = cadenceRuleSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("cadence_rules")
    .update(nullifyBlanks(parsed.data))
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/cadence-rules")
  return { ok: true }
}
