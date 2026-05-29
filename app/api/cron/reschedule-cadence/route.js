import { NextResponse } from "next/server"

import { createServiceClient } from "@/lib/supabase/server"
import { rescheduleDealer } from "@/lib/scheduler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Daily cadence reschedule (Vercel cron — see vercel.json). For every dealer,
 * rolls LIVE pages' due dates forward to last_reviewed_at + cadence. Protected
 * by CRON_SECRET.
 */
export async function GET(request) {
  const auth = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data: dealers, error } = await supabase.from("dealers").select("id, name")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let totalUpdated = 0
  const results = []
  for (const d of dealers ?? []) {
    try {
      const n = await rescheduleDealer(supabase, d.id)
      totalUpdated += n
      if (n) results.push({ dealer: d.name, rescheduled: n })
    } catch (e) {
      results.push({ dealer: d.name, error: String(e?.message ?? e) })
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), totalUpdated, results })
}
