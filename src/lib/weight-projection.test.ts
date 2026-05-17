import { describe, it, expect } from "vitest"
import {
  linearRegression,
  logsToPoints,
  projectWeightDate,
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
