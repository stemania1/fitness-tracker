/**
 * A standalone copy of the reminder engine, for `diagnose-reminders.ts`.
 *
 * The diagnostic runs under bare `node --experimental-strip-types`, which
 * resolves neither the `@/` alias nor the extensionless relative imports that
 * `src/lib/reminders.ts` uses internally. So it cannot import the real thing,
 * and a copy is the only option.
 *
 * A copy that drifts is worse than no diagnostic at all: it answers the
 * question it was written to settle, confidently, and wrongly. That risk used
 * to be managed by a comment asking the reader to keep the two in step, which
 * failed the first time the source changed.
 *
 * So the copy lives here on its own, and `reminder-mirror.test.ts` imports
 * both this file and the real modules — vitest resolves what bare node can't
 * — and asserts they agree across a matrix of contexts, hours and settings.
 * Drift now fails CI instead of surfacing as a wrong answer during an
 * incident.
 *
 * Mirrors:
 *   src/lib/reminders.ts          — gates, priorities, titles, the cap
 *   src/lib/reminder-settings.ts  — settings normalization, quiet hours
 *   src/lib/push/due.ts           — the hour the day's push is composed
 *   src/lib/daily-movement.ts     — the step-pace maths behind the step nudge
 */

/** src/lib/reminders.ts — hour after which a missing-meal nudge makes sense. */
export const AFTERNOON = 14
/** src/lib/reminders.ts — hour after which evening nudges make sense. */
export const EVENING = 18
/** src/lib/reminders.ts — a workout gap of this many days is worth a nudge. */
export const WORKOUT_GAP_DAYS = 3
/** src/lib/reminders.ts — weigh-in cadence. */
export const WEIGH_IN_DAYS = 7
/** src/lib/reminders.ts — earliest hour for the step nudge. */
export const STEP_NUDGE_HOUR = 15
/** src/lib/daily-movement.ts — the window steps accumulate across. */
export const ACTIVE_DAY_START_HOUR = 7
export const ACTIVE_DAY_END_HOUR = 22
/** src/lib/daily-movement.ts — off-schedule tolerance before "behind". */
export const PACE_TOLERANCE = 0.1
/** src/lib/daily-movement.ts — fallback when no goal is stored. */
export const DEFAULT_STEP_GOAL = 8000
/** src/lib/reminders.ts — the digest is capped at this many lines. */
export const MAX_REMINDERS = 3
/** src/lib/push/due.ts — the hour the day's one push is composed. */
export const DAILY_PUSH_HOUR = EVENING

export type ReminderType =
  | "log_workout"
  | "log_meal"
  | "energy_checkin"
  | "log_weight"
  | "log_creatine"
  | "step_goal"

export interface ReminderSettings {
  enabled: boolean
  types: Record<ReminderType, boolean>
  quietStartHour: number | null
  quietEndHour: number | null
}

export const REMINDER_TYPES: ReminderType[] = [
  "log_workout",
  "log_meal",
  "energy_checkin",
  "log_weight",
  "log_creatine",
  "step_goal",
]

export function defaultReminderSettings(): ReminderSettings {
  return {
    enabled: true,
    types: {
      log_workout: true,
      log_meal: true,
      energy_checkin: true,
      log_weight: true,
      log_creatine: true,
      step_goal: true,
    },
    quietStartHour: null,
    quietEndHour: null,
  }
}

function validHour(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23
    ? v
    : null
}

/** Mirror of normalizeReminderSettings in src/lib/reminder-settings.ts. */
export function normalizeReminderSettings(raw: unknown): ReminderSettings {
  const d = defaultReminderSettings()
  if (!raw || typeof raw !== "object") return d
  const r = raw as Record<string, unknown>

  const types = { ...d.types }
  if (r.types && typeof r.types === "object") {
    const rt = r.types as Record<string, unknown>
    for (const k of REMINDER_TYPES) {
      if (typeof rt[k] === "boolean") types[k] = rt[k] as boolean
    }
  }

  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : d.enabled,
    types,
    quietStartHour: validHour(r.quietStartHour),
    quietEndHour: validHour(r.quietEndHour),
  }
}

