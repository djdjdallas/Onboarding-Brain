import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { humanizeFlag } from "@/lib/eligibility"
import { PagesTab } from "@/components/pages-tab"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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

  const { data: rawPages } = await supabase
    .from("pages")
    .select(
      "id, model, pma_city, status, next_step, url, priority_score, due_date, " +
        "page_templates(page_type, page_family)"
    )
    .eq("dealer_id", id)
    .order("priority_score", { ascending: false, nullsFirst: false })

  const pages = (rawPages ?? []).map((p) => ({
    id: p.id,
    page_type: p.page_templates?.page_type ?? "(unknown)",
    page_family: p.page_templates?.page_family ?? null,
    model: p.model,
    pma_city: p.pma_city,
    status: p.status,
    next_step: p.next_step,
    url: p.url,
    priority_score: p.priority_score,
    due_date: p.due_date,
  }))

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
            {dealer.account_managers?.name ? ` · ${dealer.account_managers.name}` : ""}
            {" · "}
            {pages.length} pages
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>

      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-4">
          <PagesTab dealerId={id} dealerName={dealer.name} pages={pages} />
        </TabsContent>

        <TabsContent value="findings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit findings</CardTitle>
              <CardDescription>
                Broken URLs, title mismatches, and discovered pages appear here
                once the audit system lands (Step 12).
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-6">
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
