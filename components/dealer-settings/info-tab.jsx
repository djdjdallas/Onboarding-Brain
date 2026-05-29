"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { saveDealerInfo } from "@/app/(app)/dealers/[id]/settings/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function InfoTab({ dealer, packageTiers, accountManagers, primaryPmaCity }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: dealer.name ?? "",
    website: dealer.website ?? "",
    address: dealer.address ?? "",
    package_tier_id: dealer.package_tier_id ?? "",
    service_start_month: dealer.service_start_month ?? "",
    am_id: dealer.am_id ?? "",
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    const res = await saveDealerInfo(dealer.id, {
      ...form,
      package_tier_id: form.package_tier_id || null,
      am_id: form.am_id || null,
      service_start_month: form.service_start_month || null,
    })
    setSaving(false)
    if (res?.error) return toast.error(res.error)
    toast.success("Dealer info saved.")
    router.refresh()
  }

  return (
    <div className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="d-name">Name</Label>
        <Input id="d-name" value={form.name} onChange={(e) => set("name")(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="d-website">Website</Label>
        <Input id="d-website" value={form.website} onChange={(e) => set("website")(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="d-address">Address</Label>
        <Input id="d-address" value={form.address} onChange={(e) => set("address")(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Package tier</Label>
          <Select value={form.package_tier_id || "none"} onValueChange={(v) => set("package_tier_id")(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {packageTiers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="d-start">Service start month</Label>
          <Input
            id="d-start"
            type="date"
            value={form.service_start_month}
            onChange={(e) => set("service_start_month")(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Account manager</Label>
          <Select value={form.am_id || "none"} onValueChange={(v) => set("am_id")(v === "none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {accountManagers.map((am) => (
                <SelectItem key={am.id} value={am.id}>
                  {am.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Primary PMA</Label>
          <Input value={primaryPmaCity ?? "—"} disabled />
          <p className="text-xs text-muted-foreground">Set on the PMAs tab.</p>
        </div>
      </div>
      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save info"}
        </Button>
      </div>
    </div>
  )
}
