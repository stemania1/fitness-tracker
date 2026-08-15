import { describe, it, expect } from "vitest"
import * as mirror from "./reminder-mirror.ts"
import { computeReminders, EVENING } from "@/lib/reminders"
import {
  normalizeReminderSettings,
  isQuietHour,
  type ReminderSettings,
} from "@/lib/reminder-settings"
import { pushStartHour, DAILY_PUSH_HOUR } from "@/lib/push/due"
import type { ReminderContext } from "@/lib/reminders"

/**
 * `scripts/diagnose-reminders.ts` runs under bare node, which resolves
 * neither the `@/` alias nor the extensionless relative imports the real
 * modules use, so it carries a copy of the reminder engine. These tests are
 * what keeps the copy honest.
 *
 * The failure they prevent is specific and expensive: a drifted copy answers
 * the question it exists to settle — during an incident, under time pressure
 * — confidently and wrongly. It happened once already, when the push start
 * hour changed and the copy kept reporting the old rule.
 *
 * Vitest resolves both sides, so agreement can simply be asserted.
 */

/** Every hour, so no gate can differ unnoticed at a boundary. */
const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** Contexts chosen to straddle every threshold in the engine. */
const CONTEXTS: Omit<ReminderContext, "hour">[] = [
  {
    mealsLoggedToday: 0,
    workedOutToday: false,
    daysSinceLastWorkout: 8,
    energyCheckedInToday: false,
    daysSinceLastWeighIn: 10,
    creatineTakenToday: false,
    stepsToday: 1200,
    stepGoal: 8000,
  },
  {
    mealsLoggedToday: 3,
    workedOutToday: false,
    daysSinceLastWorkout: 2,
    energyCheckedInToday: true,
    daysSinceLastWeighIn: 1,
    creatineTakenToday: true,
    stepsToday: 9000,
    stepGoal: 8000,
  },
  {
    mealsLoggedToday: 1,
    workedOutToday: true,
    daysSinceLastWorkout: 0,
    energyCheckedInToday: false,
    daysSinceLastWeighIn: 7,
    creatineTakenToday: false,
    stepsToday: null,
    stepGoal: 8000,
  },
  {
    mealsLoggedToday: 0,
    workedOutToday: false,
    daysSinceLastWorkout: 3,
    energyCheckedInToday: false,
    daysSinceLastWeighIn: null,
    creatineTakenToday: false,
    stepsToday: 4000,
    stepGoal: 8000,
  },
  {
    mealsLoggedToday: 2,
    workedOutToday: false,
    daysSinceLastWorkout: null,
    energyCheckedInToday: true,
    daysSinceLastWeighIn: 6,
    creatineTakenToday: true,
    stepsToday: 300,
    stepGoal: 12000,
  },
]

const SETTINGS: unknown[] = [
  {},
  { enabled: false },
  { quietStartHour: 22, quietEndHour: 7 },
  { quietStartHour: 9, quietEndHour: 20 },
  { types: { log_creatine: false, log_weight: false } },
  { types: { log_workout: false } },
  null,
  "not an object",
]

describe("the diagnostic's copy of the reminder engine", () => {
  it("produces identical reminders for every hour, context and setting", () => {
    for (const raw of SETTINGS) {
      const real = normalizeReminderSettings(raw)
      const copy = mirror.normalizeReminderSettings(raw)
      for (const base of CONTEXTS) {
        for (const hour of HOURS) {
          const ctx = { ...base, hour }
          const expected = computeReminders(ctx, real).map((r) => r.title)
          const actual = mirror
            .computeReminders(ctx as mirror.ReminderContext, copy)
            .map((r) => r.title)
          expect(actual, `hour ${hour}, settings ${JSON.stringify(raw)}`).toEqual(
            expected
          )
        }
      }
    }
  })

  it("normalizes settings the same way", () => {
    for (const raw of SETTINGS) {
      expect(mirror.normalizeReminderSettings(raw)).toEqual(
        normalizeReminderSettings(raw) as unknown as mirror.ReminderSettings
      )
    }
  })

  it("agrees on quiet hours, including windows that wrap midnight", () => {
    const windows: [number | null, number | null][] = [
      [22, 7],
      [9, 20],
      [0, 0],
      [null, 7],
      [22, null],
    ]
    for (const [start, end] of windows) {
      for (const hour of HOURS) {
        expect(mirror.isQuietHour(hour, start, end)).toBe(
          isQuietHour(hour, start, end)
        )
      }
    }
  })

  // The rule that drifted: quiet hours may delay the day's push, never bring
  // it forward. A copy still applying `quietEndHour ?? 8` would report a
  // morning send hour that no longer exists.
  it("agrees on the hour the day's push is composed", () => {
    expect(mirror.DAILY_PUSH_HOUR).toBe(DAILY_PUSH_HOUR)
    for (const end of [...HOURS, null]) {
      expect(mirror.pushStartHour(end)).toBe(pushStartHour(end))
    }
  })

  it("agrees on the gates and the cap", () => {
    expect(mirror.EVENING).toBe(EVENING)
    // Three is what fits an expanded notification; a copy that allowed more
    // would print lines the real push would drop.
    const everything = { ...CONTEXTS[0], hour: 23 }
    expect(
      mirror.computeReminders(everything, mirror.defaultReminderSettings()).length
    ).toBeLessThanOrEqual(mirror.MAX_REMINDERS)
    expect(
      computeReminders(everything, undefined as unknown as ReminderSettings).length
    ).toBeLessThanOrEqual(mirror.MAX_REMINDERS)
  })
})