/** Mirror of isQuietHour in src/lib/reminder-settings.ts. */
export function isQuietHour(
  hour: number,
  start: number | null,
  end: number | null
): boolean {
  if (start == null || end == null || start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

/**
 * Mirror of pushStartHour in src/lib/push/due.ts.
 *
 * Quiet hours may delay the day's push, never bring it forward — the reason
 * the previous `quietEndHour ?? 8` rule starved the evening nudges.
 */
export function pushStartHour(quietEndHour: number | null): number {
  return Math.max(DAILY_PUSH_HOUR, quietEndHour ?? 0)
}

export interface ReminderContext {
  hour: number
  mealsLoggedToday: number
  workedOutToday: boolean
  daysSinceLastWorkout: number | null
  energyCheckedInToday: boolean
  daysSinceLastWeighIn: number | null
  creatineTakenToday: boolean
  stepsToday: number | null
  stepGoal: number
}

/** Mirror of activeDayFraction in src/lib/daily-movement.ts. */
export function activeDayFraction(hour: number, minute = 0): number {
  const now = hour * 60 + minute
  const start = ACTIVE_DAY_START_HOUR * 60
  const end = ACTIVE_DAY_END_HOUR * 60
  if (now <= start) return 0
  if (now >= end) return 1
  return (now - start) / (end - start)
}

/**
 * Mirror of the "behind" branch of stepPace in src/lib/daily-movement.ts,
 * plus the remaining-steps figure the nudge's title prints.
 */
export function stepShortfall(
  steps: number,
  goal: number,
  hour: number
): { behind: boolean; remaining: number } {
  const safeGoal = goal > 0 ? goal : DEFAULT_STEP_GOAL
  const fraction = activeDayFraction(hour)
  const delta = steps - Math.round(safeGoal * fraction)
  return {
    behind:
      steps < safeGoal &&
      fraction !== 0 &&
      delta <= -safeGoal * PACE_TOLERANCE,
    remaining: Math.max(0, safeGoal - steps),
  }
}

export interface MirroredReminder {
  type: ReminderType
  priority: number
  title: string
}

/** Mirror of computeReminders in src/lib/reminders.ts — titles included. */
export function computeReminders(
  ctx: ReminderContext,
  settings: ReminderSettings
): MirroredReminder[] {
  if (!settings.enabled) return []
  if (isQuietHour(ctx.hour, settings.quietStartHour, settings.quietEndHour)) {
    return []
  }

  const out: MirroredReminder[] = []

  if (
    !ctx.workedOutToday &&
    ctx.daysSinceLastWorkout != null &&
    ctx.daysSinceLastWorkout >= WORKOUT_GAP_DAYS
  ) {
    out.push({
      type: "log_workout",
      priority: 80,
      title: `It's been ${ctx.daysSinceLastWorkout} days since your last workout`,
    })
  }

  if (ctx.hour >= AFTERNOON && ctx.mealsLoggedToday === 0) {
    out.push({ type: "log_meal", priority: 65, title: "No meals logged yet today" })
  } else if (ctx.hour >= EVENING + 2 && ctx.mealsLoggedToday < 2) {
    out.push({ type: "log_meal", priority: 55, title: "Log your dinner before bed" })
  }

  if (
    ctx.stepsToday != null &&
    ctx.hour >= STEP_NUDGE_HOUR &&
    ctx.hour < ACTIVE_DAY_END_HOUR
  ) {
    const shortfall = stepShortfall(ctx.stepsToday, ctx.stepGoal, ctx.hour)
    if (shortfall.behind) {
      out.push({
        type: "step_goal",
        priority: 50,
        title: `${shortfall.remaining.toLocaleString()} steps short of your goal`,
      })
    }
  }

  if (!ctx.energyCheckedInToday && ctx.hour >= EVENING) {
    out.push({
      type: "energy_checkin",
      priority: 40,
      title: "How's your energy today?",
    })
  }

  if (!ctx.creatineTakenToday && ctx.hour >= EVENING) {
    out.push({
      type: "log_creatine",
      priority: 35,
      title: "Haven't logged creatine today",
    })
  }

  if (ctx.daysSinceLastWeighIn == null || ctx.daysSinceLastWeighIn >= WEIGH_IN_DAYS) {
    out.push({
      type: "log_weight",
      priority: 30,
      title:
        ctx.daysSinceLastWeighIn == null
          ? "Log your first weigh-in"
          : "Time for a weekly weigh-in",
    })
  }

  return out
    .filter((r) => settings.types[r.type] !== false)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_REMINDERS)
}
