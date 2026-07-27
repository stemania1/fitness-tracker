/**
 * Schedule-aware weekly plan. The 12-week plan in `data/training-plan.ts` is a
 * fixed ideal template; this builds a week around the time a user *actually*
 * has. With a fixed early wake (a long commute, say), weekdays only support
 * short sessions and the weekend carries the longer work — so lay the week out
 * that way rather than pretending every day is equal.
 *
 * Pure so it's unit-tested; the card supplies the profile's stored budgets.
 */

import { buildBedtimePlan, formatClockTime, subtractMinutes } from "./bedtime"

/** Days that get the long session first, then the next-best weekend day. */
const WEEKEND_DAYS = [6, 0] // Saturday, Sunday
/** Weekday order preferred for short sessions — spread across the week so
 *  there's recovery between sessions rather than three days back-to-back. */
const WEEKDAY_ORDER = [2, 4, 1, 3, 5] // Tue, Thu, Mon, Wed, Fri

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

/** Minutes of buffer between waking and starting a pre-commute session. */
const WAKE_BUFFER_MINUTES = 15

export interface WeeklyScheduleInput {
  /** Target sessions per week. */
  workoutDays: number
  /** Minutes realistically available on a weekday. */
  weekdayMinutes: number
  /** Minutes realistically available on a weekend day. */
  weekendMinutes: number
  /** "HH:MM" local wake time, for suggesting an AM slot. Optional. */
  wakeTime?: string | null
}

export type SessionKind = "strength" | "long" | "rest"

export interface ScheduledDay {
  /** JS day index (0 = Sunday). */
  day: number
  dayName: string
  kind: SessionKind
  minutes: number
  /** What to do, in a phrase. */
  label: string
  /** Suggested clock time, when we can infer one. */
  suggestedTime?: string
}

export interface WeeklySchedule {
  days: ScheduledDay[]
  totalMinutes: number
  sessionCount: number
  /** Human summary, e.g. "3 sessions · 2 short weekday + 1 longer weekend". */
  summary: string
}

/**
 * Lay out a realistic week: put the longer sessions on weekend days (where the
 * time actually exists) and short ones on spread-out weekdays, up to
 * `workoutDays` total.
 */
export function buildWeeklySchedule(
  input: WeeklyScheduleInput
): WeeklySchedule {
  const target = Math.max(0, Math.min(7, Math.round(input.workoutDays)))
  const weekdayMinutes = Math.max(10, Math.round(input.weekdayMinutes))
  const weekendMinutes = Math.max(10, Math.round(input.weekendMinutes))

  // Prefer weekend slots first (more time available), then weekdays.
  const weekendPicks = WEEKEND_DAYS.slice(0, Math.min(2, target))
  const weekdayPicks = WEEKDAY_ORDER.slice(
    0,
    Math.max(0, target - weekendPicks.length)
  )

  // An AM slot only makes sense on weekdays if a wake time is known.
  const amSlot = amSlotFor(input.wakeTime)

  const assigned = new Map<number, ScheduledDay>()
  for (const day of weekendPicks) {
    assigned.set(day, {
      day,
      dayName: DAY_NAMES[day],
      kind: "long",
      minutes: weekendMinutes,
      label: `Longer session — ${weekendMinutes} min`,
    })
  }
  for (const day of weekdayPicks) {
    assigned.set(day, {
      day,
      dayName: DAY_NAMES[day],
      kind: "strength",
      minutes: weekdayMinutes,
      label: `Express strength — ${weekdayMinutes} min`,
      ...(amSlot ? { suggestedTime: amSlot } : {}),
    })
  }

  // Emit Monday-first so the week reads naturally.
  const order = [1, 2, 3, 4, 5, 6, 0]
  const days: ScheduledDay[] = order.map(
    (day) =>
      assigned.get(day) ?? {
        day,
        dayName: DAY_NAMES[day],
        kind: "rest" as const,
        minutes: 0,
        label: "Rest",
      }
  )

  const sessions = days.filter((d) => d.kind !== "rest")
  const totalMinutes = sessions.reduce((sum, d) => sum + d.minutes, 0)
  const shortCount = sessions.filter((d) => d.kind === "strength").length
  const longCount = sessions.filter((d) => d.kind === "long").length

  const parts: string[] = []
  if (shortCount > 0) parts.push(`${shortCount} short weekday`)
  if (longCount > 0) parts.push(`${longCount} longer weekend`)
  const summary =
    sessions.length === 0
      ? "No sessions scheduled"
      : `${sessions.length} session${sessions.length === 1 ? "" : "s"} · ${parts.join(" + ")}`

  return { days, totalMinutes, sessionCount: sessions.length, summary }
}

/**
 * A pre-commute AM start time: shortly after the wake time, so a weekday
 * session happens before the day gets away from you. Null without a wake time.
 */
export function amSlotFor(wakeTime?: string | null): string | undefined {
  if (!wakeTime) return undefined
  const plan = buildBedtimePlan(wakeTime)
  if (!plan) return undefined
  // subtractMinutes with a negative amount moves forward from wake time.
  return formatClockTime(subtractMinutes(plan.wakeTime, -WAKE_BUFFER_MINUTES))
}
