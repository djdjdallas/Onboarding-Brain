import { NextResponse } from "next/server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { auditDealer } from "@/lib/auditor"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * On-demand audit for a single dealer. Auth-required (any signed-in AM). The
 * audit itself runs with the service-role client; the user session is only the
 * gate.
 */
export async function POST(request, { params }) {
  const { dealerId } = await params

  const userClient = await createClient()
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = await createServiceClient()
    const result = await auditDealer(supabase, dealerId)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 })
  }
}
