import Link from "next/link"
import { redirect } from "next/navigation"
import { HelpCircle } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/roles"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"

/**
 * Shell for every authenticated page. The root proxy already gates access,
 * but we re-check here (defense in depth) and use the verified user to render
 * the sidebar. This layout wraps the (app) route group only — /login and
 * /auth/* sit outside it and get no sidebar.
 */
export default async function AppLayout({ children }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "15rem" }}>
      <AppSidebar userEmail={user.email} isAdmin={isAdmin(user.email)} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Button asChild variant="ghost" size="icon-sm" className="ml-auto" title="How it works">
            <Link href="/docs/methodology" target="_blank">
              <HelpCircle />
            </Link>
          </Button>
        </header>
        <div className="flex-1 px-8 py-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
