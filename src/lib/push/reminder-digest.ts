import type { Reminder } from "@/lib/reminders"

export interface PushNotification {
  title: string
  body: string
  /** Where a tap should land. */
  url: string
}

/**
 * Fold the day's active reminders into a single push notification (we send at
 * most one nudge, not one-per-reminder). Each reminder gets its own line,
 * highest-priority first — the engine caps the list at 3, which fits an
 * expanded iOS/Android notification. Returns null when there's nothing.
 */
export function reminderNotification(reminders: Reminder[]): PushNotification | null {
  if (reminders.length === 0) return null
  const body = reminders.map((r) => r.title).join("\n")
  return { title: "CraigFitness", body, url: "/dashboard" }
}
