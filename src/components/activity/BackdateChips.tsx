"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

type Choice = "today" | "yesterday" | "earlier"

interface BackdateChipsProps {
  /** ISO datetime-local string (YYYY-MM-DDTHH:mm) representing when the
   *  event happened. */
  value: string
  onChange: (value: string) => void
}

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

function toLocalDatetimeString(d: Date): string {
  return `${localDateString(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Helpers exposed for callers that need the default starting value. */
export function nowLocalDatetimeString(): string {
  return toLocalDatetimeString(new Date())
}

/** Split a datetime-local string into its date and time halves, falling back
 *  to now for a missing/malformed value so the inputs always have a value. */
function splitParts(value: string): { date: string; time: string } {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (m) return { date: m[1], time: m[2] }
  const now = nowLocalDatetimeString()
  return { date: now.slice(0, 10), time: now.slice(11, 16) }
}

export function BackdateChips({ value, onChange }: BackdateChipsProps) {
  const { date, time } = splitParts(value)

  const todayStr = localDateString(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = localDateString(yesterday)

  // Which chip is active is inferred from the date half of the value.
  const active: Choice =
    date === todayStr ? "today" : date === yesterdayStr ? "yesterday" : "earlier"

  const [showDatePicker, setShowDatePicker] = useState(active === "earlier")

  function pick(choice: Choice) {
    // Chips set the day but preserve the time-of-day, which stays editable
    // in the always-visible time input below.
    if (choice === "today") {
      setShowDatePicker(false)
      onChange(`${todayStr}T${time}`)
    } else if (choice === "yesterday") {
      setShowDatePicker(false)
      onChange(`${yesterdayStr}T${time}`)
    } else {
      setShowDatePicker(true)
    }
  }

  const Chip = ({ choice, label }: { choice: Choice; label: string }) => (
    <button
      type="button"
      onClick={() => pick(choice)}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active === choice
          ? "bg-purple-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      )}
    >
      {label}
    </button>
  )

  const inputClass =
    "rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Chip choice="today" label="Today" />
        <Chip choice="yesterday" label="Yesterday" />
        <Chip choice="earlier" label="Earlier…" />
      </div>
      <div className="flex items-center gap-2">
        {(showDatePicker || active === "earlier") && (
          <input
            type="date"
            aria-label="Date"
            value={date}
            max={todayStr}
            onChange={(e) =>
              e.target.value && onChange(`${e.target.value}T${time}`)
            }
            className={cn(inputClass, "flex-1")}
          />
        )}
        <input
          type="time"
          aria-label="Time"
          value={time}
          onChange={(e) =>
            e.target.value && onChange(`${date}T${e.target.value}`)
          }
          className={inputClass}
        />
      </div>
    </div>
  )
}
