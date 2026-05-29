import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * StatusPill — the V3 replacement for shadcn Badge in status contexts.
 * A 20px-tall pill: a 6px colored dot + a label. Five semantic variants map
 * to the design-system status palette (globals.css @theme status tokens).
 *
 * Props:
 *   status: 'live' | 'build' | 'strategy' | 'backlog' | 'error'  (default 'backlog')
 *   label:  string shown after the dot
 *   size:   'sm' | 'default'  (default 'default')
 */
const VARIANTS = {
  live: { bg: "bg-status-live-bg", dot: "bg-status-live" },
  build: { bg: "bg-status-build-bg", dot: "bg-status-build" },
  strategy: { bg: "bg-status-strategy-bg", dot: "bg-status-strategy" },
  backlog: { bg: "bg-status-backlog-bg", dot: "bg-status-backlog" },
  error: { bg: "bg-status-error-bg", dot: "bg-status-error" },
}

function StatusPill({ status = "backlog", label, size = "default", className, ...props }) {
  const v = VARIANTS[status] ?? VARIANTS.backlog
  return (
    <span
      data-slot="status-pill"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-[3px] font-medium text-foreground whitespace-nowrap",
        size === "sm" ? "h-[18px] px-1.5 text-tiny" : "h-5 px-2 text-tiny",
        v.bg,
        className
      )}
      {...props}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", v.dot)} aria-hidden="true" />
      {label}
    </span>
  )
}

/**
 * Map a domain status string (page status, finding type, tier, …) to a pill
 * variant. Used across Phase 2 route restyles so callers don't repeat the
 * mapping. Falls back to 'backlog' for anything unrecognized.
 */
const STATUS_TO_VARIANT = {
  // Page statuses
  live: "live",
  published: "live",
  missing: "build",
  "available for build": "build",
  build: "build",
  strategy: "strategy",
  "in strategy": "strategy",
  backlog: "backlog",
  // Finding / health
  open: "error",
  broken: "error",
  error: "error",
  resolved: "live",
  ignored: "backlog",
  dismissed: "backlog",
}

function statusVariant(value) {
  if (!value) return "backlog"
  return STATUS_TO_VARIANT[String(value).trim().toLowerCase()] ?? "backlog"
}

export { StatusPill, statusVariant }
