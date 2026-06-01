"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ListChecks,
  BookOpen,
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Grouped nav (Notion-style sections). Admin section appended for admins.
const SECTIONS = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Dealers", href: "/dealers", icon: Building2 },
      { title: "Audit Findings", href: "/findings", icon: AlertTriangle },
    ],
  },
  {
    label: "Planning",
    items: [
      { title: "Work Queue", href: "/work", icon: ListChecks },
      { title: "Workload", href: "/workload", icon: CalendarClock },
      { title: "Calendar", href: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Resources",
    items: [
      { title: "Docs", href: "/docs/methodology", icon: BookOpen },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
]

// Active item gets an accent inset-left border on top of the primitive's
// subtle bg + medium weight.
const ACTIVE = "data-active:text-foreground data-active:shadow-[inset_2px_0_0_var(--primary)]"

export function AppSidebar({ userEmail, isAdmin = false }) {
  const pathname = usePathname()

  function isActive(href) {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const sections = isAdmin
    ? [...SECTIONS, { label: "Admin", items: [{ title: "Admin", href: "/admin", icon: Shield }] }]
    : SECTIONS

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-[22px] shrink-0 place-items-center rounded-[5px] bg-primary text-[11px] font-medium text-primary-foreground">
            S
          </span>
          <span className="text-sm font-medium">SEO Page Manager</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-tiny font-medium uppercase tracking-wide text-muted-foreground">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)} className={ACTIVE}>
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
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {userEmail ? (
            <SidebarMenuItem>
              <div className="truncate px-2 py-1.5 text-tiny text-muted-foreground">
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
