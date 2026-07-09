import { describe, it, expect } from "vitest"
import {
  sanitizeEstimate,
  caloriesFromMacros,
  macroConsistency,
  type FoodEstimate,
} from "./food-estimate"

describe("sanitizeEstimate", () => {
  it("passes through a well-formed estimate", () => {
    const raw = {
      description: "Grilled chicken salad",
      items: [
        { name: "Grilled chicken", calories: 220 },
        { name: "Mixed greens", calories: 40 },
      ],
      calories: 420,
      protein_g: 35,
      carbs_g: 18,
      fat_g: 22,
      confidence: "medium",
    }
    expect(sanitizeEstimate(raw)).toEqual(raw)
  })

  it("clamps negative and non-numeric numbers to zero, rounding floats", () => {
    const est = sanitizeEstimate({
      description: "Weird plate",
      items: [],
      calories: -100,
      protein_g: "abc",
      carbs_g: 12.6,
      fat_g: NaN,
      confidence: "high",
    })
    expect(est.calories).toBe(0)
    expect(est.protein_g).toBe(0)
    expect(est.carbs_g).toBe(13)
    expect(est.fat_g).toBe(0)
  })

  it("drops nameless items and defaults a blank description", () => {
    const est = sanitizeEstimate({
      description: "   ",
      items: [
        { name: "", calories: 100 },
        { name: "Toast", calories: 90 },
      ],
      calories: 90,
    })
    expect(est.items).toEqual([{ name: "Toast", calories: 90 }])
    expect(est.description).toBe("Unrecognized meal")
  })

  it("defaults an invalid or missing confidence to 'low'", () => {
    expect(sanitizeEstimate({ confidence: "banana" }).confidence).toBe("low")
    expect(sanitizeEstimate({}).confidence).toBe("low")
  })

  it("never throws on null / non-object input", () => {
    expect(sanitizeEstimate(null).calories).toBe(0)
    expect(sanitizeEstimate(undefined).items).toEqual([])
    expect(sanitizeEstimate("nope").confidence).toBe("low")
  })
})

describe("caloriesFromMacros", () => {
  it("applies the 4/4/9 rule", () => {
    // 30*4 + 40*4 + 10*9 = 120 + 160 + 90 = 370
    expect(caloriesFromMacros(30, 40, 10)).toBe(370)
  })
})

describe("macroConsistency", () => {
  const base: FoodEstimate = {
    description: "x",
    items: [],
    calories: 400,
    protein_g: 30,
    carbs_g: 40,
    fat_g: 10,
    confidence: "medium",
  }

  it("is near zero when macros match stated calories", () => {
    // macros imply 370 vs stated 400 → |370-400|/400 = 0.075
    expect(macroConsistency(base)).toBeCloseTo(0.075, 3)
  })

  it("is large when macros badly disagree with calories", () => {
    // macros imply 370 vs stated 100 → 2.7
    expect(macroConsistency({ ...base, calories: 100 })).toBeCloseTo(2.7, 5)
  })

  it("returns 0 when calories is 0 (avoids divide-by-zero)", () => {
    expect(macroConsistency({ ...base, calories: 0 })).toBe(0)
  })
})
