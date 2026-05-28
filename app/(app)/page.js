import Link from "next/link"
import { Plus } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { DealerTable } from "@/components/dealer-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: dealers, error } = await supabase
    .from("dealer_dashboard")
    .select("*")
    .order("name")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {dealers?.length
              ? `${dealers.length} dealer${dealers.length === 1 ? "" : "s"}`
              : "All dealers and their open audit findings."}
          </p>
        </div>
        <Button asChild>
          <Link href="/dealers/new">
            <Plus />
            Add Dealer
          </Link>
        </Button>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load dealers</CardTitle>
            <CardDescription>
              {error.message?.includes("dealer_dashboard")
                ? "The dealer_dashboard view is missing — run supabase/migrations/0002_dealer_dashboard_view.sql."
                : error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : dealers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No dealers yet</CardTitle>
            <CardDescription>
              Onboard your first dealer to generate its page plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dealers/new">
                <Plus />
                Add Dealer
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DealerTable dealers={dealers} />
      )}
    </div>
  )
}
