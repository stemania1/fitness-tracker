import { computeReminders, EVENING, type ReminderContext } from "@/lib/reminders"
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
 * The local hour at which the day's one push is composed.
 *
 * This is EVENING because that is the latest gate any reminder has, and the
 * sender gets exactly one notification per day. Sending earlier doesn't just
 * make the push less informed — it actively suppresses reminders. The workout
 * gap and the weekly weigh-in have no hour gate at all, so they are true from
 * the first minute of the local day; whatever hour the sender starts at, one
 * of those claims the day, and the energy and creatine nudges gated to 18:00
 * can never be reached.
 *
 * The effect was precisely inverted: the two reminders about things you do
 * daily went unsent on exactly the days you'd skipped a workout or a weigh-in
 * — the days with something to say. Waiting until every gate has opened means
 * the one push describes the whole day.
 *
 * Deliberately NOT fixed by hour-gating those two nudges in
 * `computeReminders`: that function also feeds the in-app dashboard, where a
 * workout gap should be visible the moment the app is opened, at any hour.
 * The bug is when the push is composed, not when a reminder becomes true.
 */
export const DAILY_PUSH_HOUR = EVENING

/**
 * The local hour the day's push goes out, honoring explicit quiet hours.
 *
 * Quiet hours can only push it later, never earlier. They answer "when may
 * you disturb me", which is a different question from "when is the day's
 * state knowable" — reading a quiet window ending at 07:00 as permission to
 * send at 07:00 is what reintroduces the starvation above.
 */
export function pushStartHour(quietEndHour: number | null): number {
  return Math.max(DAILY_PUSH_HOUR, quietEndHour ?? 0)
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
  // Hold the day's push until every reminder's gate has opened. The guard
  // above means we only get one shot, so sending earlier spends it on a
  // partial view of the day and silently drops whatever wasn't knowable yet.
  if (input.ctx.hour < pushStartHour(settings.quietEndHour)) return null
  const reminders = computeReminders(input.ctx, settings)
  return reminderNotification(reminders)
}
