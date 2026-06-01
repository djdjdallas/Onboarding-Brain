import Link from "next/link"
import { Plus, Building2, AlertTriangle } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { DealerTable } from "@/components/dealer-table"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

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
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load dealers"
        description={
          error.message?.includes("dealer_dashboard")
            ? "The dealer_dashboard view is missing — run supabase/migrations/0002_dealer_dashboard_view.sql."
            : error.message
        }
      />
    )
  }

  if (!dealers?.length) {
    return (
      <EmptyState
        icon={Building2}
        title="No dealers yet"
        description="Onboard your first dealer to generate its page plan."
        action={
          <Button asChild>
            <Link href="/dealers/new">
              <Plus />
              Add Dealer
            </Link>
          </Button>
        }
      />
    )
  }

  return <DealerTable dealers={dealers} />
}
