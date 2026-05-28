import { NextResponse } from "next/server"

import { createServiceClient } from "@/lib/supabase/server"
import { auditDealer } from "@/lib/auditor"

// cheerio + sitemap fetching need the Node runtime; allow a long window for the
// fleet-wide sweep.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const DEALER_CONCURRENCY = 3

/**
 * Daily fleet-wide audit (Vercel cron — see vercel.json, 6am UTC).
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when the
 * CRON_SECRET env var is set; we reject anything else.
 */
export async function GET(request) {
  const auth = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data: dealers, error } = await supabase.from("dealers").select("id, name")
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit dealers a few at a time (each dealer also caps its own URL checks at 5).
  const results = []
  let cursor = 0
  const worker = async () => {
    while (cursor < dealers.length) {
      const d = dealers[cursor++]
      try {
        const r = await auditDealer(supabase, d.id)
        results.push({ dealer: d.name, ...r })
      } catch (e) {
        results.push({ dealer: d.name, error: String(e?.message ?? e) })
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(DEALER_CONCURRENCY, dealers.length) }, worker)
  )

  const totalFindings = results.reduce((s, r) => s + (r.errorsFound ?? 0), 0)
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    dealersAudited: results.length,
    totalFindings,
    results,
  })
}
