import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { humanizeFlag } from "@/lib/eligibility"
import { RegeneratePagesButton } from "@/components/regenerate-pages-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Minimal dealer detail. Confirms the wizard wrote everything correctly.
 * The full tabbed view (Pages / Findings / Settings) lands in Step 8, and
 * page generation in Step 7.
 */
export default async function DealerDetailPage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: dealer } = await supabase
    .from("dealers")
    .select(
      "id, name, oem, package_tier, website, address, account_managers(name), " +
        "pmas(city, priority_order, mod_score), " +
        "priority_models(model, priority_order, mod_score), " +
        "eligibility(flag_key, flag_value)"
    )
    .eq("id", id)
    .single()

  if (!dealer) notFound()

  // Page-plan summary (full filterable table is Step 8).
  const { data: pageStatuses } = await supabase
    .from("pages")
    .select("status, next_step")
    .eq("dealer_id", id)
  const statusCounts = {}
  for (const p of pageStatuses ?? []) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1
  }
  const totalPages = pageStatuses?.length ?? 0

  const pmas = (dealer.pmas ?? []).sort((a, b) => a.priority_order - b.priority_order)
  const models = (dealer.priority_models ?? []).sort(
    (a, b) => a.priority_order - b.priority_order
  )
  const activeFlags = (dealer.eligibility ?? []).filter((e) => e.flag_value)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dealer.name}</h1>
          <p className="text-muted-foreground">
            {dealer.oem} · {dealer.package_tier}
            {dealer.account_managers?.name
              ? ` · ${dealer.account_managers.name}`
              : ""}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <div>
            <span className="text-muted-foreground">Website: </span>
            {dealer.website ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Address: </span>
            {dealer.address ?? "—"}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PMAs ({pmas.length})</CardTitle>
            <CardDescription>Priority order · mod score</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {pmas.map((p) => (
              <div key={p.priority_order} className="flex justify-between">
                <span>
                  {p.priority_order}. {p.city}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {Number(p.mod_score).toFixed(2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Models ({models.length})</CardTitle>
            <CardDescription>Priority order · mod score</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {models.map((m) => (
              <div key={m.priority_order} className="flex justify-between">
                <span>
                  {m.priority_order}. {m.model}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {Number(m.mod_score).toFixed(2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Eligibility ({activeFlags.length} active)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {activeFlags.length ? (
            activeFlags.map((e) => (
              <Badge key={e.flag_key} variant="secondary">
                {humanizeFlag(e.flag_key)}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">None enabled.</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Pages ({totalPages})</CardTitle>
            <CardDescription>
              Generated from the page templates. The filterable table + CSV
              export arrives in Step 8.
            </CardDescription>
          </div>
          <RegeneratePagesButton dealerId={id} hasPages={totalPages > 0} />
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {totalPages === 0 ? (
            <span className="text-sm text-muted-foreground">
              No pages generated.
            </span>
          ) : (
            Object.entries(statusCounts)
              .sort()
              .map(([status, count]) => (
                <Badge key={status} variant="outline">
                  {status}: {count}
                </Badge>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
