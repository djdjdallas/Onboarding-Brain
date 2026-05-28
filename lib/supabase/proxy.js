import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"

/**
 * Refreshes the Supabase auth session on every request and guards routes.
 * Called from the root proxy.js. Unauthenticated users hitting any
 * route other than /login or /auth/* are redirected to /login.
 */
export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request })

  // Before keys are configured, keep protected routes from reaching the app
  // shell (which would 500 calling getUser without a client). Send them to
  // /login, which renders fine on its own.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const { pathname } = request.nextUrl
    if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() revalidates the token with Supabase. Do not run any
  // code between createServerClient and getUser, or you risk logging users out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic =
    pathname.startsWith("/login") || pathname.startsWith("/auth")

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
