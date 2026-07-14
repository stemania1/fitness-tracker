import { describe, it, expect } from "vitest"
import {
  sanitizeEstimate,
  scaleEstimate,
  caloriesFromMacros,
  macroConsistency,
  type FoodEstimate,
} from "./food-estimate"

describe("sanitizeEstimate", () => {
  it("passes through a well-formed estimate", () => {
    const raw = {
      description: "Grilled chicken salad",
      portion: "about 1 large bowl (400g)",
      items: [
        { name: "Grilled chicken", calories: 220 },
        { name: "Mixed greens", calories: 40 },
      ],
      calories: 420,
      protein_g: 35,
      carbs_g: 18,
      fat_g: 22,
      sugar_g: 6,
      glycemic_load: 8,
      confidence: "medium",
    }
    expect(sanitizeEstimate(raw)).toEqual(raw)
  })

  it("clamps sugar to the carb total and defaults it to zero", () => {
    // Sugars are a subset of carbs — a confused response can't exceed them.
    expect(sanitizeEstimate({ carbs_g: 20, sugar_g: 45 }).sugar_g).toBe(20)
    expect(sanitizeEstimate({ carbs_g: 20 }).sugar_g).toBe(0)
    expect(sanitizeEstimate({ carbs_g: 20, sugar_g: -5 }).sugar_g).toBe(0)
  })

  it("clamps glycemic load to the carb total and defaults it to zero", () => {
    // GL = carbs x GI/100 with GI <= 100, so GL can't exceed carbs.
    expect(
      sanitizeEstimate({ carbs_g: 20, glycemic_load: 45 }).glycemic_load
    ).toBe(20)
    expect(sanitizeEstimate({ carbs_g: 20 }).glycemic_load).toBe(0)
  })

  it("defaults portion to an empty string when missing or non-string", () => {
    expect(sanitizeEstimate({ description: "x" }).portion).toBe("")
    expect(sanitizeEstimate({ portion: 42 }).portion).toBe("")
    expect(sanitizeEstimate({ portion: "  2 cups  " }).portion).toBe("2 cups")
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

describe("scaleEstimate", () => {
  const base: FoodEstimate = {
    description: "Oatmeal",
    portion: "1 cup",
    items: [{ name: "Oats", calories: 150 }],
    calories: 290,
    protein_g: 10,
    carbs_g: 35,
    fat_g: 12,
    sugar_g: 15,
    glycemic_load: 14,
    confidence: "low",
  }

  it("scales calories and macros, rounding each", () => {
    const doubled = scaleEstimate(base, 2)
    expect(doubled.calories).toBe(580)
    expect(doubled.protein_g).toBe(20)
    expect(doubled.carbs_g).toBe(70)
    expect(doubled.fat_g).toBe(24)
    expect(doubled.sugar_g).toBe(30)
    expect(doubled.glycemic_load).toBe(28)
  })

  it("rounds fractional results (0.5×)", () => {
    const half = scaleEstimate(base, 0.5)
    expect(half.calories).toBe(145)
    expect(half.protein_g).toBe(5)
    expect(half.fat_g).toBe(6)
  })

  it("leaves description, portion, items, and confidence untouched", () => {
    const s = scaleEstimate(base, 1.5)
    expect(s.description).toBe("Oatmeal")
    expect(s.portion).toBe("1 cup")
    expect(s.items).toEqual(base.items)
    expect(s.confidence).toBe("low")
  })

  it("treats a non-positive or non-finite factor as 1×", () => {
    expect(scaleEstimate(base, 0).calories).toBe(290)
    expect(scaleEstimate(base, -2).calories).toBe(290)
    expect(scaleEstimate(base, NaN).calories).toBe(290)
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
    portion: "",
    items: [],
    calories: 400,
    protein_g: 30,
    carbs_g: 40,
    fat_g: 10,
    sugar_g: 0,
    glycemic_load: 0,
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
