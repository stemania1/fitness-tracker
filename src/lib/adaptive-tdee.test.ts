import { describe, it, expect } from "vitest"
import {
  estimateAdaptiveTdee,
  targetIntakeForRate,
  recommendedRate,
  CALORIES_PER_LB,
  type DailyIntake,
} from "./adaptive-tdee"
import type { WeightPoint } from "./weight-projection"

/** 30 daily weigh-ins losing exactly `lbPerWeek`, starting at `start`. */
function weighIns(start: number, lbPerWeek: number, days = 30): WeightPoint[] {
  const perDay = lbPerWeek / 7
  return Array.from({ length: days }, (_, i) => ({
    day: 1000 + i,
    weight: start + perDay * i,
  }))
}

/** `days` of constant intake. */
function intake(cals: number, days = 30): DailyIntake[] {
  return Array.from({ length: days }, (_, i) => ({ day: 1000 + i, calories: cals }))
}

describe("estimateAdaptiveTdee", () => {
  it("recovers TDEE from intake minus weight change", () => {
    // Losing 1 lb/week on 2000 kcal → deficit 3500/week = 500/day → TDEE 2500.
    const est = estimateAdaptiveTdee(weighIns(200, -1), intake(2000))
    expect(est.tdee).toBe(2500)
    expect(est.avgIntake).toBe(2000)
    expect(est.lbsPerWeek).toBe(-1)
  })

  it("equals intake when weight is stable (maintenance)", () => {
    const est = estimateAdaptiveTdee(weighIns(200, 0), intake(2200))
    expect(est.tdee).toBe(2200)
    expect(est.lbsPerWeek).toBe(0)
  })

  it("reads TDEE below intake when gaining weight", () => {
    // Gaining 1 lb/week on 3000 → surplus 500/day → TDEE 2500.
    const est = estimateAdaptiveTdee(weighIns(180, 1), intake(3000))
    expect(est.tdee).toBe(2500)
    expect(est.lbsPerWeek).toBe(1)
  })

  it("is insufficient with too little data", () => {
    const est = estimateAdaptiveTdee(weighIns(200, -1, 5), intake(2000, 5))
    expect(est.confidence).toBe("insufficient")
    expect(est.tdee).toBeNull()
    // Still reports what it has so far.
    expect(est.avgIntake).toBe(2000)
    expect(est.intakeDayCount).toBe(5)
  })

  it("grades confidence up with more span and logs", () => {
    expect(estimateAdaptiveTdee(weighIns(200, -1, 30), intake(2000, 30)).confidence).toBe("high")
    expect(estimateAdaptiveTdee(weighIns(200, -1, 22), intake(2000, 16)).confidence).toBe("medium")
    expect(estimateAdaptiveTdee(weighIns(200, -1, 16), intake(2000, 10)).confidence).toBe("low")
  })

  it("handles no data at all", () => {
    const est = estimateAdaptiveTdee([], [])
    expect(est.tdee).toBeNull()
    expect(est.avgIntake).toBeNull()
    expect(est.lbsPerWeek).toBeNull()
    expect(est.confidence).toBe("insufficient")
  })
})

describe("targetIntakeForRate", () => {
  it("subtracts a deficit for a loss rate", () => {
    // Lose 1 lb/week from a 2500 maintenance → 2000.
    expect(targetIntakeForRate(2500, -1)).toBe(2000)
  })

  it("adds a surplus for a gain rate", () => {
    expect(targetIntakeForRate(2500, 1)).toBe(3000)
  })

  it("clamps to a safe floor", () => {
    expect(targetIntakeForRate(1500, -2, 1200)).toBe(1200)
  })

  it("uses the 3500 kcal/lb constant", () => {
    expect(targetIntakeForRate(3000, -1)).toBe(3000 - CALORIES_PER_LB / 7)
  })
})

describe("recommendedRate", () => {
  it("recommends a deficit when above target", () => {
    expect(recommendedRate(200, 180)).toBe(-1)
  })

  it("recommends a surplus when below target", () => {
    expect(recommendedRate(140, 160)).toBe(1)
  })

  it("caps at ~1% of bodyweight per week", () => {
    // 80 lb person → 1% = 0.8 lb/week, below the 1 lb cap.
    expect(recommendedRate(80, 60)).toBe(-0.8)
  })

  it("is zero near the target or with no target", () => {
    expect(recommendedRate(180.5, 180)).toBe(0)
    expect(recommendedRate(200, null)).toBe(0)
  })
})
