import { updateSession } from "@/lib/supabase/proxy"

// Next.js 16 renamed the `middleware` convention to `proxy`. This runs on
// every matched request before rendering — we use it to refresh the Supabase
// auth session and gate unauthenticated users to /login.
export async function proxy(request) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next internals)
     * - favicon.ico, public image assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
