import { describe, it, expect } from "vitest"
import {
  buildEnergyHistory,
  MATCH_BAND,
  MIN_DAYS_FOR_PATTERN,
  type EnergyHistoryDay,
} from "./energy-history"

/** A check-in with no objective signals, so the expectation is the 3 baseline. */
function day(
  date: string,
  felt: number,
  overrides: Partial<EnergyHistoryDay> = {}
): EnergyHistoryDay {
  return { day: date, felt, hour: 10, signals: {}, ...overrides }
}

/** N consecutive days, all reporting `felt` against a neutral expectation. */
function run(count: number, felt: number): EnergyHistoryDay[] {
  return Array.from({ length: count }, (_, i) =>
    day(`2026-08-${String(i + 1).padStart(2, "0")}`, felt)
  )
}

describe("buildEnergyHistory", () => {
  it("is empty and says nothing with no check-ins", () => {
    const h = buildEnergyHistory([])
    expect(h.points).toHaveLength(0)
    expect(h.summary).toBeNull()
  })

  it("pairs each check-in with a recomputed expectation", () => {
    const h = buildEnergyHistory([day("2026-08-01", 4)])
    expect(h.points).toHaveLength(1)
    expect(h.points[0]).toMatchObject({ day: "2026-08-01", felt: 4, expected: 3 })
    expect(h.points[0].delta).toBe(1)
  })

  it("sorts by day so the line reads left to right", () => {
    const h = buildEnergyHistory([
      day("2026-08-03", 3),
      day("2026-08-01", 3),
      day("2026-08-02", 3),
    ])
    expect(h.points.map((p) => p.day)).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
    ])
  })

  it("uses the check-in's own hour, not a fixed one", () => {
    // The circadian term makes late evening a lower expectation than morning.
    const morning = buildEnergyHistory([day("2026-08-01", 3, { hour: 10 })])
    const lateEvening = buildEnergyHistory([day("2026-08-01", 3, { hour: 22 })])
    expect(lateEvening.points[0].expected).toBeLessThan(
      morning.points[0].expected
    )
  })

  it("feeds each day's own signals into the expectation", () => {
    const greatSleep = buildEnergyHistory([
      day("2026-08-01", 3, { signals: { sleepScore: 92 } }),
    ])
    const poorSleep = buildEnergyHistory([
      day("2026-08-01", 3, { signals: { sleepScore: 45 } }),
    ])
    expect(greatSleep.points[0].expected).toBeGreaterThan(
      poorSleep.points[0].expected
    )
    // Same felt level, so the gap flips sign with the expectation.
    expect(greatSleep.points[0].delta).toBeLessThan(0)
    expect(poorSleep.points[0].delta).toBeGreaterThan(0)
  })

  it("counts days above, below, and inside the match band", () => {
    const h = buildEnergyHistory([
      day("2026-08-01", 5), // +2 → above
      day("2026-08-02", 1), // -2 → below
      day("2026-08-03", 3), // 0 → matching
    ])
    expect(h.aboveDays).toBe(1)
    expect(h.belowDays).toBe(1)
    expect(h.matchingDays).toBe(1)
  })

  it("treats a gap inside the band as tracking, not a miss", () => {
    // Baseline expectation is 3; feeling 3 is a perfect match.
    const h = buildEnergyHistory(run(MIN_DAYS_FOR_PATTERN, 3))
    expect(h.matchingDays).toBe(MIN_DAYS_FOR_PATTERN)
    expect(h.pattern).toBe("tracking")
    expect(h.summary).toMatch(/calibrated/)
  })

  it("calls out a persistent gap below the prediction", () => {
    const h = buildEnergyHistory(run(MIN_DAYS_FOR_PATTERN, 1))
    expect(h.meanDelta).toBeLessThan(-MATCH_BAND)
    expect(h.pattern).toBe("below")
    expect(h.summary).toMatch(/below/)
    // Names causes outside the app rather than implying the numbers are wrong.
    expect(h.summary).toMatch(/hydration|stress|illness|under-eating/)
  })

  it("calls out consistently feeling better than predicted", () => {
    const h = buildEnergyHistory(run(MIN_DAYS_FOR_PATTERN, 5))
    expect(h.pattern).toBe("above")
    expect(h.summary).toMatch(/above/)
  })

  /**
   * Opposite-signed misses average to nearly zero. Without the day count in
   * the classification, a fortnight of wild swings would report as calibrated.
   */
  it("does not read swings on both sides as tracking", () => {
    const days = Array.from({ length: 8 }, (_, i) =>
      day(`2026-08-0${i + 1}`, i % 2 === 0 ? 5 : 1)
    )
    const h = buildEnergyHistory(days)
    expect(Math.abs(h.meanDelta)).toBeLessThanOrEqual(MATCH_BAND)
    expect(h.pattern).not.toBe("tracking")
    expect(h.pattern).toBe("mixed")
  })

  // Three bad days is not a trend, and saying so is how you get a card that
  // tells someone their life is falling apart because they slept badly twice.
  it("draws the points but withholds a verdict on too few days", () => {
    const h = buildEnergyHistory(run(MIN_DAYS_FOR_PATTERN - 1, 1))
    expect(h.points).toHaveLength(MIN_DAYS_FOR_PATTERN - 1)
    expect(h.summary).toBeNull()
    expect(h.pattern).toBe("mixed")
  })
})
