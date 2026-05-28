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

/**
 * Server component: fetches the dealer_dashboard view and renders the table,
 * an empty state, or a migration hint. Shared by / (Dashboard) and /dealers.
 */
export async function DealerList() {
  const supabase = await createClient()
  const { data: dealers, error } = await supabase
    .from("dealer_dashboard")
    .select("*")
    .order("name")

  if (error) {
    return (
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
    )
  }

  if (!dealers?.length) {
    return (
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
    )
  }

  return <DealerTable dealers={dealers} />
}
