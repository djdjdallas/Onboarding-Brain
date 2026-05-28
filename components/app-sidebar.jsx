"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  AlertTriangle,
  Settings,
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
  { title: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar({ userEmail }) {
  const pathname = usePathname()

  function isActive(href) {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-2">
        <span className="text-sm font-semibold">SEO Page Manager</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
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
