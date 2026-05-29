"use client"

import { toast } from "sonner"
import { Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function toMarkdown(fs) {
  const lines = []
  lines.push(`# ${fs.name}`)
  lines.push(
    `**OEM:** ${fs.oem} · **Package:** ${fs.packageTier ?? "—"} · **AM:** ${fs.amName ?? "Unassigned"}`
  )
  if (fs.website) lines.push(`**Website:** ${fs.website}`)
  if (fs.address) lines.push(`**Address:** ${fs.address}`)

  lines.push("", "## PMAs")
  fs.pmas.forEach((p, i) => lines.push(`${i + 1}. ${p.city}`))

  lines.push("", "## Priority Models")
  fs.models.forEach((m, i) => lines.push(`${i + 1}. ${m.model}${m.tracked ? " (tracked)" : ""}`))

  lines.push("", "## Eligibility")
  if (fs.flags.length) fs.flags.forEach((f) => lines.push(`- ${f}`))
  else lines.push("- (none)")

  lines.push("", "## Key URLs")
  const families = Object.keys(fs.urlsByFamily).sort()
  if (families.length === 0) lines.push("_No live URLs yet._")
  for (const fam of families) {
    lines.push(`### ${fam}`)
    for (const u of fs.urlsByFamily[fam]) lines.push(`- ${u.label} — ${u.url}`)
  }
  return lines.join("\n")
}

export function FactSheet({ factSheet }) {
  const md = toMarkdown(factSheet)
  const families = Object.keys(factSheet.urlsByFamily).sort()

  async function copy() {
    try {
      await navigator.clipboard.writeText(md)
      toast.success("Fact sheet copied as Markdown.")
    } catch {
      toast.error("Couldn't copy.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy />
          Copy as Markdown
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{factSheet.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <div>
            <span className="text-muted-foreground">OEM / Package: </span>
            {factSheet.oem} · {factSheet.packageTier ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">AM: </span>
            {factSheet.amName ?? "Unassigned"}
          </div>
          <div>
            <span className="text-muted-foreground">Website: </span>
            {factSheet.website ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Address: </span>
            {factSheet.address ?? "—"}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PMAs ({factSheet.pmas.length})</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {factSheet.pmas.map((p, i) => (
              <div key={p.city}>
                {i + 1}. {p.city}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Models ({factSheet.models.length})</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {factSheet.models.map((m, i) => (
              <div key={m.model}>
                {i + 1}. {m.model}
                {m.tracked ? <span className="ml-1 text-xs text-muted-foreground">tracked</span> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eligibility ({factSheet.flags.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {factSheet.flags.length ? (
            factSheet.flags.map((f) => (
              <Badge key={f} variant="secondary">
                {f}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">None enabled.</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Key URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {families.length === 0 ? (
            <span className="text-muted-foreground">No live URLs yet.</span>
          ) : (
            families.map((fam) => (
              <div key={fam}>
                <p className="font-medium">{fam}</p>
                <ul className="mt-1 grid gap-0.5">
                  {factSheet.urlsByFamily[fam].map((u) => (
                    <li key={u.url} className="text-muted-foreground">
                      {u.label} —{" "}
                      <a href={u.url} target="_blank" rel="noreferrer" className="underline">
                        {u.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
