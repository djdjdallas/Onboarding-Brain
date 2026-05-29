"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

export async function createOem({ name, label }) {
  const n = String(name || "").trim().toUpperCase()
  if (!n) return { error: "Enter an OEM code (e.g. HONDA)." }
  const supabase = await createClient()
  const { error } = await supabase
    .from("oems")
    .insert({ name: n, label: String(label || "").trim() || n })
  if (error) {
    return { error: error.code === "23505" ? `${n} already exists.` : error.message }
  }
  revalidatePath("/admin/oems")
  return { ok: true }
}

/** Replace an OEM's model list (order = array order). */
export async function setOemModels(oem, models) {
  const list = [...new Set((models ?? []).map((m) => String(m).trim()).filter(Boolean))]
  const supabase = await createClient()
  const { error: delErr } = await supabase.from("oem_models").delete().eq("oem", oem)
  if (delErr) return { error: delErr.message }
  if (list.length) {
    const rows = list.map((model, i) => ({ oem, model, sort_order: i }))
    const { error } = await supabase.from("oem_models").insert(rows)
    if (error) return { error: error.message }
  }
  revalidatePath("/admin/oems")
  return { ok: true }
}

export async function deleteOem(name) {
  const supabase = await createClient()
  const { count } = await supabase
    .from("dealers")
    .select("id", { count: "exact", head: true })
    .eq("oem", name)
  if ((count ?? 0) > 0) {
    return { error: `${count} dealer(s) use ${name}. Reassign or remove them first.` }
  }
  const { error } = await supabase.from("oems").delete().eq("name", name)
  if (error) return { error: error.message }
  revalidatePath("/admin/oems")
  return { ok: true }
}
