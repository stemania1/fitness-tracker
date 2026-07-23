import type { Reminder } from "@/lib/reminders"

export interface PushNotification {
  title: string
  body: string
  /** Where a tap should land. */
  url: string
}

/**
 * Fold the day's active reminders into a single push notification (we send at
 * most one nudge, not one-per-reminder). Leads with the highest-priority item
 * and mentions how many more are waiting. Returns null when there's nothing.
 */
export function reminderNotification(reminders: Reminder[]): PushNotification | null {
  if (reminders.length === 0) return null
  const [top, ...rest] = reminders
  const body =
    rest.length > 0
      ? `${top.title} · +${rest.length} more to catch up on`
      : top.title
  return { title: "CraigFitness", body, url: "/dashboard" }
}
