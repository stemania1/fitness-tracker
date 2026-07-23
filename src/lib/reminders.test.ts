import { describe, it, expect } from "vitest"
import { computeReminders, type ReminderContext } from "./reminders"

/** A neutral mid-morning context with nothing overdue. */
function base(overrides: Partial<ReminderContext> = {}): ReminderContext {
  return {
    hour: 10,
    mealsLoggedToday: 2,
    workedOutToday: true,
    daysSinceLastWorkout: 0,
    energyCheckedInToday: true,
    daysSinceLastWeighIn: 1,
    ...overrides,
  }
}

describe("computeReminders — workout gap", () => {
  it("nudges after a 3+ day gap", () => {
    const r = computeReminders(base({ workedOutToday: false, daysSinceLastWorkout: 4 }))
    expect(r.some((x) => x.type === "log_workout")).toBe(true)
    expect(r[0].title).toMatch(/4 days/)
  })

  it("does not nudge within the gap window", () => {
    const r = computeReminders(base({ workedOutToday: false, daysSinceLastWorkout: 2 }))
    expect(r.some((x) => x.type === "log_workout")).toBe(false)
  })

  it("does not nudge if a workout was already logged today", () => {
    const r = computeReminders(base({ workedOutToday: true, daysSinceLastWorkout: 5 }))
    expect(r.some((x) => x.type === "log_workout")).toBe(false)
  })
})

describe("computeReminders — meals", () => {
  it("flags no meals once it's afternoon", () => {
    const r = computeReminders(base({ hour: 15, mealsLoggedToday: 0 }))
    expect(r.some((x) => x.type === "log_meal")).toBe(true)
  })

  it("does not flag missing meals in the morning", () => {
    const r = computeReminders(base({ hour: 9, mealsLoggedToday: 0 }))
    expect(r.some((x) => x.type === "log_meal")).toBe(false)
  })

  it("nudges for dinner in the late evening when under-logged", () => {
    const r = computeReminders(base({ hour: 21, mealsLoggedToday: 1 }))
    const meal = r.find((x) => x.type === "log_meal")
    expect(meal?.title).toMatch(/dinner/i)
  })

  it("stays quiet in the evening when meals are already logged", () => {
    const r = computeReminders(base({ hour: 21, mealsLoggedToday: 3 }))
    expect(r.some((x) => x.type === "log_meal")).toBe(false)
  })
})

describe("computeReminders — energy check-in", () => {
  it("prompts in the evening when not done", () => {
    const r = computeReminders(base({ hour: 19, energyCheckedInToday: false }))
    expect(r.some((x) => x.type === "energy_checkin")).toBe(true)
  })

  it("does not prompt during the day", () => {
    const r = computeReminders(base({ hour: 11, energyCheckedInToday: false }))
    expect(r.some((x) => x.type === "energy_checkin")).toBe(false)
  })

  it("does not prompt once done", () => {
    const r = computeReminders(base({ hour: 21, energyCheckedInToday: true }))
    expect(r.some((x) => x.type === "energy_checkin")).toBe(false)
  })
})

describe("computeReminders — weigh-in", () => {
  it("nudges after a week", () => {
    const r = computeReminders(base({ daysSinceLastWeighIn: 8 }))
    const w = r.find((x) => x.type === "log_weight")
    expect(w?.title).toMatch(/weekly weigh-in/i)
  })

  it("nudges (as a first weigh-in) when there's no history", () => {
    const r = computeReminders(base({ daysSinceLastWeighIn: null }))
    const w = r.find((x) => x.type === "log_weight")
    expect(w?.title).toMatch(/first weigh-in/i)
  })

  it("stays quiet within the week", () => {
    const r = computeReminders(base({ daysSinceLastWeighIn: 3 }))
    expect(r.some((x) => x.type === "log_weight")).toBe(false)
  })
})

describe("computeReminders — prioritization & capping", () => {
  it("returns nothing when everything is current", () => {
    expect(computeReminders(base())).toEqual([])
  })

  it("sorts most urgent first", () => {
    const r = computeReminders(
      base({
        hour: 21,
        workedOutToday: false,
        daysSinceLastWorkout: 5,
        mealsLoggedToday: 0,
        energyCheckedInToday: false,
        daysSinceLastWeighIn: 10,
      })
    )
    expect(r[0].type).toBe("log_workout")
    // Priorities strictly descending.
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].priority).toBeGreaterThanOrEqual(r[i].priority)
    }
  })

  it("caps the list to the requested maximum", () => {
    const r = computeReminders(
      base({
        hour: 21,
        workedOutToday: false,
        daysSinceLastWorkout: 5,
        mealsLoggedToday: 0,
        energyCheckedInToday: false,
        daysSinceLastWeighIn: 10,
      }),
      2
    )
    expect(r).toHaveLength(2)
    expect(r[0].type).toBe("log_workout")
  })
})
