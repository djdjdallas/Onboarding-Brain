"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

/**
 * Sends a magic-link email. Invite-only: signups are disabled in the Supabase
 * dashboard, so signInWithOtp only succeeds for already-invited users.
 *
 * Returns a plain object ({ error } | { success }) instead of throwing so the
 * client form can show a toast without an error boundary.
 */
export async function sendMagicLink(_prevState, formData) {
  const email = String(formData.get("email") || "").trim()

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." }
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return { error: "Supabase keys aren't configured yet. Fill in .env.local." }
  }

  const supabase = await createClient()
  const origin = (await headers()).get("origin")

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Disable auto-signup so only invited users can get in.
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: `Magic link sent to ${email}. Check your inbox.` }
}
