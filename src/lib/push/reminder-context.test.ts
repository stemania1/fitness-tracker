import { describe, it, expect } from "vitest"
import {
  buildReminderContext,
  type RawReminderContext,
} from "./reminder-context"

const ok = <T,>(value: T) => ({ value })
const fail = (error: string) => ({ error })

const base = (over: Partial<RawReminderContext> = {}): RawReminderContext => ({
  hour: 19,
  localDate: "2026-08-07",
  lastWorkoutDate: ok<string | null>("2026-08-01"),
  lastWeighInDate: ok<string | null>("2026-07-28"),
  mealsLoggedToday: ok(2),
  energyCheckedInToday: ok(false),
  creatineTakenToday: ok(false),
  stepsToday: ok<number | null>(6000),
  stepGoal: 8000,
  ...over,
})

describe("buildReminderContext", () => {
  it("passes successful query values through", () => {
    const { ctx, errors } = buildReminderContext(base())
    expect(errors).toEqual([])
    expect(ctx).toEqual({
      hour: 19,
      mealsLoggedToday: 2,
      workedOutToday: false,
      daysSinceLastWorkout: 6,
      energyCheckedInToday: false,
      daysSinceLastWeighIn: 10,
      creatineTakenToday: false,
      stepsToday: 6000,
      stepGoal: 8000,
    })
  })

  it("keeps null day-gaps for a user with no history", () => {
    const { ctx } = buildReminderContext(
      base({
        lastWorkoutDate: ok<string | null>(null),
        lastWeighInDate: ok<string | null>(null),
      })
    )
    expect(ctx.daysSinceLastWorkout).toBeNull()
    expect(ctx.daysSinceLastWeighIn).toBeNull()
    expect(ctx.workedOutToday).toBe(false)
  })

  it("marks today's workout as done at a zero-day gap", () => {
    const { ctx } = buildReminderContext(
      base({ lastWorkoutDate: ok<string | null>("2026-08-07") })
    )
    expect(ctx.workedOutToday).toBe(true)
    expect(ctx.daysSinceLastWorkout).toBe(0)
  })

  it("treats a failed creatine query as taken, not missing", () => {
    const { ctx, errors } = buildReminderContext(
      base({ creatineTakenToday: fail("creatine_logs: timeout") })
    )
    expect(ctx.creatineTakenToday).toBe(true)
    expect(errors).toEqual(["creatine_logs: timeout"])
  })

  it("suppresses every nudge whose query failed", () => {
    const { ctx, errors } = buildReminderContext(
      base({
        lastWorkoutDate: fail("workout_logs: down"),
        lastWeighInDate: fail("weight_logs: down"),
        mealsLoggedToday: fail("food_logs: down"),
        energyCheckedInToday: fail("energy_checkins: down"),
        creatineTakenToday: fail("creatine_logs: down"),
      })
    )
    // Zero-day gaps, meals present, check-ins done — nothing fires.
    expect(ctx.daysSinceLastWorkout).toBe(0)
    expect(ctx.workedOutToday).toBe(true)
    expect(ctx.daysSinceLastWeighIn).toBe(0)
    expect(ctx.mealsLoggedToday).toBeGreaterThan(0)
    expect(ctx.energyCheckedInToday).toBe(true)
    expect(ctx.creatineTakenToday).toBe(true)
    expect(errors).toHaveLength(5)
  })
})
