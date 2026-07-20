import { describe, it, expect } from "vitest"
import {
  partOfDay,
  expectedEnergy,
  reconcileEnergy,
  assessEnergy,
  type EnergyInputs,
} from "./energy"

/** A mid-morning check-in with no objective signals. */
function base(overrides: Partial<EnergyInputs> = {}): EnergyInputs {
  return { hour: 10, ...overrides }
}

describe("partOfDay", () => {
  it("splits the day into morning / afternoon / evening", () => {
    expect(partOfDay(6)).toBe("morning")
    expect(partOfDay(11)).toBe("morning")
    expect(partOfDay(12)).toBe("afternoon")
    expect(partOfDay(16)).toBe("afternoon")
    expect(partOfDay(17)).toBe("evening")
    expect(partOfDay(23)).toBe("evening")
  })
})

describe("expectedEnergy — baseline & signal counting", () => {
  it("returns a moderate, time-of-day-only read with no signals", () => {
    const e = expectedEnergy(base({ hour: 10 }))
    expect(e.signalCount).toBe(0)
    expect(e.band).toBe("moderate")
    expect(e.score).toBe(3)
    expect(e.drivers).toHaveLength(0)
  })

  it("counts each objective signal that is present", () => {
    const e = expectedEnergy(
      base({ sleepScore: 90, readinessScore: 88, trainedHardToday: true, fuel: "under" })
    )
    expect(e.signalCount).toBe(4)
  })

  it("clamps the score to the 1-5 range", () => {
    const worst = expectedEnergy(
      base({ hour: 22, sleepScore: 30, sleepMinutes: 200, readinessScore: 40, fuel: "under", trainedHardToday: true })
    )
    expect(worst.score).toBeGreaterThanOrEqual(1)
    const best = expectedEnergy(base({ hour: 10, sleepScore: 99, readinessScore: 99 }))
    expect(best.score).toBeLessThanOrEqual(5)
  })
})

describe("expectedEnergy — sleep", () => {
  it("great sleep lifts energy", () => {
    const e = expectedEnergy(base({ sleepScore: 90 }))
    expect(e.score).toBeGreaterThan(3)
    expect(e.band).toBe("high")
    expect(e.drivers[0]).toEqual({ label: "Great sleep last night", direction: "up" })
  })

  it("poor sleep drops energy", () => {
    const e = expectedEnergy(base({ sleepScore: 45 }))
    expect(e.score).toBeLessThan(3)
    expect(e.band).toBe("low")
  })

  it("falls back to sleep duration when no score is present", () => {
    const plenty = expectedEnergy(base({ sleepMinutes: 480 }))
    expect(plenty.score).toBeGreaterThan(3)
    expect(plenty.signalCount).toBe(1)

    const scant = expectedEnergy(base({ sleepMinutes: 300 }))
    expect(scant.score).toBeLessThan(3)
  })

  it("adds a short-night penalty on top of a decent score", () => {
    const decentButShort = expectedEnergy(base({ sleepScore: 72, sleepMinutes: 330 }))
    const decentOnly = expectedEnergy(base({ sleepScore: 72, sleepMinutes: 420 }))
    expect(decentButShort.score).toBeLessThan(decentOnly.score)
  })
})

describe("expectedEnergy — recovery", () => {
  it("high readiness lifts, low readiness drops", () => {
    expect(expectedEnergy(base({ readinessScore: 90 })).score).toBeGreaterThan(3)
    expect(expectedEnergy(base({ readinessScore: 60 })).score).toBeLessThan(3)
  })

  it("prefers readiness over HRV status to avoid double-counting", () => {
    // Readiness present: hrvStatus should be ignored.
    const withBoth = expectedEnergy(base({ readinessScore: 90, hrvStatus: "low" }))
    const readinessOnly = expectedEnergy(base({ readinessScore: 90 }))
    expect(withBoth.score).toBe(readinessOnly.score)
    expect(withBoth.signalCount).toBe(readinessOnly.signalCount)
  })

  it("uses HRV status only when readiness is absent", () => {
    expect(expectedEnergy(base({ hrvStatus: "low" })).score).toBeLessThan(3)
    expect(expectedEnergy(base({ hrvStatus: "suppressed" })).score).toBeLessThan(3)
    const low = expectedEnergy(base({ hrvStatus: "low" })).score
    const suppressed = expectedEnergy(base({ hrvStatus: "suppressed" })).score
    expect(low).toBeLessThan(suppressed)
  })

  it("normal/insufficient HRV status does not move the score", () => {
    expect(expectedEnergy(base({ hrvStatus: "normal" })).score).toBe(3)
    expect(expectedEnergy(base({ hrvStatus: "insufficient" })).score).toBe(3)
    expect(expectedEnergy(base({ hrvStatus: "normal" })).signalCount).toBe(0)
  })
})

