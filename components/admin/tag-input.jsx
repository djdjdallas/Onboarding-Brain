"use client"

import { useState } from "react"
import { X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

/** Free-text tag input. value is a string[]; onChange gets the new array. */
export function TagInput({ value = [], onChange, placeholder = "Add and press Enter" }) {
  const [draft, setDraft] = useState("")

  function add() {
    const v = draft.trim()
    if (!v || value.includes(v)) {
      setDraft("")
      return
    }
    onChange([...value, v])
    setDraft("")
  }

  return (
    <div className="grid gap-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            add()
          }
        }}
        placeholder={placeholder}
      />
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
