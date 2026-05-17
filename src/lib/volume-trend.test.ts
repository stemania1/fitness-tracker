import { describe, it, expect } from "vitest"
import {
  buildWeeklyVolumeTrend,
  shouldSuggestDeload,
} from "./volume-trend"

describe("buildWeeklyVolumeTrend", () => {
  const now = new Date("2026-05-17T12:00:00Z") // a Sunday
  const day = (n: number) =>
    new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

  it("returns the requested number of week buckets ascending", () => {
    const result = buildWeeklyVolumeTrend([], 4, now)
    expect(result).toHaveLength(4)
  })

  it("sums weight × reps into the matching week", () => {
    const sets = [
      // This week
      { exerciseName: "Curl", weight: 25, reps: 10, startedAt: day(1) },
      // 2 weeks ago
      { exerciseName: "Curl", weight: 30, reps: 8, startedAt: day(15) },
    ]
    const result = buildWeeklyVolumeTrend(sets, 4, now)
    expect(result[result.length - 1].volume).toBe(250) // 25*10
    // 15 days ago lands in either week-2 or week-3 depending on dow math
    const earlierVolumes = result.slice(0, -1).map((r) => r.volume)
    expect(earlierVolumes.reduce((a, b) => a + b, 0)).toBe(240) // 30*8
  })

  it("ignores sets older than the window", () => {
    const sets = [
      { exerciseName: "Curl", weight: 50, reps: 10, startedAt: day(120) },
    ]
    const result = buildWeeklyVolumeTrend(sets, 4, now)
    expect(result.every((r) => r.volume === 0)).toBe(true)
  })

  it("ignores sets with missing weight or reps", () => {
    const sets = [
      { exerciseName: "Curl", weight: null, reps: 10, startedAt: day(1) },
      { exerciseName: "Curl", weight: 25, reps: null, startedAt: day(1) },
    ]
    const result = buildWeeklyVolumeTrend(sets, 4, now)
    expect(result.every((r) => r.volume === 0)).toBe(true)
  })
})

describe("shouldSuggestDeload", () => {
  it("suggests deload when 4 complete weeks each climb >= 5%", () => {
    // Last index is current partial week. The 4 before it climb 6% each
    // (comfortably above the 5% threshold even with rounding).
    const volumes = [10_000, 10_600, 11_236, 11_910, 5_000]
    const result = shouldSuggestDeload(volumes)
    expect(result).not.toBeNull()
    expect(result!.climbPercent).toBeGreaterThan(10)
  })

  it("does not suggest when one week dips", () => {
    const volumes = [10_000, 10_500, 10_400, 11_000, 5_000]
    expect(shouldSuggestDeload(volumes)).toBeNull()
  })

  it("does not suggest when growth is below 5%", () => {
    const volumes = [10_000, 10_200, 10_400, 10_600, 5_000]
    expect(shouldSuggestDeload(volumes)).toBeNull()
  })

  it("requires at least 5 weeks of data", () => {
    expect(shouldSuggestDeload([10_000, 11_000, 12_000])).toBeNull()
  })

  it("does not suggest when any of the 4 weeks is zero", () => {
    const volumes = [0, 10_500, 11_025, 11_576, 5_000]
    expect(shouldSuggestDeload(volumes)).toBeNull()
  })
})
