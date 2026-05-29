"use client"

import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusPill } from "@/components/ui/status-pill"
import { cn } from "@/lib/utils"

// Tier pills follow the design system: Elite = accent-subtle, Advanced =
// strategy, Essential = backlog. (Tiers aren't status semantics, so they get
// their own small pill rather than a StatusPill variant.)
const TIER = {
  Elite: { bg: "bg-primary/10", dot: "bg-primary" },
  Advanced: { bg: "bg-status-strategy-bg", dot: "bg-status-strategy" },
  Essential: { bg: "bg-status-backlog-bg", dot: "bg-status-backlog" },
}

function TierPill({ tier }) {
  if (!tier) return <span className="text-muted-foreground/70">—</span>
  const v = TIER[tier] ?? TIER.Essential
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center gap-1.5 rounded-[3px] px-2 text-tiny font-medium text-foreground",
        v.bg
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", v.dot)} aria-hidden="true" />
      {tier}
    </span>
  )
}

export function DealerTable({ dealers }) {
  const router = useRouter()

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>OEM</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Account Manager</TableHead>
            <TableHead className="text-right">Open findings</TableHead>
            <TableHead>Last audit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dealers.map((d) => (
            <TableRow
              key={d.id}
              onClick={() => router.push(`/dealers/${d.id}`)}
              className="cursor-pointer"
            >
              <TableCell className="font-medium">{d.name}</TableCell>
              <TableCell className="text-muted-foreground">{d.oem}</TableCell>
              <TableCell>
                <TierPill tier={d.package_tier} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {d.am_name ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                {d.open_findings > 0 ? (
                  <StatusPill
                    status="error"
                    label={`${d.open_findings} ${d.open_findings === 1 ? "issue" : "issues"}`}
                    className="ml-auto"
                  />
                ) : (
                  <span className="text-muted-foreground/70">—</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {d.last_audit_at
                  ? formatDistanceToNow(new Date(d.last_audit_at), {
                      addSuffix: true,
                    })
                  : "Never"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
