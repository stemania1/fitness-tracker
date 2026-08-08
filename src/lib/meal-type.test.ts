import { describe, it, expect } from "vitest"
import { mealTypeForHour, mealTypeForLocalDatetime, MEAL_TYPES } from "./meal-type"

describe("mealTypeForHour", () => {
  it("names the ordinary meals", () => {
    expect(mealTypeForHour(7)).toBe("breakfast")
    expect(mealTypeForHour(10)).toBe("breakfast")
    expect(mealTypeForHour(12)).toBe("lunch")
    expect(mealTypeForHour(18)).toBe("dinner")
  })

  it("puts both ends of the night in snack", () => {
    expect(mealTypeForHour(22)).toBe("snack")
    expect(mealTypeForHour(23)).toBe("snack")
    // 1am eating is the tail of last night, not an early breakfast.
    expect(mealTypeForHour(0)).toBe("snack")
    expect(mealTypeForHour(3)).toBe("snack")
  })

  it("switches exactly on the boundary hour", () => {
    expect(mealTypeForHour(4)).toBe("breakfast")
    expect(mealTypeForHour(11)).toBe("lunch")
    expect(mealTypeForHour(16)).toBe("dinner")
    expect(mealTypeForHour(21)).toBe("snack")
  })

  it("covers every hour with a selectable type", () => {
    for (let h = 0; h < 24; h++) {
      expect(MEAL_TYPES).toContain(mealTypeForHour(h))
    }
  })

  it("falls back to the neutral label on a nonsense hour", () => {
    expect(mealTypeForHour(-1)).toBe("meal")
    expect(mealTypeForHour(24)).toBe("meal")
    expect(mealTypeForHour(NaN)).toBe("meal")
  })
})

describe("mealTypeForLocalDatetime", () => {
  it("reads the hour out of a datetime-local value", () => {
    expect(mealTypeForLocalDatetime("2026-08-08T10:03")).toBe("breakfast")
    expect(mealTypeForLocalDatetime("2026-08-08T19:45")).toBe("dinner")
  })

  // The whole point of taking a value rather than reading the clock: a dinner
  // logged the next morning still classifies as dinner.
  it("names a backdated meal for when it was eaten", () => {
    expect(mealTypeForLocalDatetime("2026-08-07T20:30")).toBe("dinner")
  })

  it("falls back to the neutral label on a malformed value", () => {
    expect(mealTypeForLocalDatetime("")).toBe("meal")
    expect(mealTypeForLocalDatetime("yesterday evening")).toBe("meal")
    expect(mealTypeForLocalDatetime("2026-08-08")).toBe("meal")
  })
})
