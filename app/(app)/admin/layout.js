import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/roles"
import { AdminNav } from "@/components/admin/admin-nav"

/**
 * Admin shell. Gates the whole /admin/* area to admins (see lib/auth/roles.js),
 * and renders the section sub-nav alongside the page content.
 */
export default async function AdminLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isAdmin(user?.email)) {
    redirect("/")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-display font-medium tracking-tight">Admin</h1>
        <p className="text-small text-muted-foreground">
          Reference data — the source of truth for templates, flags, tiers, and
          account managers.
        </p>
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="md:w-52 md:shrink-0">
          <AdminNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
