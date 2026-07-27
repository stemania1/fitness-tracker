import { describe, it, expect } from "vitest"
import {
  scaleMealNutrients,
  describePortion,
  PORTION_OPTIONS,
} from "./meal-portion"

const quesadilla = {
  calories: 1020,
  protein_g: 30,
  carbs_g: 100,
  fat_g: 55,
  sugar_g: 8,
  glycemic_load: 60,
}

describe("scaleMealNutrients", () => {
  it("halves every nutrient for a half portion", () => {
    expect(scaleMealNutrients(quesadilla, 0.5)).toEqual({
      calories: 510,
      protein_g: 15,
      carbs_g: 50,
      fat_g: 27.5,
      sugar_g: 4,
      glycemic_load: 30,
    })
  })

  it("scales glycemic load with the carbs, not independently", () => {
    const q = scaleMealNutrients(quesadilla, 0.25)
    expect(q.carbs_g).toBe(25)
    expect(q.glycemic_load).toBe(15)
  })

  it("scales up for a larger portion", () => {
    const big = scaleMealNutrients(quesadilla, 2)
    expect(big.calories).toBe(2040)
    expect(big.protein_g).toBe(60)
  })

  it("rounds calories whole and grams to one decimal", () => {
    const s = scaleMealNutrients({ calories: 333, protein_g: 10 }, 0.5)
    expect(s.calories).toBe(167)
    expect(s.protein_g).toBe(5)
    const t = scaleMealNutrients({ calories: 100, fat_g: 55 }, 0.75)
    expect(t.fat_g).toBe(41.3)
  })

  it("treats missing nutrients as zero", () => {
    expect(scaleMealNutrients({ calories: 200 }, 0.5)).toEqual({
      calories: 100,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      sugar_g: 0,
      glycemic_load: 0,
    })
  })

  it("guards a non-positive factor by leaving the meal unchanged", () => {
    expect(scaleMealNutrients(quesadilla, 0).calories).toBe(1020)
    expect(scaleMealNutrients(quesadilla, -1).calories).toBe(1020)
  })
})

describe("describePortion", () => {
  const desc = "Cheese and pork quesadilla with salsa and a side of French fries"

  it("prefixes the portion eaten", () => {
    expect(describePortion(desc, 0.5)).toBe(`½ of ${desc}`)
  })

  it("replaces an existing prefix instead of stacking them", () => {
    const half = describePortion(desc, 0.5)
    const quarter = describePortion(half, 0.25)
    expect(quarter).toBe(`¼ of ${desc}`)
    expect(quarter).not.toMatch(/of ½ of/)
  })

  it("strips the prefix when returning to a full portion", () => {
    const half = describePortion(desc, 0.5)
    expect(describePortion(half, 1)).toBe(desc)
  })

  it("has a label for every portion option", () => {
    for (const p of PORTION_OPTIONS) {
      expect(describePortion(desc, p.factor)).toBe(`${p.label} of ${desc}`)
    }
  })
})
