"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Settings,
  Shield,
  LogOut,
} from "lucide-react"

import { signOut } from "@/lib/actions/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const NAV = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Dealers", href: "/dealers", icon: Building2 },
  { title: "Audit Findings", href: "/findings", icon: AlertTriangle },
  { title: "Workload", href: "/workload", icon: CalendarClock },
  { title: "Calendar", href: "/calendar", icon: CalendarDays },
  { title: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar({ userEmail, isAdmin = false }) {
  const pathname = usePathname()

  function isActive(href) {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const nav = isAdmin
    ? [...NAV, { title: "Admin", href: "/admin", icon: Shield }]
    : NAV

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-2">
        <span className="text-sm font-semibold">SEO Page Manager</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {userEmail ? (
            <SidebarMenuItem>
              <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                {userEmail}
              </div>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem>
            <form action={signOut} className="w-full">
              <SidebarMenuButton type="submit" className="w-full">
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
