import { describe, it, expect } from "vitest"
import {
  lookupAlcohol,
  resolveAlcoholGrams,
  gramsEthanol,
  parseAbv,
  standardDrinks,
  STANDARD_DRINK_G,
} from "./alcohol-drinks"

describe("gramsEthanol", () => {
  // The three servings that define a US standard drink should all land on ~14g.
  it("puts the three standard servings within a gram of each other", () => {
    expect(gramsEthanol(12, 0.05)).toBeCloseTo(14, 0) // beer
    expect(gramsEthanol(5, 0.12)).toBeCloseTo(14, 0) // wine
    expect(gramsEthanol(1.5, 0.4)).toBeCloseTo(14, 0) // spirits
  })

  it("scales with the pour, unlike caffeine in an espresso drink", () => {
    const pint = gramsEthanol(16, 0.05)
    const can = gramsEthanol(12, 0.05)
    expect(pint / can).toBeCloseTo(16 / 12, 2)
  })
})

describe("parseAbv", () => {
  it("reads a stated strength", () => {
    expect(parseAbv("Beer 7.2% ABV")).toBeCloseTo(0.072, 4)
    expect(parseAbv("wine, 13%")).toBeCloseTo(0.13, 4)
  })

  it("ignores a percentage that can't be a drinkable strength", () => {
    expect(parseAbv("85% dark chocolate")).toBeNull()
    expect(parseAbv("beer")).toBeNull()
  })
})

describe("lookupAlcohol", () => {
  it("sizes a beer from its volume", () => {
    const can = lookupAlcohol("12 oz beer")
    expect(can?.label).toBe("Beer")
    expect(can?.grams).toBeCloseTo(14, 0)

    const pint = lookupAlcohol("16 oz beer")
    expect(pint!.grams).toBeGreaterThan(can!.grams)
  })

  it("assumes a typical serving when no volume is stated", () => {
    expect(lookupAlcohol("glass of red wine")?.oz).toBe(5)
    expect(lookupAlcohol("whiskey")?.oz).toBe(1.5)
  })

  it("prefers a stated ABV over the style's typical strength", () => {
    const typical = lookupAlcohol("12 oz IPA")!
    const stated = lookupAlcohol("12 oz IPA, 9% ABV")!
    expect(stated.abv).toBeCloseTo(0.09, 4)
    expect(stated.grams).toBeGreaterThan(typical.grams)
  })

  // Every qualifier has to beat the drink it qualifies, or the table lies.
  it("lets a non-alcoholic qualifier win over its own base drink", () => {
    expect(lookupAlcohol("non-alcoholic beer")?.grams).toBe(0)
    expect(lookupAlcohol("alcohol-free wine")?.grams).toBe(0)
    expect(lookupAlcohol("virgin margarita")?.grams).toBe(0)
  })

  it("distinguishes a light beer and an IPA from a generic beer", () => {
    const light = lookupAlcohol("bud light")!
    const plain = lookupAlcohol("beer")!
    const ipa = lookupAlcohol("IPA")!
    expect(light.grams).toBeLessThan(plain.grams)
    expect(ipa.grams).toBeGreaterThan(plain.grams)
  })

  // Mostly mixer and ice: scaling the glass by a spirit's ABV would be wrong.
  it("measures a cocktail by its pour, not its glass", () => {
    const margarita = lookupAlcohol("16 oz margarita")!
    expect(margarita.oz).toBeNull()
    expect(margarita.grams).toBe(22)
  })

  it("reads the drink outside the parentheses, not the model's hedge", () => {
    // The aside names wine; the drink is grape juice, which isn't in the table.
    expect(lookupAlcohol("Grape juice (or possibly red wine)")).toBeNull()
  })

  it("returns null for food and for unrecognized drinks", () => {
    expect(lookupAlcohol("Chicken bowl with rice")).toBeNull()
    expect(lookupAlcohol("Iced coffee")).toBeNull()
  })
})

describe("standardDrinks", () => {
  it("converts grams to the unit people count in", () => {
    expect(standardDrinks(STANDARD_DRINK_G)).toBe(1)
    expect(standardDrinks(28)).toBe(2)
    expect(standardDrinks(7)).toBe(0.5)
  })
})

describe("resolveAlcoholGrams", () => {
  it("suggests the table's figure with the drink it matched", () => {
    const r = resolveAlcoholGrams({ description: "5 oz glass of merlot" })
    expect(r.label).toBe("Red wine")
    expect(r.grams).toBeGreaterThan(0)
  })

  // No model fallback on purpose: a guessed dose would drive a sleep warning
  // the user can't trace to anything they drank.
  it("suggests nothing at all when the drink isn't recognized", () => {
    expect(resolveAlcoholGrams({ description: "Chicken bowl" })).toEqual({
      grams: 0,
      label: null,
    })
  })
})
