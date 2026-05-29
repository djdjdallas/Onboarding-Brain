import { createClient } from "@/lib/supabase/server"
import { AccountManagersTable } from "@/components/admin/account-managers-table"

export default async function AccountManagersPage() {
  const supabase = await createClient()

  const [{ data: managers }, { data: dealers }] = await Promise.all([
    supabase
      .from("account_managers")
      .select("id, name, email, jira_user_string, is_active")
      .order("name"),
    supabase.from("dealers").select("am_id"),
  ])

  const counts = {}
  for (const d of dealers ?? []) {
    if (d.am_id) counts[d.am_id] = (counts[d.am_id] ?? 0) + 1
  }
  const rows = (managers ?? []).map((m) => ({ ...m, dealer_count: counts[m.id] ?? 0 }))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Account Managers</h2>
        <p className="text-sm text-muted-foreground">
          The team. Set a Jira user string so exports populate the Reporter field.
        </p>
      </div>
      <AccountManagersTable managers={rows} />
    </div>
  )
}
