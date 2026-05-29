"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Sticky table of contents for the methodology doc. Items are { title, slug }.
 * Highlights the section nearest the top of the viewport via IntersectionObserver.
 */
export function DocsToc({ items }) {
  const [active, setActive] = useState(items[0]?.slug)

  useEffect(() => {
    const headings = items
      .map((i) => document.getElementById(i.slug))
      .filter(Boolean)
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-64px 0px -70% 0px", threshold: 0 }
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [items])

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => (
        <a
          key={item.slug}
          href={`#${item.slug}`}
          className={cn(
            "flex h-7 items-center border-l-2 px-3 text-sm",
            active === item.slug
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {item.title}
        </a>
      ))}
    </nav>
  )
}
