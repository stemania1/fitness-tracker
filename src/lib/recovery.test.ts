import { describe, it, expect } from "vitest"
import { readinessGate, hrvBaseline } from "./recovery"
import type { PlanSession } from "@/data/training-plan"
import type { DailyMetrics } from "@/lib/sleep-insights"

const cardio: PlanSession = {
  key: "intervals-4x4",
  title: "VO2 Max intervals — 4×4",
  type: "cardio",
  time: "5:45 AM",
  durationMins: 40,
  details: [],
}
const strength: PlanSession = {
  key: "pull-b",
  title: "Pull B",
  type: "strength",
  time: "5:45 AM",
  durationMins: 45,
  details: [],
}
const rest: PlanSession = {
  key: "rest",
  title: "Rest",
  type: "rest",
  time: "",
  durationMins: 0,
  details: [],
}

describe("readinessGate", () => {
  it("green-lights a hard session at high readiness", () => {
    const g = readinessGate(cardio, 88)
    expect(g.action).toBe("go")
    expect(g.headline).toMatch(/green light/i)
  })

  it("recommends moderation in the middle band", () => {
    expect(readinessGate(cardio, 75).action).toBe("moderate")
    expect(readinessGate(strength, 70).action).toBe("moderate")
  })

  it("downshifts a hard cardio day at low readiness with a cardio-specific swap", () => {
    const g = readinessGate(cardio, 60)
    expect(g.action).toBe("downshift")
    expect(g.detail).toMatch(/zone 2/i)
    expect(g.detail).toMatch(/tomorrow/i)
  })

  it("downshifts a strength day with a strength-specific swap", () => {
    const g = readinessGate(strength, 55)
    expect(g.action).toBe("downshift")
    expect(g.detail).toMatch(/drop a set/i)
  })

  it("never gates a rest day", () => {
    expect(readinessGate(rest, 50).action).toBe("none")
    expect(readinessGate(rest, 95).action).toBe("none")
  })

  it("returns 'none' when readiness is unavailable", () => {
    expect(readinessGate(cardio, null).action).toBe("none")
    expect(readinessGate(cardio, undefined).action).toBe("none")
  })

  it("uses the exact band boundaries (85 and 70)", () => {
    expect(readinessGate(cardio, 85).action).toBe("go")
    expect(readinessGate(cardio, 84).action).toBe("moderate")
    expect(readinessGate(cardio, 70).action).toBe("moderate")
    expect(readinessGate(cardio, 69).action).toBe("downshift")
  })
})

function nights(hrvSeries: Array<number | null>): DailyMetrics[] {
  // Oldest first; day strings ascend so sorting is stable.
  return hrvSeries.map((hrv, i) => ({
    day: `2026-05-${String(i + 1).padStart(2, "0")}`,
    remMinutes: null,
    remFraction: null,
    totalSleepMinutes: null,
    stressHighSeconds: null,
    activityScore: null,
    highActivityMinutes: null,
    readinessScore: null,
    averageHrv: hrv,
  }))
}

describe("hrvBaseline", () => {
  it("reports insufficient data below the minimum window", () => {
    const b = hrvBaseline(nights(Array(10).fill(60)))
    expect(b.status).toBe("insufficient")
    expect(b.recentAvg).toBeNull()
  })

  it("reports normal when recent HRV holds at baseline", () => {
    // 21 baseline nights at 60, 7 recent at 60 → 0% delta.
    const b = hrvBaseline(nights([...Array(21).fill(60), ...Array(7).fill(60)]))
    expect(b.status).toBe("normal")
    expect(b.deltaPct).toBe(0)
    expect(b.recentAvg).toBe(60)
    expect(b.baselineAvg).toBe(60)
  })

  it("flags 'suppressed' for a modest sustained drop", () => {
    // baseline 60, recent ~55.8 → -7% → suppressed (between -5 and -10).
    const b = hrvBaseline(nights([...Array(21).fill(60), ...Array(7).fill(55.8)]))
    expect(b.status).toBe("suppressed")
    expect(b.message).toMatch(/below your baseline/i)
  })

  it("flags 'low' for a large sustained drop", () => {
    // baseline 60, recent 51 → -15% → low.
    const b = hrvBaseline(nights([...Array(21).fill(60), ...Array(7).fill(51)]))
    expect(b.status).toBe("low")
    expect(b.message).toMatch(/overreaching/i)
  })

  it("ignores nights missing HRV and still uses the most recent window", () => {
    const series = [...Array(21).fill(60), ...Array(7).fill(51)]
    // Sprinkle nulls that should be filtered out without breaking windows.
    const withNulls = nights([null, ...series, null])
    const b = hrvBaseline(withNulls)
    expect(b.status).toBe("low")
    expect(b.recentNights).toBe(7)
  })
})
