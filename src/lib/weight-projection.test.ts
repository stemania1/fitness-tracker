import { describe, it, expect } from "vitest"
import {
  linearRegression,
  logsToPoints,
  projectWeightDate,
  projectFromRecentLogs,
} from "./weight-projection"

describe("linearRegression", () => {
  it("fits a flat line through identical points", () => {
    const fit = linearRegression([
      { day: 0, weight: 180 },
      { day: 5, weight: 180 },
    ])
    expect(fit?.slope).toBeCloseTo(0, 5)
    expect(fit?.intercept).toBeCloseTo(180, 5)
  })

  it("fits a downward slope", () => {
    // Lose 1 lb per day over 10 days
    const points = Array.from({ length: 10 }, (_, i) => ({
      day: i,
      weight: 200 - i,
    }))
    const fit = linearRegression(points)
    expect(fit?.slope).toBeCloseTo(-1, 5)
  })

  it("returns null with too few points", () => {
    expect(linearRegression([])).toBeNull()
    expect(linearRegression([{ day: 0, weight: 180 }])).toBeNull()
  })

  it("returns null when all points share the same day", () => {
    expect(
      linearRegression([
        { day: 5, weight: 180 },
        { day: 5, weight: 181 },
      ])
    ).toBeNull()
  })
})

describe("projectWeightDate", () => {
  const now = new Date("2026-05-17T12:00:00Z")

  it("projects days to target for a healthy losing trend", () => {
    // Lose 1 lb/week (1/7 per day). 200 → 190 = 10 lbs at 1 lb/week = 70 days
    const fit = { slope: -1 / 7, intercept: 200 }
    const result = projectWeightDate(200, 190, fit, now)
    expect(result?.onTrack).toBe(true)
    expect(result?.daysToTarget).toBe(70)
    expect(result?.lbsPerWeek).toBeCloseTo(-1, 5)
    expect(result?.projectedDate).toBe("2026-07-26")
  })

  it("marks user off track when slope is the wrong direction", () => {
    // Goal is to lose, but trending up
    const fit = { slope: 0.1, intercept: 200 }
    const result = projectWeightDate(200, 190, fit, now)
    expect(result?.onTrack).toBe(false)
  })

  it("returns null for missing fit", () => {
    expect(projectWeightDate(200, 190, null, now)).toBeNull()
  })

  it("returns null when current and target are equal", () => {
    const fit = { slope: -0.1, intercept: 200 }
    expect(projectWeightDate(200, 200, fit, now)).toBeNull()
  })

  it("handles weight-gain goal", () => {
    // 150 → 170, gaining 0.5 lb/week (0.5/7 per day)
    const fit = { slope: 0.5 / 7, intercept: 150 }
    const result = projectWeightDate(150, 170, fit, now)
    expect(result?.onTrack).toBe(true)
    expect(result?.daysToTarget).toBe(280)
  })
})

describe("logsToPoints", () => {
  it("converts logs and filters zero weights", () => {
    const points = logsToPoints([
      { logged_at: "2026-05-01T00:00:00Z", weight: 180 },
      { logged_at: "2026-05-02T00:00:00Z", weight: 0 },
      { logged_at: "2026-05-03T00:00:00Z", weight: 179 },
    ])
    expect(points).toHaveLength(2)
    expect(points[0].weight).toBe(180)
    expect(points[1].weight).toBe(179)
    // Day numbers should be one apart
    expect(points[1].day - points[0].day).toBe(2)
  })
})

describe("projectWeightDate — guardrails", () => {
  const now = new Date("2026-01-01T00:00:00Z")

  it("labels wrong-direction trends with a reason", () => {
    // Gaining while trying to lose
    const fit = { slope: 0.1, intercept: 200 }
    const result = projectWeightDate(200, 190, fit, now)
    expect(result?.onTrack).toBe(false)
    expect(result?.reason).toBe("wrong_direction")
  })

  it("rejects projections more than 2 years out as too slow", () => {
    // Losing 0.002 lbs/day → 10 lbs takes ~5000 days
    const fit = { slope: -0.002, intercept: 200 }
    const result = projectWeightDate(200, 190, fit, now)
    expect(result?.onTrack).toBe(false)
    expect(result?.reason).toBe("too_slow")
    expect(result?.projectedDate).toBe("")
  })

  it("accepts projections just inside the 2-year horizon", () => {
    // 10 lbs at ~0.0143 lbs/day ≈ 700 days
    const fit = { slope: -10 / 700, intercept: 200 }
    const result = projectWeightDate(200, 190, fit, now)
    expect(result?.onTrack).toBe(true)
    expect(result?.daysToTarget).toBe(700)
  })

  it("flags rapid loss beyond 2 lbs/week", () => {
    // 3.5 lbs/week loss
    const fit = { slope: -0.5, intercept: 200 }
    const result = projectWeightDate(200, 190, fit, now)
    expect(result?.onTrack).toBe(true)
    expect(result?.rapidRate).toBe(true)
  })

  it("does not flag a sustainable 1 lb/week pace", () => {
    const fit = { slope: -1 / 7, intercept: 200 }
    const result = projectWeightDate(200, 190, fit, now)
    expect(result?.onTrack).toBe(true)
    expect(result?.rapidRate).toBe(false)
  })
})

describe("projectFromRecentLogs", () => {
  const now = new Date("2026-08-07T12:00:00Z")

  /** Steady 1 lb/week loss over the given days, newest last. */
  function steadyLogs(days: number, startWeight: number) {
    const out: { logged_at: string; weight: number }[] = []
    for (let d = days; d >= 0; d -= 7) {
      const t = new Date(now.getTime() - d * 86_400_000)
      out.push({ logged_at: t.toISOString(), weight: startWeight - (days - d) / 7 })
    }
    return out
  }

  it("projects from the recent trend", () => {
    const result = projectFromRecentLogs(steadyLogs(56, 200), 192, 188, now)
    expect(result?.onTrack).toBe(true)
    expect(result?.lbsPerWeek).toBeCloseTo(-1, 1)
  })

  it("ignores logs older than the 60-day window", () => {
    // Old logs show rapid GAIN; recent logs show loss. If the window leaked,
    // the slope would flip direction.
    const old = [
      { logged_at: new Date(now.getTime() - 100 * 86_400_000).toISOString(), weight: 150 },
      { logged_at: new Date(now.getTime() - 90 * 86_400_000).toISOString(), weight: 170 },
    ]
    const result = projectFromRecentLogs(
      [...old, ...steadyLogs(28, 200)],
      196,
      192,
      now
    )
    expect(result?.onTrack).toBe(true)
    expect(result?.lbsPerWeek).toBeLessThan(0)
  })

  it("returns null without a target, a current weight, or 2+ logs", () => {
    const logs = steadyLogs(28, 200)
    expect(projectFromRecentLogs(logs, null, 188, now)).toBeNull()
    expect(projectFromRecentLogs(logs, 196, undefined, now)).toBeNull()
    expect(projectFromRecentLogs([logs[0]], 196, 188, now)).toBeNull()
    expect(projectFromRecentLogs(undefined, 196, 188, now)).toBeNull()
  })
})
