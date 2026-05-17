"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

type Choice = "today" | "yesterday" | "earlier"

interface BackdateChipsProps {
  /** ISO datetime-local string (YYYY-MM-DDTHH:mm) representing when the
   *  workout happened. */
  value: string
  onChange: (value: string) => void
}

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

/** Helpers exposed for callers that need the default starting value. */
export function nowLocalDatetimeString(): string {
  return toLocalDatetimeString(new Date())
}

function todayDefault(): string {
  return toLocalDatetimeString(new Date())
}

function yesterdayDefault(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  // Default yesterday to 6pm — most people lift in the evening
  d.setHours(18, 0, 0, 0)
  return toLocalDatetimeString(d)
}

export function BackdateChips({ value, onChange }: BackdateChipsProps) {
  // Infer which chip is active from the value: if it's today's date use
  // Today, if yesterday's use Yesterday, otherwise Earlier.
  const valueDate = value ? new Date(value) : new Date()
  const now = new Date()
  const isToday =
    valueDate.toDateString() === now.toDateString()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = valueDate.toDateString() === yesterday.toDateString()
  const active: Choice = isToday
    ? "today"
    : isYesterday
    ? "yesterday"
    : "earlier"

  const [showEarlierPicker, setShowEarlierPicker] = useState(
    active === "earlier"
  )

  function pick(choice: Choice) {
    if (choice === "today") {
      setShowEarlierPicker(false)
      onChange(todayDefault())
    } else if (choice === "yesterday") {
      setShowEarlierPicker(false)
      onChange(yesterdayDefault())
    } else {
      setShowEarlierPicker(true)
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

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Chip choice="today" label="Today" />
        <Chip choice="yesterday" label="Yesterday" />
        <Chip choice="earlier" label="Earlier…" />
      </div>
      {(showEarlierPicker || active === "earlier") && (
        <input
          type="datetime-local"
          value={value}
          max={nowLocalDatetimeString()}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      )}
    </div>
  )
}
