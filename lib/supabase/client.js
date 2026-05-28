import { createBrowserClient } from "@supabase/ssr"

/**
 * Supabase client for use in Client Components ("use client").
 * Reads the public anon key — safe to ship to the browser because
 * Row Level Security gates every table.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
