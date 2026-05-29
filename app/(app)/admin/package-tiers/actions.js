"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { packageTierSchema, nullifyBlanks } from "@/lib/validation/reference"

export async function updatePackageTier(id, input) {
  const parsed = packageTierSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("package_tiers")
    .update(nullifyBlanks(parsed.data))
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/package-tiers")
  return { ok: true }
}
