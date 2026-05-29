/**
 * Shared service-role Supabase client for seed scripts.
 * Polyfills WebSocket for Node < 22 (supabase-js builds a Realtime client at
 * construction). Run scripts with: node --env-file=.env.local scripts/<x>.mjs
 */
export async function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      "\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Run with:  node --env-file=.env.local scripts/<script>.mjs\n"
    )
    process.exit(1)
  }
  if (typeof globalThis.WebSocket === "undefined") {
    const { default: ws } = await import("ws")
    globalThis.WebSocket = ws
  }
  const { createClient } = await import("@supabase/supabase-js")
  return createClient(url, key, { auth: { persistSession: false } })
}

/** True if --dry-run was passed. */
export const DRY_RUN = process.argv.includes("--dry-run")

/** Returns the value of --csv=<path>, or null. */
export function csvArgPath() {
  const a = process.argv.find((x) => x.startsWith("--csv="))
  return a ? a.slice("--csv=".length) : null
}
