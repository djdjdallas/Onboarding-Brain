import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Magic-link landing route. Supports both Supabase email flows:
 *
 *  1. PKCE "code" flow (the default with {{ .ConfirmationURL }}):
 *       /auth/confirm?code=...           -> exchangeCodeForSession(code)
 *  2. token_hash flow (if you customize the email template):
 *       /auth/confirm?token_hash=...&type=email -> verifyOtp({ type, token_hash })
 *
 * Either way, a success sets the auth cookie via the SSR client and we redirect
 * into the app.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = searchParams.get("next") ?? "/"

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Token/code missing, expired, or already used.
  return NextResponse.redirect(new URL("/login?error=link_invalid", request.url))
}
