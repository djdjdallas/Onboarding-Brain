import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Magic-link landing route. Supabase emails a link to
 *   /auth/confirm?token_hash=...&type=email&next=/
 * We verify the one-time token, which sets the auth cookie via the SSR client,
 * then redirect into the app.
 *
 * NOTE: this requires the Supabase email template to use the token_hash flow.
 * In the dashboard → Authentication → Email Templates → Magic Link, set the URL to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = searchParams.get("next") ?? "/"

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Token missing, expired, or already used.
  return NextResponse.redirect(new URL("/login?error=link_invalid", request.url))
}
