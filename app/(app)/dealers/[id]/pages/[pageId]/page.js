import Link from "next/link"
import { notFound } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { PageDetailForm } from "@/components/page-detail-form"
import { GenerateJiraDescription } from "@/components/generate-jira-description"
import { DraftContentButton } from "@/components/draft-content-button"
import { MarkReviewedButton } from "@/components/mark-reviewed-button"
import { isLlmConfigured } from "@/lib/llm"
import { SubtasksCard } from "@/components/subtasks-card"
import { HistoryTab } from "@/components/dealer-settings/history-tab"
import { StatusPill, statusVariant } from "@/components/ui/status-pill"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function PageDetailPage({ params }) {
  const { id, pageId } = await params
  const supabase = await createClient()

  const { data: page } = await supabase
    .from("pages")
    .select(
      "id, dealer_id, model, pma_city, status, next_step, url, priority_score, due_date, " +
        "manual_priority_adjustment, manually_scheduled_due_date, last_reviewed_at, notes, labels, " +
        "page_templates(page_type, page_family, base_priority, cadence, page_intent, required_inputs, guardrail, description_template)"
    )
    .eq("id", pageId)
    .single()
  if (!page || page.dealer_id !== id) notFound()

  const tpl = page.page_templates ?? {}

  const { data: dealer } = await supabase.from("dealers").select("name").eq("id", id).single()

  const { data: subtasks } = await supabase
    .from("subtasks")
    .select("id, summary, status, owner")
    .eq("page_id", pageId)
    .order("created_at")

  const { data: metric } = await supabase
    .from("page_metrics")
    .select("captured_at, clicks, impressions, ctr, avg_position")
    .eq("page_id", pageId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Priority breakdown inputs.
  const [{ data: pma }, { data: model }] = await Promise.all([
    page.pma_city
      ? supabase.from("pmas").select("mod_score").eq("dealer_id", id).eq("city", page.pma_city).maybeSingle()
      : Promise.resolve({ data: null }),
    page.model
      ? supabase.from("priority_models").select("mod_score").eq("dealer_id", id).eq("model", page.model).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const base = Number(tpl.base_priority ?? 0)
  const modelMod = model ? Number(model.mod_score) : null
  const pmaMod = pma ? Number(pma.mod_score) : null
  const boost = page.status === "MISSING" ? 1.1 : 1
  const adj = Number(page.manual_priority_adjustment ?? 0)

  // Audit history for this page.
  const { data: log } = await supabase
    .from("audit_log")
    .select("id, entity_type, field_name, old_value, new_value, changed_at, changed_by")
    .eq("entity_id", pageId)
    .order("changed_at", { ascending: false })
    .limit(50)
  const { data: actors } = await supabase.from("account_managers").select("id, name")
  const actorName = Object.fromEntries((actors ?? []).map((a) => [a.id, a.name]))
  const entries = (log ?? []).map((e) => ({ ...e, actor_name: e.changed_by ? actorName[e.changed_by] : null }))

  const factor = (n) => (n == null ? "1" : Number(n).toFixed(2))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <h1 className="text-display font-medium tracking-tight">{tpl.page_type}</h1>
            <p className="text-small text-muted-foreground">
              {dealer?.name}
              {page.model ? ` · ${page.model}` : ""}
              {page.pma_city ? ` · ${page.pma_city}` : ""}
            </p>
          </div>
          <StatusPill status={statusVariant(page.status)} label={page.status} />
        </div>
        <Button variant="outline" asChild>
          <Link href={`/dealers/${id}`}>Back to dealer</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit</CardTitle>
          </CardHeader>
          <CardContent>
            <PageDetailForm pageId={pageId} page={page} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Priority breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-mono text-xs">
                {factor(base)} (base) × {factor(modelMod)} (model) × {factor(pmaMod)} (PMA) ×{" "}
                {boost} (missing) + {adj.toFixed(2)} (adj)
              </p>
              <p>
                = <span className="font-mono font-medium tabular-nums">{Number(page.priority_score ?? 0).toFixed(2)}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle className="text-base">Scheduling</CardTitle>
                <CardDescription>
                  Cadence: {tpl.cadence ?? "—"} · Due: {page.manually_scheduled_due_date ?? page.due_date ?? "—"}
                  {page.manually_scheduled_due_date ? " (manual)" : ""}
                </CardDescription>
              </div>
              <MarkReviewedButton dealerId={id} pageId={pageId} />
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Last reviewed: {page.last_reviewed_at ?? "never"}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Template brief</CardTitle>
              <CardDescription>{tpl.page_family}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {tpl.page_intent ? (
                <div>
                  <p className="text-muted-foreground">Intent</p>
                  <p className="whitespace-pre-wrap">{tpl.page_intent}</p>
                </div>
              ) : null}
              {tpl.required_inputs ? (
                <div>
                  <p className="text-muted-foreground">Required inputs</p>
                  <p className="whitespace-pre-wrap">{tpl.required_inputs}</p>
                </div>
              ) : null}
              {tpl.guardrail ? (
                <div>
                  <p className="text-muted-foreground">Guardrail</p>
                  <p className="whitespace-pre-wrap">{tpl.guardrail}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <GenerateJiraDescription
                  dealerName={dealer?.name}
                  page={{ page_type: tpl.page_type, model: page.model, pma_city: page.pma_city, url: page.url }}
                  description={tpl.description_template}
                />
                {isLlmConfigured() ? (
                  <DraftContentButton dealerId={id} pageId={pageId} />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance</CardTitle>
              <CardDescription>
                {metric
                  ? `Search Console · as of ${metric.captured_at}`
                  : "Import a GSC CSV on the Pages tab to see metrics."}
              </CardDescription>
            </CardHeader>
            {metric ? (
              <CardContent className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Clicks</p>
                  <p className="tabular-nums font-medium">{metric.clicks ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Impressions</p>
                  <p className="tabular-nums font-medium">{metric.impressions ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CTR</p>
                  <p className="tabular-nums font-medium">
                    {metric.ctr != null ? `${Number(metric.ctr).toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avg position</p>
                  <p className="tabular-nums font-medium">
                    {metric.avg_position != null ? Number(metric.avg_position).toFixed(1) : "—"}
                  </p>
                </div>
              </CardContent>
            ) : null}
          </Card>

          <SubtasksCard dealerId={id} pageId={pageId} subtasks={subtasks ?? []} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              <HistoryTab entries={entries} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
