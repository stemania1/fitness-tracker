import { describe, it, expect } from "vitest"
import {
  planCaffeineBackfill,
  backfillRows,
  DUPLICATE_WINDOW_MIN,
  type BackfillDose,
  type BackfillMeal,
} from "./caffeine-backfill"

const USER = "u1"

function meal(over: Partial<BackfillMeal> = {}): BackfillMeal {
  return {
    id: "meal-1",
    user_id: USER,
    description: "32 oz Dr Pepper soda",
    logged_at: "2026-07-11T18:20:00.000Z",
    ...over,
  }
}

function dose(over: Partial<BackfillDose> = {}): BackfillDose {
  return {
    user_id: USER,
    mg: 40,
    logged_at: "2026-07-11T18:20:00.000Z",
    source_food_log_id: null,
    ...over,
  }
}

/** Minutes offset from the reference meal time, as an ISO string. */
function minutesFromMeal(minutes: number): string {
  return new Date(
    Date.parse("2026-07-11T18:20:00.000Z") + minutes * 60_000
  ).toISOString()
}

describe("planCaffeineBackfill", () => {
  it("plans a dose for a recognized drink", () => {
    const { planned } = planCaffeineBackfill([meal()], [])
    expect(planned).toHaveLength(1)
    expect(planned[0].mg).toBe(109)
    expect(planned[0].label).toBe("Dr Pepper")
  })

  it("ignores meals it can't recognize, without reporting them", () => {
    // A normal history is nearly all food — listing every one as a "skip"
    // would bury the handful of decisions worth reading.
    const plan = planCaffeineBackfill(
      [meal({ description: "Grilled chicken salad" })],
      []
    )
    expect(plan.planned).toHaveLength(0)
    expect(plan.skipped).toHaveLength(0)
  })

  it("is safe to re-run — a meal with a linked dose is left alone", () => {
    const { planned, skipped } = planCaffeineBackfill(
      [meal()],
      [dose({ mg: 109, source_food_log_id: "meal-1" })]
    )
    expect(planned).toHaveLength(0)
    expect(skipped[0].reason).toMatch(/already has a linked dose/)
  })

  it("skips a drink that was already hand-logged around the same time", () => {
    // Logging the drink twice — once as a meal, once through Log Caffeine —
    // is the workaround this replaced, so the old history is full of pairs.
    const { planned, skipped } = planCaffeineBackfill(
      [meal()],
      [dose({ logged_at: minutesFromMeal(20) })]
    )
    expect(planned).toHaveLength(0)
    expect(skipped[0].reason).toMatch(/already logged by hand/)
  })

  it("still backfills when the nearest hand-logged drink is a separate one", () => {
    // Morning coffee shouldn't suppress an afternoon soda.
    const { planned } = planCaffeineBackfill(
      [meal()],
      [dose({ mg: 190, logged_at: minutesFromMeal(-(DUPLICATE_WINDOW_MIN + 30)) })]
    )
    expect(planned).toHaveLength(1)
  })

  it("does not let one user's caffeine log suppress another's meal", () => {
    const { planned } = planCaffeineBackfill(
      [meal()],
      [dose({ user_id: "u2" })]
    )
    expect(planned).toHaveLength(1)
  })

  it("applies a rescaled meal's portion prefix to the dose", () => {
    // The 32 oz is what was poured; the prefix says half of it was drunk.
    const { planned } = planCaffeineBackfill(
      [meal({ description: "½ of 32 oz Dr Pepper soda" })],
      []
    )
    expect(planned[0].mg).toBe(55)
  })

  it("skips a recognized drink that has no caffeine", () => {
    const { planned, skipped } = planCaffeineBackfill(
      [meal({ description: "Sprite" })],
      []
    )
    expect(planned).toHaveLength(0)
    expect(skipped[0].reason).toMatch(/no caffeine/)
  })

  it("plans each meal independently across a mixed history", () => {
    const { planned } = planCaffeineBackfill(
      [
        meal({ id: "a", description: "16 oz coffee", logged_at: minutesFromMeal(-400) }),
        meal({ id: "b", description: "Chicken bowl", logged_at: minutesFromMeal(-200) }),
        meal({ id: "c" }),
      ],
      []
    )
    expect(planned.map((p) => p.meal.id)).toEqual(["a", "c"])
    expect(planned.map((p) => p.mg)).toEqual([190, 109])
  })
})

describe("backfillRows", () => {
  it("writes the dose at the meal's own time, linked to it", () => {
    const { planned } = planCaffeineBackfill([meal()], [])
    const [row] = backfillRows(planned)
    expect(row).toEqual({
      user_id: USER,
      mg: 109,
      source: "32 oz Dr Pepper soda",
      source_food_log_id: "meal-1",
      // Timing is the whole point — the late-caffeine read works from it.
      logged_at: "2026-07-11T18:20:00.000Z",
    })
  })

  it("truncates an overlong description to the source column's width", () => {
    const { planned } = planCaffeineBackfill(
      [meal({ description: `Dr Pepper ${"x".repeat(200)}` })],
      []
    )
    expect(backfillRows(planned)[0].source).toHaveLength(80)
  })
})
