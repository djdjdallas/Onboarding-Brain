"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy, FileText } from "lucide-react"

import { pageLabel } from "@/lib/jira-export"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** Fills the template's brief with dealer/page variables and copies it. */
function buildDescription({ dealerName, page, description }) {
  const label = pageLabel(page)
  const vars = {
    dealer: dealerName ?? "",
    model: page.model ?? "",
    pma: page.pma_city ?? "",
    city: page.pma_city ?? "",
    page: label,
    url: page.url ?? "",
  }
  let body = description ?? ""
  for (const [k, v] of Object.entries(vars)) {
    body = body.replaceAll(`{{${k}}}`, v).replaceAll(`{${k}}`, v)
  }
  const facts = [
    page.model ? `Model: ${page.model}` : null,
    page.pma_city ? `PMA: ${page.pma_city}` : null,
    page.url ? `URL: ${page.url}` : null,
  ]
    .filter(Boolean)
    .join("\n")
  return `Web Page: ${dealerName} - ${label}\n\n${body}${facts ? `\n\n---\n${facts}` : ""}`.trim()
}

export function GenerateJiraDescription({ dealerName, page, description }) {
  const [open, setOpen] = useState(false)
  const text = buildDescription({ dealerName, page, description })

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard.")
    } catch {
      toast.error("Couldn't copy — select and copy manually.")
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileText />
        Generate Jira description
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Jira description</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[55vh] overflow-y-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap">
            {text}
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
