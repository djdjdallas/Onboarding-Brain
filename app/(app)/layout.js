import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { AppSidebar } from "@/components/app-sidebar"
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
    <SidebarProvider>
      <AppSidebar userEmail={user.email} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
