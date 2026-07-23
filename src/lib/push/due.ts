import { computeReminders, type ReminderContext } from "@/lib/reminders"
import { normalizeReminderSettings } from "@/lib/reminder-settings"
import { reminderNotification, type PushNotification } from "./reminder-digest"

export interface DuePushInput {
  /** Raw `user_profiles.reminder_settings` JSON. */
  reminderSettingsRaw: unknown
  /** The user's reminder context, built with their local hour. */
  ctx: ReminderContext
  /** The user's local calendar date (YYYY-MM-DD). */
  localDate: string
  /** `user_profiles.last_push_sent_on` — de-dupes to one push per local day. */
  lastPushSentOn: string | null
}

/**
 * Decide whether to send a reminder push right now, and what it should say.
 * Combines the shared reminder engine (settings, quiet hours, time-gating)
 * with a once-per-local-day guard so the hourly cron never nags repeatedly.
 * Pure — the cron does the DB I/O to build the input, then calls this.
 */
export function dueReminderPush(input: DuePushInput): PushNotification | null {
  if (input.lastPushSentOn === input.localDate) return null
  const settings = normalizeReminderSettings(input.reminderSettingsRaw)
  const reminders = computeReminders(input.ctx, settings)
  return reminderNotification(reminders)
}
