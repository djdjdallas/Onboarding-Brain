import { NextResponse } from "next/server"

import { createServiceClient } from "@/lib/supabase/server"
import { isJiraConfigured } from "@/lib/jira"
import { syncDealerFromJira } from "@/lib/jira-sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily Jira status sync-back (Vercel cron — see vercel.json). No-ops if Jira
 * isn't configured. Protected by CRON_SECRET.
 */
export async function GET(request) {
  const auth = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isJiraConfigured()) {
    return NextResponse.json({ skipped: "Jira not configured" })
  }

  const supabase = await createServiceClient()
  const { data: dealers, error } = await supabase.from("dealers").select("id, name")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results = []
  for (const d of dealers ?? []) {
    try {
      const r = await syncDealerFromJira(supabase, d.id)
      if (r.checked) results.push({ dealer: d.name, ...r })
    } catch (e) {
      results.push({ dealer: d.name, error: String(e?.message ?? e) })
    }
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), results })
}
