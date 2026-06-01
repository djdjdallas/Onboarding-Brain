"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { subtaskTypeSchema, SUBTASK_FIELDS } from "@/lib/validation/subtask-type"
import {
  createSubtaskType,
  updateSubtaskType,
  deleteSubtaskType,
} from "@/app/(app)/admin/subtask-types/actions"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const BLANK = Object.fromEntries(SUBTASK_FIELDS.map((f) => [f.name, f.name === "sort_order" ? 0 : ""]))

export function SubtaskTypesTable({ subtaskTypes }) {
  const router = useRouter()
  const [dialog, setDialog] = useState(null) // null | {mode:'add'} | {mode:'edit', row}
  const form = useForm({ resolver: zodResolver(subtaskTypeSchema), defaultValues: BLANK })

  function openAdd() {
    form.reset({ ...BLANK, sort_order: subtaskTypes.length })
    setDialog({ mode: "add" })
  }
  function openEdit(row) {
    const values = {}
    for (const f of SUBTASK_FIELDS) values[f.name] = row[f.name] ?? (f.name === "sort_order" ? 0 : "")
    form.reset(values)
    setDialog({ mode: "edit", row })
  }

  async function onSubmit(values) {
    const res =
      dialog.mode === "add"
        ? await createSubtaskType(values)
        : await updateSubtaskType(dialog.row.id, values)
    if (res?.error) return toast.error(res.error)
    toast.success(dialog.mode === "add" ? "Subtask type added." : "Saved.")
    setDialog(null)
    router.refresh()
  }

  async function remove(row) {
    const res = await deleteSubtaskType(row.id)
    if (res?.error) toast.error(res.error)
    else {
      toast.success("Deleted.")
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus />
          Add subtask type
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Work type</TableHead>
              <TableHead>Summary pattern</TableHead>
              <TableHead>Likely owner</TableHead>
              <TableHead className="text-right">Sort</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subtaskTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  None yet. Run <code>npm run seed:subtasks</code> or add one.
                </TableCell>
              </TableRow>
            ) : (
              subtaskTypes.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.work_type}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.summary_pattern ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.likely_owner ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.sort_order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="xs" variant="outline" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button size="xs" variant="ghost">
                            Delete
                          </Button>
                        }
                        title={`Delete "${row.work_type}"?`}
                        description="This can't be undone."
                        confirmLabel="Delete"
                        confirmVariant="destructive"
                        onConfirm={() => remove(row)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit" ? "Edit subtask type" : "Add subtask type"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            {SUBTASK_FIELDS.map((f) => (
              <div key={f.name} className="grid gap-2">
                <Label htmlFor={`st-${f.name}`}>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea id={`st-${f.name}`} rows={2} {...form.register(f.name)} />
                ) : (
                  <Input
                    id={`st-${f.name}`}
                    type={f.type === "int" ? "number" : "text"}
                    {...form.register(f.name)}
                  />
                )}
                {form.formState.errors[f.name] ? (
                  <p className="text-tiny text-destructive">
                    {form.formState.errors[f.name].message}
                  </p>
                ) : null}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
