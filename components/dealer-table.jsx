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
import { Badge } from "@/components/ui/badge"

const TIER_VARIANT = {
  Elite: "default",
  Advanced: "secondary",
  Essential: "outline",
}

export function DealerTable({ dealers }) {
  const router = useRouter()

  return (
    <div className="rounded-md border">
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
                <Badge variant={TIER_VARIANT[d.package_tier] ?? "outline"}>
                  {d.package_tier}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {d.am_name ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                {d.open_findings > 0 ? (
                  <Badge variant="destructive">{d.open_findings}</Badge>
                ) : (
                  <span className="text-muted-foreground">0</span>
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
