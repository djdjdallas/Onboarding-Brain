"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Sparkles, Copy } from "lucide-react"

import { draftPageContentAction } from "@/app/(app)/dealers/[id]/page-actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function DraftContentButton({ dealerId, pageId }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [pending, start] = useTransition()

  function run() {
    start(async () => {
      const res = await draftPageContentAction(dealerId, pageId)
      if (res?.error) return toast.error(res.error)
      setDraft(res.draft)
      setOpen(true)
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft)
      toast.success("Draft copied.")
    } catch {
      toast.error("Couldn't copy.")
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={run} disabled={pending}>
        <Sparkles />
        {pending ? "Drafting…" : "Draft with AI"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI content draft</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[55vh] overflow-y-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
            {draft}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={copy}>
              <Copy />
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
