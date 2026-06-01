"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { accountManagerSchema } from "@/lib/validation/account-manager"
import {
  createAccountManager,
  updateAccountManager,
  setAccountManagerActive,
} from "@/app/(app)/admin/account-managers/actions"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusPill } from "@/components/ui/status-pill"
import { Checkbox } from "@/components/ui/checkbox"
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

export function AccountManagersTable({ managers }) {
  const router = useRouter()
  const [showInactive, setShowInactive] = useState(false)
  const [dialog, setDialog] = useState(null) // null | {mode:'add'} | {mode:'edit', am}

  const form = useForm({
    resolver: zodResolver(accountManagerSchema),
    defaultValues: { name: "", email: "", jira_user_string: "" },
  })

  const visible = managers.filter((m) => showInactive || m.is_active)

  function openAdd() {
    form.reset({ name: "", email: "", jira_user_string: "" })
    setDialog({ mode: "add" })
  }
  function openEdit(am) {
    form.reset({
      name: am.name ?? "",
      email: am.email ?? "",
      jira_user_string: am.jira_user_string ?? "",
    })
    setDialog({ mode: "edit", am })
  }

  async function onSubmit(values) {
    const res =
      dialog.mode === "add"
        ? await createAccountManager(values)
        : await updateAccountManager(dialog.am.id, values)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success(dialog.mode === "add" ? "Account manager added." : "Saved.")
    setDialog(null)
    router.refresh()
  }

  async function setActive(am, active) {
    const res = await setAccountManagerActive(am.id, active)
    if (res?.error) toast.error(res.error)
    else {
      toast.success(active ? "Reactivated." : "Deactivated.")
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showInactive} onCheckedChange={(c) => setShowInactive(!!c)} />
          Show inactive
        </label>
        <Button size="sm" onClick={openAdd}>
          <Plus />
          Add account manager
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Jira user</TableHead>
              <TableHead className="text-right">Dealers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-small text-muted-foreground">
                  No account managers.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((am) => (
                <TableRow key={am.id} className={am.is_active ? "" : "opacity-60"}>
                  <TableCell className="font-medium">{am.name}</TableCell>
                  <TableCell className="text-muted-foreground">{am.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {am.jira_user_string ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{am.dealer_count}</TableCell>
                  <TableCell>
                    <StatusPill
                      status={am.is_active ? "live" : "backlog"}
                      label={am.is_active ? "Active" : "Inactive"}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="xs" variant="outline" onClick={() => openEdit(am)}>
                        Edit
                      </Button>
                      {am.is_active ? (
                        <ConfirmDialog
                          trigger={
                            <Button size="xs" variant="ghost">
                              Deactivate
                            </Button>
                          }
                          title={`Deactivate ${am.name}?`}
                          description={
                            am.dealer_count > 0
                              ? `They'll be hidden from assignment pickers. Their ${am.dealer_count} dealer(s) stay assigned — reassign them in each dealer's settings if needed.`
                              : "They'll be hidden from assignment pickers. You can reactivate any time."
                          }
                          confirmLabel="Deactivate"
                          onConfirm={() => setActive(am, false)}
                        />
                      ) : (
                        <Button size="xs" variant="ghost" onClick={() => setActive(am, true)}>
                          Reactivate
                        </Button>
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
            <DialogTitle>
              {dialog?.mode === "edit" ? "Edit account manager" : "Add account manager"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="am-name">Name</Label>
              <Input id="am-name" {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-tiny text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="am-email">Email</Label>
              <Input id="am-email" type="email" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-tiny text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="am-jira">Jira user string</Label>
              <Input id="am-jira" placeholder="Optional" {...form.register("jira_user_string")} />
              <p className="text-xs text-muted-foreground">
                Used as the Reporter in the Jira CSV export.
              </p>
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
