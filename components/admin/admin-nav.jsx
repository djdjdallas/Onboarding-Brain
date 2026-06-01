"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { ADMIN_NAV } from "@/lib/admin-nav"
import { cn } from "@/lib/utils"

/** Vertical section nav for the admin area, with active-state highlighting. */
export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-small",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
