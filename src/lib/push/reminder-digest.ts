import type { Reminder } from "@/lib/reminders"

export interface PushNotification {
  title: string
  body: string
  /** Where a tap should land. */
  url: string
  /**
   * When this payload was computed, ISO. A notification's text is frozen at
   * send time, so a delivery that arrives hours late says something that was
   * true when it was built and isn't now — and there is no way to tell that
   * apart from a wrong calculation by looking at the banner.
   *
   * It also identifies the sender: a push that reaches the device WITHOUT
   * this field did not come from this code.
   */
  builtAt: string
  /**
   * Notification tag. Omitted by reminders, which share the service worker's
   * default so a newer one replaces the last instead of stacking.
   */
  tag?: string
}

/**
 * Fold the day's active reminders into a single push notification (we send at
 * most one nudge, not one-per-reminder). Each reminder gets its own line,
 * highest-priority first — the engine caps the list at 3, which fits an
 * expanded iOS/Android notification. Returns null when there's nothing.
 */
export function reminderNotification(
  reminders: Reminder[],
  builtAt: Date = new Date()
): PushNotification | null {
  if (reminders.length === 0) return null
  const body = reminders.map((r) => r.title).join("\n")
  return {
    title: "CraigFitness",
    body,
    url: "/dashboard",
    builtAt: builtAt.toISOString(),
  }
}
