import { createClient } from "@/lib/supabase/server"
import { SubtaskTypesTable } from "@/components/admin/subtask-types-table"

export default async function SubtaskTypesPage() {
  const supabase = await createClient()
  const { data: subtaskTypes } = await supabase
    .from("subtask_types")
    .select("*")
    .order("sort_order")

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Subtask Types</h2>
        <p className="text-sm text-muted-foreground">
          Work types and their playbooks. V2.1 will generate Jira subtasks from these.
        </p>
      </div>
      <SubtaskTypesTable subtaskTypes={subtaskTypes ?? []} />
    </div>
  )
}
