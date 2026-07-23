"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, X, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { Reminder, ReminderType } from "@/lib/reminders"

interface RemindersCardProps {
  reminders: Reminder[]
  /** Where the "Start a workout" action points, for the workout nudge. */
  startWorkoutHref?: string
}

/** Today as YYYY-MM-DD (local) — dismissals reset each day. */
function localToday(): string {
  return new Date().toLocaleDateString("en-CA")
}

function dismissKey(day: string): string {
  return `craigfitness:reminders-dismissed:${day}`
}

/**
 * Surfaces the day's reminder nudges. Each can be dismissed for the rest of
 * the day (persisted in localStorage, keyed by date so it resets tomorrow).
 * Renders nothing when there's nothing to nudge.
 */
export function RemindersCard({ reminders, startWorkoutHref }: RemindersCardProps) {
  const [dismissed, setDismissed] = useState<Set<ReminderType>>(new Set())

  // Load today's dismissals after mount (localStorage isn't available during
  // SSR; deferring avoids a hydration mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(dismissKey(localToday()))
      if (raw) setDismissed(new Set(JSON.parse(raw) as ReminderType[]))
    } catch {
      // Ignore malformed/unavailable storage — reminders just won't persist.
    }
  }, [])

  function dismiss(type: ReminderType) {
    setDismissed((prev) => {
      const next = new Set(prev).add(type)
      try {
        window.localStorage.setItem(
          dismissKey(localToday()),
          JSON.stringify([...next])
        )
      } catch {
        // Non-fatal — dismissal just won't survive a reload.
      }
      return next
    })
  }

  const visible = reminders.filter((r) => !dismissed.has(r.type))
  if (visible.length === 0) return null

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardContent className="space-y-2 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700">
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          Reminders
        </div>
        <ul className="space-y-2">
          {visible.map((r) => (
            <li
              key={r.type}
              className="flex items-start gap-2 rounded-lg border border-purple-100 bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{r.title}</p>
                <p className="text-xs text-gray-500">{r.detail}</p>
                {r.type === "log_workout" && startWorkoutHref && (
                  <Link
                    href={startWorkoutHref}
                    className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-purple-600 hover:text-purple-700"
                  >
                    Start a workout
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(r.type)}
                aria-label={`Dismiss: ${r.title}`}
                className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
