import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InfoTab } from "@/components/dealer-settings/info-tab"
import { PmasTab } from "@/components/dealer-settings/pmas-tab"
import { ModelsTab } from "@/components/dealer-settings/models-tab"
import { EligibilityTab } from "@/components/dealer-settings/eligibility-tab"
import { KeywordTargetsTab } from "@/components/dealer-settings/keyword-targets-tab"
import { HistoryTab } from "@/components/dealer-settings/history-tab"

export default async function DealerSettingsPage({ params }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: dealer } = await supabase
    .from("dealers")
    .select(
      "id, name, website, address, am_id, package_tier_id, service_start_month, primary_pma_id"
    )
    .eq("id", id)
    .single()
  if (!dealer) notFound()

  const [
    { data: tiers },
    { data: ams },
    { data: pmas },
    { data: models },
    { data: flagTypes },
    { data: eligibility },
    { data: keywords },
    { data: targets },
    { data: pageRows },
  ] = await Promise.all([
    supabase.from("package_tiers").select("id, name").order("name"),
    supabase.from("account_managers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("pmas").select("id, city, priority_order").eq("dealer_id", id).order("priority_order"),
    supabase.from("priority_models").select("id, model, priority_order, tracked").eq("dealer_id", id).order("priority_order"),
    supabase.from("eligibility_flag_types").select("key, label, ui_group").order("sort_order"),
    supabase.from("eligibility").select("flag_key, flag_value").eq("dealer_id", id),
    supabase.from("keywords").select("id, keyword").eq("is_active", true).order("keyword"),
    supabase.from("keyword_targets").select("keyword_id, pma_id, is_targeted").eq("dealer_id", id),
    supabase.from("pages").select("id").eq("dealer_id", id),
  ])

  // Eligibility values: every flag type defaults to its current dealer value.
  const eligByKey = Object.fromEntries((eligibility ?? []).map((e) => [e.flag_key, e.flag_value]))
  const values = Object.fromEntries((flagTypes ?? []).map((f) => [f.key, !!eligByKey[f.key]]))

  const primaryPmaCity = (pmas ?? []).find((p) => p.id === dealer.primary_pma_id)?.city ?? null
  const targetedKeys = (targets ?? []).filter((t) => t.is_targeted).map((t) => `${t.keyword_id}|${t.pma_id}`)

  // Audit history for this dealer + its pages.
  const pageIds = (pageRows ?? []).map((p) => p.id)
  const { data: log } = await supabase
    .from("audit_log")
    .select("id, entity_type, field_name, old_value, new_value, changed_at, changed_by")
    .in("entity_id", [id, ...pageIds])
    .order("changed_at", { ascending: false })
    .limit(100)
  const { data: actors } = await supabase.from("account_managers").select("id, name")
  const actorName = Object.fromEntries((actors ?? []).map((a) => [a.id, a.name]))
  const entries = (log ?? []).map((e) => ({ ...e, actor_name: e.changed_by ? actorName[e.changed_by] : null }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-display font-medium tracking-tight">{dealer.name}</h1>
          <p className="text-small text-muted-foreground">Settings</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/dealers/${id}`}>Back to dealer</Link>
        </Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="pmas">PMAs</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="keywords">Keyword Targets</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <InfoTab
            dealer={dealer}
            packageTiers={tiers ?? []}
            accountManagers={ams ?? []}
            primaryPmaCity={primaryPmaCity}
          />
        </TabsContent>
        <TabsContent value="pmas" className="mt-4">
          <PmasTab dealerId={id} pmas={pmas ?? []} primaryCity={primaryPmaCity} />
        </TabsContent>
        <TabsContent value="models" className="mt-4">
          <ModelsTab dealerId={id} models={models ?? []} />
        </TabsContent>
        <TabsContent value="eligibility" className="mt-4">
          <EligibilityTab dealerId={id} flagTypes={flagTypes ?? []} values={values} />
        </TabsContent>
        <TabsContent value="keywords" className="mt-4">
          <KeywordTargetsTab
            dealerId={id}
            keywords={keywords ?? []}
            pmas={pmas ?? []}
            targeted={targetedKeys}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab entries={entries} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
