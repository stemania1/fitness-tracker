/**
 * User preferences for the in-app reminders: a master switch, a per-category
 * toggle, and an optional quiet-hours window. Stored as JSON on the user's
 * profile (`user_profiles.reminder_settings`) and read back through
 * `normalizeReminderSettings`, which fills in defaults and rejects malformed
 * data so a bad value can never break the dashboard.
 */

import type { ReminderType } from "./reminders"

export interface ReminderSettings {
  /** Master switch — off silences every reminder. */
  enabled: boolean
  /** Per-category on/off. */
  types: Record<ReminderType, boolean>
  /** Quiet-hours start hour (0-23, inclusive), or null for no quiet hours. */
  quietStartHour: number | null
  /** Quiet-hours end hour (0-23, exclusive), or null. */
  quietEndHour: number | null
}

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  log_workout: "Workout gap",
  log_meal: "Meal logging",
  energy_checkin: "Energy check-in",
  log_weight: "Weekly weigh-in",
}

/** The reminder categories, in display order. */
export const REMINDER_TYPES: ReminderType[] = [
  "log_workout",
  "log_meal",
  "energy_checkin",
  "log_weight",
]

export function defaultReminderSettings(): ReminderSettings {
  return {
    enabled: true,
    types: {
      log_workout: true,
      log_meal: true,
      energy_checkin: true,
      log_weight: true,
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

/** Coerce arbitrary stored JSON into a valid ReminderSettings, with defaults. */
export function normalizeReminderSettings(raw: unknown): ReminderSettings {
  const d = defaultReminderSettings()
  if (!raw || typeof raw !== "object") return d
  const r = raw as Record<string, unknown>

  const types = { ...d.types }
  if (r.types && typeof r.types === "object") {
    const rt = r.types as Record<string, unknown>
    for (const key of REMINDER_TYPES) {
      if (typeof rt[key] === "boolean") types[key] = rt[key] as boolean
    }
  }

  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : d.enabled,
    types,
    quietStartHour: validHour(r.quietStartHour),
    quietEndHour: validHour(r.quietEndHour),
  }
}

/**
 * Is `hour` inside the quiet window [start, end)? The window may wrap midnight
 * (e.g. 22 → 7 covers 22,23,0…6). Returns false when quiet hours are unset or
 * degenerate (start === end).
 */
export function isQuietHour(
  hour: number,
  start: number | null,
  end: number | null
): boolean {
  if (start == null || end == null || start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}
