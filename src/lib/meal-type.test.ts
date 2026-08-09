import { describe, it, expect } from "vitest"
import {
  mealTypeForHour,
  defaultMealType,
  looksLikeDrink,
  MEAL_TYPES,
} from "./meal-type"

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

describe("looksLikeDrink", () => {
  it("recognizes a drink from the words that name one", () => {
    expect(looksLikeDrink("Cappuccino/latte with milk foam in a mug")).toBe(true)
    expect(looksLikeDrink("Iced coffee")).toBe(true)
    expect(looksLikeDrink("Green tea")).toBe(true)
    expect(looksLikeDrink("Protein shake")).toBe(true)
    expect(looksLikeDrink("32 oz Dr Pepper soda")).toBe(true)
  })

  it("leaves food alone", () => {
    expect(looksLikeDrink("Chicken bowl")).toBe(false)
    expect(looksLikeDrink("Grilled salmon with asparagus")).toBe(false)
    // "watermelon" must not read as "water".
    expect(looksLikeDrink("Watermelon slices")).toBe(false)
  })

  // A meal that mentions a beverage in passing is still a meal.
  it("reads only the head of the description", () => {
    expect(looksLikeDrink("Pancakes with orange juice")).toBe(false)
    expect(looksLikeDrink("Burger and fries, with a coke")).toBe(false)
    expect(looksLikeDrink("Latte with an extra shot")).toBe(true)
  })

  it("is false for a missing description", () => {
    expect(looksLikeDrink(null)).toBe(false)
    expect(looksLikeDrink(undefined)).toBe(false)
    expect(looksLikeDrink("")).toBe(false)
  })
})

describe("defaultMealType", () => {
  it("reads the hour out of a datetime-local value", () => {
    expect(defaultMealType("2026-08-08T10:03")).toBe("breakfast")
    expect(defaultMealType("2026-08-08T19:45")).toBe("dinner")
  })

  // The whole point of taking a value rather than reading the clock: a dinner
  // logged the next morning still classifies as dinner.
  it("names a backdated meal for when it was eaten", () => {
    expect(defaultMealType("2026-08-07T20:30")).toBe("dinner")
  })

  // The reported case: an 8am latte is not breakfast.
  it("never names a drink for the time of day", () => {
    expect(
      defaultMealType("2026-08-08T08:01", {
        description: "Cappuccino/latte with milk foam in a mug",
      })
    ).toBe("snack")
    expect(
      defaultMealType("2026-08-08T12:30", { description: "Iced coffee" })
    ).toBe("snack")
  })

  it("takes the caffeine table's word for a drink it can't read", () => {
    // The wording alone says nothing; the table recognized the brand.
    expect(
      defaultMealType("2026-08-08T08:01", {
        description: "Tall can from the fridge",
        knownDrink: true,
      })
    ).toBe("snack")
  })

  it("still names actual food for the clock", () => {
    expect(
      defaultMealType("2026-08-08T08:01", { description: "Fried egg on toast" })
    ).toBe("breakfast")
  })

  it("falls back to the neutral label on a malformed value", () => {
    expect(defaultMealType("")).toBe("meal")
    expect(defaultMealType("yesterday evening")).toBe("meal")
    expect(defaultMealType("2026-08-08")).toBe("meal")
  })
})
