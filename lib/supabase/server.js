import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Bridges Supabase's auth session to Next.js cookies so the user stays
 * signed in across requests. Always create a fresh client per request —
 * never cache it in a module-level variable.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll throws when called from a Server Component (cookies are
            // read-only there). Safe to ignore — middleware refreshes the
            // session, so the cookie write isn't lost.
          }
        },
      },
    }
  )
}

/**
 * Privileged client using the service-role key. Bypasses RLS — use ONLY in
 * trusted server contexts (cron jobs, admin scripts). Never import this into
 * anything that runs in the browser.
 */
export function createServiceClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js")
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
