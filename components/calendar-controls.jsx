"use client"

import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALL = "__all__"

// "2026-05" +/- n months, no Date math (avoids TZ drift).
function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number)
  const idx = (y * 12 + (m - 1)) + delta
  const ny = Math.floor(idx / 12)
  const nm = (idx % 12) + 1
  return `${ny}-${String(nm).padStart(2, "0")}`
}

export function CalendarControls({ month, monthLabel, amId, accountManagers }) {
  const router = useRouter()

  function go(nextMonth, nextAm) {
    const params = new URLSearchParams()
    params.set("month", nextMonth)
    if (nextAm && nextAm !== ALL) params.set("am", nextAm)
    router.push(`/calendar?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="icon-sm" variant="outline" onClick={() => go(shiftMonth(month, -1), amId)} aria-label="Previous month">
        <ChevronLeft />
      </Button>
      <span className="min-w-40 text-center text-sm font-medium">{monthLabel}</span>
      <Button size="icon-sm" variant="outline" onClick={() => go(shiftMonth(month, 1), amId)} aria-label="Next month">
        <ChevronRight />
      </Button>
      <Select value={amId ?? ALL} onValueChange={(v) => go(month, v)}>
        <SelectTrigger size="sm" className="ml-2 w-auto min-w-44">
          <SelectValue placeholder="All AMs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All account managers</SelectItem>
          {accountManagers.map((am) => (
            <SelectItem key={am.id} value={am.id}>
              {am.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
