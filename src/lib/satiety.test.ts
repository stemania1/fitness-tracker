import { describe, it, expect } from "vitest"
import {
  satietyIntervals,
  satietyCoverage,
  MIN_GAP_HOURS,
  MAX_GAP_HOURS,
  MIN_RATED_INTERVALS,
  type RatedMeal,
} from "./satiety"

/** A meal at a given hour on one fixed day. */
function meal(
  id: string,
  hour: number,
  hunger: number | null = null,
  over: Partial<RatedMeal> = {}
): RatedMeal {
  return {
    id,
    loggedAt: `2026-08-20T${String(hour).padStart(2, "0")}:00:00.000Z`,
    description: `meal ${id}`,
    calories: 500,
    proteinG: 30,
    preMealHunger: hunger,
    ...over,
  }
}

describe("satietyIntervals", () => {
  it("credits the rating to the meal BEFORE it", () => {
    // Breakfast at 08:00, lunch at 12:00 rated 4 → breakfast held you to a 4.
    const out = satietyIntervals([
      meal("breakfast", 8, null, { description: "oats" }),
      meal("lunch", 12, 4),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].mealId).toBe("breakfast")
    expect(out[0].description).toBe("oats")
    expect(out[0].hungerAfter).toBe(4)
    expect(out[0].gapHours).toBe(4)
  })

  it("carries the judged meal's nutrition, not the next one's", () => {
    const out = satietyIntervals([
      meal("a", 8, null, { calories: 700, proteinG: 50 }),
      meal("b", 12, 3, { calories: 200, proteinG: 5 }),
    ])
    expect(out[0]).toMatchObject({ calories: 700, proteinG: 50 })
  })

  // An unrated next meal leaves the interval unmeasured. Treating that as
  // neutral would pull every average toward the middle.
  it("skips an interval whose next meal went unrated", () => {
    expect(satietyIntervals([meal("a", 8), meal("b", 12)])).toEqual([])
  })

  it("excludes gaps below the comparable band", () => {
    // Grazing: 90 minutes apart.
    const out = satietyIntervals([
      meal("a", 8),
      { ...meal("b", 9, 2), loggedAt: "2026-08-20T09:30:00.000Z" },
    ])
    expect(out).toEqual([])
  })

  it("excludes gaps above the comparable band", () => {
    // Eight hours: hunger is a foregone conclusion whatever you ate.
    expect(satietyIntervals([meal("a", 8), meal("b", 16, 5)])).toEqual([])
  })

  it("includes the band boundaries themselves", () => {
    expect(satietyIntervals([meal("a", 8), meal("b", 8 + MIN_GAP_HOURS, 3)])).toHaveLength(1)
    expect(satietyIntervals([meal("a", 8), meal("b", 8 + MAX_GAP_HOURS, 3)])).toHaveLength(1)
  })

  it("orders by time regardless of input order", () => {
    const out = satietyIntervals([meal("lunch", 12, 4), meal("breakfast", 8, 2)])
    expect(out).toHaveLength(1)
    expect(out[0].mealId).toBe("breakfast")
  })

  it("pairs only consecutive meals, so a chain yields n-1 intervals", () => {
    const out = satietyIntervals([
      meal("a", 8),
      meal("b", 12, 3),
      meal("c", 16, 5),
    ])
    expect(out.map((i) => i.mealId)).toEqual(["a", "b"])
  })

  it("handles fewer than two meals, and unparseable timestamps", () => {
    expect(satietyIntervals([])).toEqual([])
    expect(satietyIntervals([meal("a", 8, 3)])).toEqual([])
    expect(
      satietyIntervals([
        { ...meal("a", 8), loggedAt: "not a date" },
        meal("b", 12, 3),
      ])
    ).toEqual([])
  })
})

describe("satietyCoverage", () => {
  it("reports how far off a verdict you are", () => {
    const meals = [meal("a", 8), meal("b", 12, 3), meal("c", 16, 4)]
    const coverage = satietyCoverage(meals, satietyIntervals(meals))
    expect(coverage).toEqual({
      meals: 3,
      rated: 2,
      comparable: 2,
      needed: MIN_RATED_INTERVALS - 2,
    })
  })

  // Rated but uncomparable is the confusing case: you answered every prompt
  // and still get nothing, so the two counts have to be reported separately.
  it("separates rated from comparable", () => {
    const meals = [meal("a", 8), meal("b", 20, 5)] // rated, but a 12h gap
    const coverage = satietyCoverage(meals, satietyIntervals(meals))
    expect(coverage.rated).toBe(1)
    expect(coverage.comparable).toBe(0)
  })

  it("stops counting down once there are enough", () => {
    const many = Array.from({ length: MIN_RATED_INTERVALS + 5 }, (_, i) => ({
      mealId: `m${i}`,
      description: "x",
      calories: 500,
      proteinG: 30,
      gapHours: 4,
      hungerAfter: 3,
    }))
    expect(satietyCoverage([], many).needed).toBe(0)
  })
})
