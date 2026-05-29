import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { PagesTab } from "@/components/pages-tab"
import { RunAuditButton } from "@/components/run-audit-button"
import { FindingsList } from "@/components/findings-list"
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
    .select("id, name, oem, package_tier, account_managers(name)")
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

  const { data: findings } = await supabase
    .from("audit_findings_detail")
    .select("id, finding_type, details, status, created_at, page_url, page_type")
    .eq("dealer_id", id)
    .order("created_at", { ascending: false })

  const openFindings = (findings ?? []).filter((f) => f.status === "open").length

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
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/dealers/${id}/settings`}>Settings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to dashboard</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="findings">
            Findings{openFindings ? ` (${openFindings})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-4">
          <PagesTab dealerId={id} dealerName={dealer.name} pages={pages} />
        </TabsContent>

        <TabsContent value="findings" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle className="text-base">Audit findings</CardTitle>
                <CardDescription>
                  Broken URLs, sitemap gaps, title mismatches, and pages found in
                  the sitemap but not the plan.
                </CardDescription>
              </div>
              <RunAuditButton dealerId={id} />
            </CardHeader>
            <CardContent>
              <FindingsList findings={findings ?? []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
