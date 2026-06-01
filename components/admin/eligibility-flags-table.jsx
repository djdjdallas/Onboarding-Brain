"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { flagTypeSchema, UI_GROUPS } from "@/lib/validation/eligibility-flag"
import {
  createFlagType,
  updateFlagType,
  deleteFlagType,
} from "@/app/(app)/admin/eligibility-flags/actions"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function EligibilityFlagsTable({ flags }) {
  const router = useRouter()
  const [dialog, setDialog] = useState(null) // null | {mode:'add'} | {mode:'edit', flag}

  const form = useForm({
    resolver: zodResolver(flagTypeSchema),
    defaultValues: { label: "", description: "", ui_group: "Other", sort_order: 0 },
  })

  function openAdd() {
    form.reset({ label: "", description: "", ui_group: "Other", sort_order: flags.length })
    setDialog({ mode: "add" })
  }
  function openEdit(flag) {
    form.reset({
      label: flag.label ?? "",
      description: flag.description ?? "",
      ui_group: flag.ui_group ?? "Other",
      sort_order: flag.sort_order ?? 0,
    })
    setDialog({ mode: "edit", flag })
  }

  async function onSubmit(values) {
    const res =
      dialog.mode === "add"
        ? await createFlagType(values)
        : await updateFlagType(dialog.flag.id, values)
    if (res?.error) return toast.error(res.error)
    toast.success(dialog.mode === "add" ? "Flag added." : "Saved.")
    setDialog(null)
    router.refresh()
  }

  async function remove(flag) {
    const res = await deleteFlagType(flag.id)
    if (res?.error) toast.error(res.error)
    else {
      toast.success("Flag deleted.")
      router.refresh()
    }
  }

  const group = form.watch("ui_group")

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus />
          Add flag
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Group</TableHead>
              <TableHead className="text-right">Sort</TableHead>
              <TableHead className="text-right">In use</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-small text-muted-foreground">
                  No flags. Run <code>npm run seed:eligibility-types</code> or add one.
                </TableCell>
              </TableRow>
            ) : (
              flags.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.label}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{f.key}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{f.ui_group}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{f.sort_order}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {f.usage}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="xs" variant="outline" onClick={() => openEdit(f)}>
                        Edit
                      </Button>
                      {f.usage > 0 ? (
                        <Button size="xs" variant="ghost" disabled title="In use by dealers">
                          Delete
                        </Button>
                      ) : (
                        <ConfirmDialog
                          trigger={
                            <Button size="xs" variant="ghost">
                              Delete
                            </Button>
                          }
                          title={`Delete "${f.label}"?`}
                          description="No dealers use this flag. This can't be undone."
                          confirmLabel="Delete"
                          confirmVariant="destructive"
                          onConfirm={() => remove(f)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Edit flag" : "Add flag"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="flag-label">Label</Label>
              <Input id="flag-label" {...form.register("label")} />
              {form.formState.errors.label ? (
                <p className="text-tiny text-destructive">{form.formState.errors.label.message}</p>
              ) : null}
              {dialog?.mode === "edit" ? (
                <p className="text-xs text-muted-foreground">
                  Key <code>{dialog.flag.key}</code> can&apos;t change (referenced by templates and dealers).
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  A stable key is generated from the label.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="flag-desc">Description</Label>
              <Input id="flag-desc" placeholder="Optional" {...form.register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Group</Label>
                <Select value={group} onValueChange={(v) => form.setValue("ui_group", v, { shouldValidate: true })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UI_GROUPS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="flag-sort">Sort order</Label>
                <Input id="flag-sort" type="number" {...form.register("sort_order")} />
              </div>
            </div>
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
