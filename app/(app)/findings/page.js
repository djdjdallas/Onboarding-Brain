import { createClient } from "@/lib/supabase/server"
import { GlobalFindings } from "@/components/global-findings"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function FindingsPage() {
  const supabase = await createClient()
  const { data: findings, error } = await supabase
    .from("audit_findings_detail")
    .select(
      "id, finding_type, details, status, created_at, dealer_name, page_url, page_type"
    )
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Findings</h1>
        <p className="text-muted-foreground">
          Issues found across all dealers&apos; live pages.
        </p>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load findings</CardTitle>
            <CardDescription>
              {error.message?.includes("audit_findings_detail")
                ? "The audit_findings_detail view is missing — run supabase/migrations/0003_audit_findings_detail_view.sql."
                : error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <GlobalFindings findings={findings ?? []} />
      )}
    </div>
  )
}
