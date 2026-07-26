import { describe, it, expect } from "vitest"
import { shiftDate, currentStreak } from "./creatine-streak"

describe("shiftDate", () => {
  it("moves forward and back across month boundaries", () => {
    expect(shiftDate("2026-07-26", 1)).toBe("2026-07-27")
    expect(shiftDate("2026-07-01", -1)).toBe("2026-06-30")
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01")
  })
})

describe("currentStreak", () => {
  const today = "2026-07-26"

  it("counts consecutive days ending today when today is taken", () => {
    const taken = ["2026-07-24", "2026-07-25", "2026-07-26"]
    expect(currentStreak(taken, today)).toBe(3)
  })

  it("counts back from yesterday when today isn't logged yet", () => {
    // Not taken today, but a 2-day run through yesterday still stands.
    const taken = ["2026-07-24", "2026-07-25"]
    expect(currentStreak(taken, today)).toBe(2)
  })

  it("is 0 when neither today nor yesterday is taken", () => {
    const taken = ["2026-07-20", "2026-07-21"]
    expect(currentStreak(taken, today)).toBe(0)
  })

  it("stops at the first gap", () => {
    // Missing 07-24 breaks the run; only today + yesterday count.
    const taken = ["2026-07-22", "2026-07-25", "2026-07-26"]
    expect(currentStreak(taken, today)).toBe(2)
  })

  it("is 1 for a single day taken today", () => {
    expect(currentStreak([today], today)).toBe(1)
  })

  it("is 0 with no history", () => {
    expect(currentStreak([], today)).toBe(0)
  })
})
