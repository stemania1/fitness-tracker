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
 * Earliest local hour the day's one push may go out when the user hasn't set
 * quiet hours.
 *
 * Two of the nudges (workout gap, weekly weigh-in) aren't hour-gated — they're
 * true from the first minute of the local day — and quiet hours default to
 * off. So without a floor the once-per-day push lands on the first cron run
 * after local midnight, waking the user to be told they haven't weighed in.
 */
export const DEFAULT_PUSH_START_HOUR = 8

/** The first local hour a push may be sent, honoring explicit quiet hours. */
export function pushStartHour(quietEndHour: number | null): number {
  return quietEndHour ?? DEFAULT_PUSH_START_HOUR
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
  // Hold the day's push until a civil hour. The guard above means we only get
  // one shot per day, so sending it at 00:0x would spend it at the worst
  // possible moment.
  if (input.ctx.hour < pushStartHour(settings.quietEndHour)) return null
  const reminders = computeReminders(input.ctx, settings)
  return reminderNotification(reminders)
}
