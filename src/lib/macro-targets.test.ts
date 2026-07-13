import { describe, it, expect } from "vitest"
import { estimateBmr, macroTargets, type MacroTargetInputs } from "./macro-targets"

const PROFILE: MacroTargetInputs = {
  age: 51,
  sex: "male",
  height_inches: 70,
  current_weight: 195,
  primary_goal: "lose_weight",
  target_weight: 175,
  workout_days: 5,
}

describe("estimateBmr", () => {
  it("computes Mifflin-St Jeor from imperial inputs", () => {
    // 195 lb = 88.45 kg, 70 in = 177.8 cm:
    // 10*88.45 + 6.25*177.8 - 5*51 + 5 = 1745.76
    expect(estimateBmr(PROFILE)).toBeCloseTo(1745.76, 1)
  })

  it("uses the female constant and the midpoint for 'other'", () => {
    const female = estimateBmr({ ...PROFILE, sex: "female" })
    const other = estimateBmr({ ...PROFILE, sex: "other" })
    const male = estimateBmr(PROFILE)
    expect(male! - female!).toBeCloseTo(166, 5)
    expect(other).toBeCloseTo((male! + female!) / 2, 5)
  })

  it("returns null when any input is missing or implausible", () => {
    expect(estimateBmr({ ...PROFILE, age: null })).toBeNull()
    expect(estimateBmr({ ...PROFILE, sex: null })).toBeNull()
    expect(estimateBmr({ ...PROFILE, height_inches: null })).toBeNull()
    expect(estimateBmr({ ...PROFILE, current_weight: null })).toBeNull()
    expect(estimateBmr({ ...PROFILE, age: 7 })).toBeNull()
    expect(estimateBmr({ ...PROFILE, current_weight: 0 })).toBeNull()
  })
})

describe("macroTargets", () => {
  it("applies a 500-cal deficit and anchors protein to target weight on a cut", () => {
    const t = macroTargets(PROFILE)!
    // TDEE = 1745.76 * 1.64 = 2863.0, minus 500 → 2363.0 → rounds to 2360.
    expect(t.calories).toBe(2360)
    // 1 g/lb of the 175 lb target weight, not the 195 lb current weight.
    expect(t.protein_g).toBe(175)
    // 30% of 2363 cal / 9 = 78.8 g → rounds to 80.
    expect(t.fat_g).toBe(80)
    // Remainder: (2363.0 - 700 - 708.9) / 4 = 238.5 → rounds to 240.
    expect(t.carbs_g).toBe(240)
    // WHO free-sugars ceiling: 10% of 2360 cal / 4 = 59 → rounds to 60.
    expect(t.sugar_limit_g).toBe(60)
    expect(t.goalNote).toMatch(/deficit/)
  })

  it("computes maintenance targets for general fitness", () => {
    const t = macroTargets({
      age: 30,
      sex: "female",
      height_inches: 65,
      current_weight: 140,
      primary_goal: "general_fitness",
      target_weight: null,
      workout_days: 3,
    })!
    // BMR 1355.9 * 1.465 = 1986.4 → rounds to 1990.
    expect(t.calories).toBe(1990)
    expect(t.protein_g).toBe(110) // 0.8 g/lb * 140 = 112 → rounds to 110
    expect(t.fat_g).toBe(65) // 30% of 1986.4 / 9 = 66.2
    expect(t.carbs_g).toBe(235) // (1986.4 - 448 - 595.9) / 4 = 235.6
    expect(t.sugar_limit_g).toBe(50) // 10% of 1990 / 4 = 49.75
    expect(t.goalNote).toMatch(/maintenance/)
  })

  it("adds a surplus for build_muscle and keeps protein on current weight", () => {
    const t = macroTargets({
      ...PROFILE,
      primary_goal: "build_muscle",
      target_weight: 205,
    })!
    // TDEE 2863.0 + 300 = 3163.0 → 3160.
    expect(t.calories).toBe(3160)
    expect(t.protein_g).toBe(195) // 1 g/lb of current weight
  })

  it("gives endurance a leaner protein/fat split (more carbs)", () => {
    const base = macroTargets({ ...PROFILE, primary_goal: "general_fitness" })!
    const endurance = macroTargets({
      ...PROFILE,
      primary_goal: "improve_endurance",
    })!
    expect(endurance.protein_g).toBeLessThan(base.protein_g)
    expect(endurance.fat_g).toBeLessThan(base.fat_g)
    expect(endurance.carbs_g).toBeGreaterThan(base.carbs_g)
  })

  it("floors the deficit at a safe daily minimum", () => {
    const t = macroTargets({
      age: 60,
      sex: "female",
      height_inches: 60,
      current_weight: 110,
      primary_goal: "lose_weight",
      target_weight: null,
      workout_days: 2,
    })!
    // BMR 990.5 * 1.375 - 500 = 861.8 → floored at 1200.
    expect(t.calories).toBe(1200)
  })

  it("returns null for a missing or incomplete profile", () => {
    expect(macroTargets(null)).toBeNull()
    expect(macroTargets(undefined)).toBeNull()
    expect(macroTargets({ ...PROFILE, height_inches: null })).toBeNull()
  })

  it("defaults unset goal and workout days to general fitness at 4 days/week", () => {
    const t = macroTargets({
      ...PROFILE,
      primary_goal: null,
      workout_days: null,
    })!
    // TDEE = 1745.76 * 1.55 = 2705.9 → 2710, no goal delta.
    expect(t.calories).toBe(2710)
    expect(t.goalNote).toMatch(/general fitness/)
  })
})
