import { createClient } from "@/lib/supabase/server"
import { KeywordsTable } from "@/components/admin/keywords-table"

export default async function KeywordsPage() {
  const supabase = await createClient()
  const [{ data: keywords }, { data: targets }] = await Promise.all([
    supabase.from("keywords").select("id, oem, keyword, is_active").order("keyword"),
    supabase.from("keyword_targets").select("keyword_id, dealer_id, is_targeted"),
  ])

  // Distinct dealers actively targeting each keyword.
  const dealersByKeyword = new Map()
  for (const t of targets ?? []) {
    if (!t.is_targeted) continue
    if (!dealersByKeyword.has(t.keyword_id)) dealersByKeyword.set(t.keyword_id, new Set())
    dealersByKeyword.get(t.keyword_id).add(t.dealer_id)
  }
  const rows = (keywords ?? []).map((k) => ({
    ...k,
    target_count: dealersByKeyword.get(k.id)?.size ?? 0,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-h1 font-medium">Keywords</h2>
        <p className="text-small text-muted-foreground">
          The master keyword list per OEM. Dealers target keywords per PMA in their settings.
        </p>
      </div>
      <KeywordsTable keywords={rows} />
    </div>
  )
}
