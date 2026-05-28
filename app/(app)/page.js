import Link from "next/link"
import { Plus } from "lucide-react"

import { DealerList } from "@/components/dealer-list"
import { Button } from "@/components/ui/button"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            All dealers and their open audit findings.
          </p>
        </div>
        <Button asChild>
          <Link href="/dealers/new">
            <Plus />
            Add Dealer
          </Link>
        </Button>
      </div>
      <DealerList />
    </div>
  )
}