describe("expectedEnergy — training, fuel, circadian", () => {
  it("training today lowers current energy (expected fatigue)", () => {
    expect(expectedEnergy(base({ trainedHardToday: true })).score).toBeLessThan(3)
  })

  it("under-fueling lowers energy more than a big meal", () => {
    const under = expectedEnergy(base({ fuel: "under" })).score
    const over = expectedEnergy(base({ fuel: "over" })).score
    expect(under).toBeLessThan(over)
    expect(over).toBeLessThan(3)
  })

  it("late evening is the strongest circadian drag", () => {
    const lateEve = expectedEnergy(base({ hour: 22 })).score
    const eve = expectedEnergy(base({ hour: 18 })).score
    const morning = expectedEnergy(base({ hour: 10 })).score
    expect(lateEve).toBeLessThan(eve)
    expect(eve).toBeLessThan(morning)
  })

  it("models the early-afternoon dip", () => {
    expect(expectedEnergy(base({ hour: 14 })).score).toBeLessThan(3)
  })

  it("validates evening tiredness after a rest day + a big meal", () => {
    // 8:30pm, no workout, just ate, decent-but-unremarkable sleep. The read
    // should sit at the low end, and feeling tired (2) should reconcile as
    // a match rather than a red flag.
    const e = expectedEnergy({ hour: 20, sleepScore: 74, fuel: "over", trainedHardToday: false })
    expect(e.score).toBeLessThanOrEqual(2.5)
    expect(reconcileEnergy(2, e).verdict).toBe("matches")
  })

  it("with no wearable data, an evening + big meal reads as low energy", () => {
    const e = expectedEnergy({ hour: 20, fuel: "over" })
    expect(e.band).toBe("low")
  })
})

describe("expectedEnergy — drivers", () => {
  it("surfaces the biggest movers first, capped at three", () => {
    const e = expectedEnergy(
      base({ hour: 22, sleepScore: 40, readinessScore: 60, fuel: "over" })
    )
    expect(e.drivers.length).toBeLessThanOrEqual(3)
    // Poor sleep (-1.25) should outrank the smaller movers.
    expect(e.drivers[0].label).toBe("Poor sleep last night")
  })
})

describe("reconcileEnergy", () => {
  it("calls it a match when felt is close to expected", () => {
    const exp = expectedEnergy({ hour: 20, sleepScore: 74, fuel: "over" }) // ~low
    const r = reconcileEnergy(2, exp)
    expect(r.verdict).toBe("matches")
    expect(r.headline).toBe("This tracks.")
  })

  it("flags feeling worse than the signals predict", () => {
    const exp = expectedEnergy(base({ sleepScore: 92, readinessScore: 90 })) // high
    const r = reconcileEnergy(1, exp)
    expect(r.verdict).toBe("below")
    expect(r.detail).toMatch(/hydration|stress|eat/i)
  })

  it("flags feeling better than the signals predict", () => {
    const exp = expectedEnergy(base({ hour: 22, sleepScore: 40 })) // low
    const r = reconcileEnergy(5, exp)
    expect(r.verdict).toBe("above")
    expect(r.headline).toMatch(/tank/i)
  })

  it("adds a hedge when the read is time-of-day only", () => {
    const exp = expectedEnergy(base({ hour: 10 })) // no signals
    const r = reconcileEnergy(3, exp)
    expect(r.detail).toMatch(/time of day alone/i)
  })
})

describe("assessEnergy", () => {
  it("returns expectation only when no felt level is given", () => {
    const { expectation, readout } = assessEnergy(base({ sleepScore: 80 }))
    expect(expectation.signalCount).toBe(1)
    expect(readout).toBeNull()
  })

  it("returns a readout when a felt level is given", () => {
    const { readout } = assessEnergy(base({ sleepScore: 80 }), 3)
    expect(readout).not.toBeNull()
    expect(readout?.felt).toBe(3)
  })
})
