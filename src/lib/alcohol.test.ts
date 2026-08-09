import { describe, it, expect } from "vitest"
import {
  alcoholOnBoardG,
  alcoholStatus,
  lateAlcoholFlag,
  minutesToClear,
  ALCOHOL_CLEARANCE_G_PER_HOUR,
  type AlcoholDose,
} from "./alcohol"

const dose = (grams: number, minutesAgo: number, hour = 20, minute = 0): AlcoholDose => ({
  grams,
  minutesAgo,
  hour,
  minute,
})

describe("alcoholOnBoardG", () => {
  it("is the full dose the moment it's drunk", () => {
    expect(alcoholOnBoardG([dose(14, 0)])).toBeCloseTo(14, 1)
  })

  // The defining difference from caffeine: a straight line down, not a curve.
  it("clears at a constant rate rather than by half-life", () => {
    const afterOneHour = alcoholOnBoardG([dose(28, 60)])
    const afterTwoHours = alcoholOnBoardG([dose(28, 120)])
    expect(afterOneHour).toBeCloseTo(28 - ALCOHOL_CLEARANCE_G_PER_HOUR, 1)
    expect(afterTwoHours).toBeCloseTo(28 - 2 * ALCOHOL_CLEARANCE_G_PER_HOUR, 1)
    // Equal drops, where a half-life model would give a shrinking one.
    expect(afterOneHour - afterTwoHours).toBeCloseTo(
      28 - afterOneHour,
      1
    )
  })

  it("never goes negative, however long ago the drink was", () => {
    expect(alcoholOnBoardG([dose(14, 60 * 24)])).toBe(0)
  })

  /**
   * The reason this simulates forward instead of subtracting one total: the
   * liver can only clear what's actually present. An early drink that has
   * already cleared must not lend its idle clearance to a later one.
   */
  it("does not let a cleared drink absorb clearance owed to a later one", () => {
    // 14g at 6 hours ago is long gone; 14g five minutes ago is essentially intact.
    const spread = alcoholOnBoardG([dose(14, 360), dose(14, 5)])
    expect(spread).toBeCloseTo(14 - clearedIn(5), 1)

    // Naively "total minus rate × time since the first drink" would read zero.
    expect(spread).toBeGreaterThan(0)
  })

  it("accumulates drinks taken close together", () => {
    const together = alcoholOnBoardG([dose(14, 30), dose(14, 0)])
    expect(together).toBeCloseTo(28 - clearedIn(30), 1)
  })

  it("ignores a dose logged in the future", () => {
    expect(alcoholOnBoardG([dose(14, -60)])).toBe(0)
  })

  it("is zero with nothing logged", () => {
    expect(alcoholOnBoardG([])).toBe(0)
  })
})

describe("minutesToClear", () => {
  it("scales linearly with the load", () => {
    expect(minutesToClear(ALCOHOL_CLEARANCE_G_PER_HOUR)).toBe(60)
    expect(minutesToClear(2 * ALCOHOL_CLEARANCE_G_PER_HOUR)).toBe(120)
  })

  it("is zero when nothing is on board", () => {
    expect(minutesToClear(0)).toBe(0)
  })
})

describe("alcoholStatus", () => {
  it("says nothing when there's nothing on board", () => {
    const s = alcoholStatus([])
    expect(s.level).toBe("none")
    expect(s.message).toBeNull()
  })

  it("reports what's left in drinks and how long it needs", () => {
    const s = alcoholStatus([dose(28, 0)])
    expect(s.level).toBe("clearing")
    expect(s.drinksOnBoard).toBeCloseTo(2, 1)
    expect(s.minutesToClear).toBe(minutesToClear(s.gramsOnBoard))
    expect(s.message).toMatch(/2 drinks/)
    expect(s.message).toMatch(/hr/)
  })
})

describe("lateAlcoholFlag", () => {
  const bedtime = { hour: 22, minute: 30 }

  it("flags a drink inside the pre-bed window", () => {
    // Cutoff is 19:30; 21:00 is well inside it.
    const flag = lateAlcoholFlag([dose(14, 30, 21, 0)], bedtime)
    expect(flag.late).toBe(true)
    expect(flag.message).toMatch(/7:30/)
    // Names the real mechanism, which is the opposite of caffeine's.
    expect(flag.message).toMatch(/REM/)
  })

  it("leaves an early drink alone", () => {
    expect(lateAlcoholFlag([dose(14, 600, 12, 30)], bedtime).late).toBe(false)
  })

  it("flags exactly at the cutoff", () => {
    expect(lateAlcoholFlag([dose(14, 60, 19, 30)], bedtime).late).toBe(true)
  })

  it("says nothing without a bedtime to reason from", () => {
    expect(lateAlcoholFlag([dose(14, 30, 21, 0)], null).late).toBe(false)
  })

  it("ignores a zero-alcohol drink", () => {
    expect(lateAlcoholFlag([dose(0, 30, 21, 0)], bedtime).late).toBe(false)
  })
})

function clearedIn(minutes: number): number {
  return (minutes / 60) * ALCOHOL_CLEARANCE_G_PER_HOUR
}
