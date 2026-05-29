import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata = { title: "Workload · SEO Page Manager" }

export default async function WorkloadPage() {
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from("am_workload")
    .select("*")
    .order("due_30", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workload</h1>
        <p className="text-muted-foreground">
          Open, scheduled work per account manager. Date windows are relative to
          today.
        </p>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load workload</CardTitle>
            <CardDescription>
              {error.message?.includes("am_workload")
                ? "The am_workload view is missing — run supabase/migrations/0008_v21_am_workload_view.sql."
                : error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !rows?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>No scheduled work</CardTitle>
            <CardDescription>
              Workload appears once dealers have an assigned AM and pages with due
              dates.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account manager</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Due 7d</TableHead>
                <TableHead className="text-right">Due 30d</TableHead>
                <TableHead className="text-right">Builds</TableHead>
                <TableHead className="text-right">Optimizes</TableHead>
                <TableHead className="text-right">Open total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.am_id}>
                  <TableCell className="font-medium">{r.am_name}</TableCell>
                  <TableCell className="text-right">
                    {r.overdue > 0 ? (
                      <Badge variant="destructive">{r.overdue}</Badge>
                    ) : (
                      <span className="text-muted-foreground tabular-nums">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.due_7}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{r.due_30}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.builds}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.optimizes}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.open_total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
