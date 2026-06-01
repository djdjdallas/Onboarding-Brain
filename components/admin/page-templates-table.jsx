"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

import { PAGE_FAMILIES } from "@/lib/validation/page-template"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const ALL = "__all__"

export function PageTemplatesTable({ templates, flagLabels }) {
  const router = useRouter()
  const [filters, setFilters] = useState({
    page_family: ALL,
    cadence: ALL,
    requires_model: ALL,
    requires_pma: ALL,
  })

  const cadences = useMemo(
    () => [...new Set(templates.map((t) => t.cadence).filter(Boolean))].sort(),
    [templates]
  )

  const filtered = templates.filter((t) => {
    if (filters.page_family !== ALL && t.page_family !== filters.page_family) return false
    if (filters.cadence !== ALL && t.cadence !== filters.cadence) return false
    if (filters.requires_model !== ALL && String(t.requires_model) !== filters.requires_model) return false
    if (filters.requires_pma !== ALL && String(t.requires_pma) !== filters.requires_pma) return false
    return true
  })

  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.page_family} onValueChange={set("page_family")}>
          <SelectTrigger size="sm" className="w-auto min-w-36">
            <SelectValue placeholder="Family" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Family: All</SelectItem>
            {PAGE_FAMILIES.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.cadence} onValueChange={set("cadence")}>
          <SelectTrigger size="sm" className="w-auto min-w-32">
            <SelectValue placeholder="Cadence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Cadence: All</SelectItem>
            {cadences.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.requires_model} onValueChange={set("requires_model")}>
          <SelectTrigger size="sm" className="w-auto min-w-36">
            <SelectValue placeholder="Requires model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Model: Any</SelectItem>
            <SelectItem value="true">Requires model</SelectItem>
            <SelectItem value="false">No model</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.requires_pma} onValueChange={set("requires_pma")}>
          <SelectTrigger size="sm" className="w-auto min-w-36">
            <SelectValue placeholder="Requires PMA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>PMA: Any</SelectItem>
            <SelectItem value="true">Requires PMA</SelectItem>
            <SelectItem value="false">No PMA</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-small text-muted-foreground">
          {filtered.length} of {templates.length}
        </span>
        <Button size="sm" className="ml-auto" asChild>
          <Link href="/admin/page-templates/new">
            <Plus />
            New template
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page type</TableHead>
              <TableHead>Family</TableHead>
              <TableHead>Cadence</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead>Gate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No templates match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/page-templates/${t.id}`)}
                >
                  <TableCell className="font-medium">{t.page_type}</TableCell>
                  <TableCell className="text-muted-foreground">{t.page_family}</TableCell>
                  <TableCell className="text-muted-foreground">{t.cadence ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {t.base_priority != null ? Number(t.base_priority).toFixed(1) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(t.gate_rules ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">all</span>
                      ) : (
                        t.gate_rules.map((k) => (
                          <Badge key={k} variant="outline" className="text-xs">
                            {flagLabels[k] ?? k}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
