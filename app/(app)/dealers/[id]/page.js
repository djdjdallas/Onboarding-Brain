import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { humanizeFlag } from "@/lib/eligibility"
import { pageLabel } from "@/lib/jira-export"
import { PagesTab } from "@/components/pages-tab"
import { DiscoveredTab } from "@/components/discovered-tab"
import { FactSheet } from "@/components/fact-sheet"
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
    .select("id, name, oem, package_tier, website, address, account_managers(name)")
    .eq("id", id)
    .single()

  if (!dealer) notFound()

  const { data: rawPages } = await supabase
    .from("pages")
    .select(
      "id, model, pma_city, status, next_step, url, priority_score, due_date, " +
        "manual_priority_adjustment, manually_scheduled_due_date, notes, labels, " +
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
    manual_priority_adjustment: p.manual_priority_adjustment ?? 0,
    manually_scheduled_due_date: p.manually_scheduled_due_date,
    notes: p.notes,
    labels: p.labels ?? [],
  }))

  const { data: findings } = await supabase
    .from("audit_findings_detail")
    .select("id, finding_type, details, status, created_at, page_url, page_type")
    .eq("dealer_id", id)
    .order("created_at", { ascending: false })

  const [{ data: discovered }, { data: dTemplates }, { data: dModels }, { data: dPmas }] =
    await Promise.all([
      supabase
        .from("discovered_pages")
        .select("id, url, first_seen_at, suggested_template_id, suggested_confidence, status, notes")
        .eq("dealer_id", id)
        .order("first_seen_at", { ascending: false }),
      supabase.from("page_templates").select("id, page_type, requires_model, requires_pma").eq("oem", "KIA").order("page_type"),
      supabase.from("priority_models").select("model").eq("dealer_id", id).order("priority_order"),
      supabase.from("pmas").select("city").eq("dealer_id", id).order("priority_order"),
    ])
  const openDiscovered = (discovered ?? []).filter((d) => d.status === "open").length

  // Fact sheet data.
  const [{ data: fsPmas }, { data: fsModels }, { data: fsElig }] = await Promise.all([
    supabase.from("pmas").select("city, priority_order").eq("dealer_id", id).order("priority_order"),
    supabase.from("priority_models").select("model, priority_order, tracked").eq("dealer_id", id).order("priority_order"),
    supabase
      .from("eligibility")
      .select("flag_key, flag_value, eligibility_flag_types(label)")
      .eq("dealer_id", id)
      .eq("flag_value", true),
  ])
  const urlsByFamily = {}
  for (const p of pages) {
    if (!p.url) continue
    const fam = p.page_family ?? "Other"
    ;(urlsByFamily[fam] ??= []).push({ label: pageLabel(p), url: p.url })
  }
  const factSheet = {
    name: dealer.name,
    oem: dealer.oem,
    packageTier: dealer.package_tier,
    amName: dealer.account_managers?.name ?? null,
    website: dealer.website,
    address: dealer.address,
    pmas: fsPmas ?? [],
    models: (fsModels ?? []).map((m) => ({ model: m.model, tracked: m.tracked !== false })),
    flags: (fsElig ?? []).map((e) => e.eligibility_flag_types?.label ?? humanizeFlag(e.flag_key)).sort(),
    urlsByFamily,
  }

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
          <TabsTrigger value="discovered">
            Discovered{openDiscovered ? ` (${openDiscovered})` : ""}
          </TabsTrigger>
          <TabsTrigger value="findings">
            Findings{openFindings ? ` (${openFindings})` : ""}
          </TabsTrigger>
          <TabsTrigger value="fact-sheet">Fact Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="mt-4">
          <PagesTab dealerId={id} dealerName={dealer.name} pages={pages} />
        </TabsContent>

        <TabsContent value="discovered" className="mt-4">
          <DiscoveredTab
            dealerId={id}
            discovered={discovered ?? []}
            templates={dTemplates ?? []}
            models={(dModels ?? []).map((m) => m.model)}
            pmas={(dPmas ?? []).map((p) => p.city)}
          />
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

        <TabsContent value="fact-sheet" className="mt-4">
          <FactSheet factSheet={factSheet} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
