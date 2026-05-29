"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

// keywords is a reference table (not in the audit_log enum) — not audited.

export async function createKeyword({ oem, keyword }) {
  const name = String(keyword || "").trim()
  const brand = String(oem || "KIA").trim() || "KIA"
  if (!name) return { error: "Enter a keyword." }
  const supabase = await createClient()
  const { error } = await supabase.from("keywords").insert({ oem: brand, keyword: name })
  if (error) {
    return { error: error.code === "23505" ? `"${name}" already exists for ${brand}.` : error.message }
  }
  revalidatePath("/admin/keywords")
  return { ok: true }
}

export async function bulkImportKeywords({ oem, text }) {
  const brand = String(oem || "KIA").trim() || "KIA"
  const names = [
    ...new Set(
      String(text || "")
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ]
  if (names.length === 0) return { error: "Nothing to import." }
  const supabase = await createClient()
  const rows = names.map((keyword) => ({ oem: brand, keyword, is_active: true }))
  const { error } = await supabase
    .from("keywords")
    .upsert(rows, { onConflict: "oem,keyword", ignoreDuplicates: true })
  if (error) return { error: error.message }
  revalidatePath("/admin/keywords")
  return { ok: true, count: names.length }
}

export async function setKeywordActive(id, isActive) {
  const supabase = await createClient()
  const { error } = await supabase.from("keywords").update({ is_active: isActive }).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/admin/keywords")
  return { ok: true }
}
