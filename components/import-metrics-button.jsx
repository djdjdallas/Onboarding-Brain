"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BarChart3 } from "lucide-react"

import { importDealerMetrics } from "@/app/(app)/dealers/[id]/metrics-actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** Paste a Google Search Console "Pages" CSV export to attach metrics by URL. */
export function ImportMetricsButton({ dealerId }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const res = await importDealerMetrics(dealerId, csv)
    setBusy(false)
    if (res?.error) return toast.error(res.error)
    toast.success(`Imported ${res.imported} page metrics${res.unmatched ? ` · ${res.unmatched} unmatched` : ""}.`)
    setCsv("")
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <BarChart3 />
        Import metrics
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Search Console metrics</DialogTitle>
            <DialogDescription>
              Paste the GSC &quot;Pages&quot; CSV export. Rows are matched to pages by URL.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <Textarea
              rows={10}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"Top pages,Clicks,Impressions,CTR,Position\nhttps://...,120,3400,3.5%,8.2"}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Importing…" : "Import"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
