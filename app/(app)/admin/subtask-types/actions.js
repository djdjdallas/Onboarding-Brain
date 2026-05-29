"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { subtaskTypeSchema } from "@/lib/validation/subtask-type"
import { nullifyBlanks } from "@/lib/validation/reference"

function parse(input) {
  const r = subtaskTypeSchema.safeParse(input)
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Invalid input." }
  return { data: nullifyBlanks(r.data) }
}

export async function createSubtaskType(input) {
  const { data, error } = parse(input)
  if (error) return { error }
  const supabase = await createClient()
  const { error: insErr } = await supabase.from("subtask_types").insert(data)
  if (insErr) {
    return { error: insErr.code === "23505" ? `"${data.work_type}" already exists.` : insErr.message }
  }
  revalidatePath("/admin/subtask-types")
  return { ok: true }
}

export async function updateSubtaskType(id, input) {
  const { data, error } = parse(input)
  if (error) return { error }
  const supabase = await createClient()
  const { error: updErr } = await supabase.from("subtask_types").update(data).eq("id", id)
  if (updErr) {
    return { error: updErr.code === "23505" ? `"${data.work_type}" already exists.` : updErr.message }
  }
  revalidatePath("/admin/subtask-types")
  return { ok: true }
}

export async function deleteSubtaskType(id) {
  const supabase = await createClient()
  const { error } = await supabase.from("subtask_types").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/subtask-types")
  return { ok: true }
}
