import { describe, it, expect } from "vitest"
import {
  pad2,
  localDateString,
  localToday,
  localDateOf,
  daysAgoDateString,
  epochDay,
  shiftDateString,
} from "./dates"

describe("pad2", () => {
  it("zero-pads single digits and leaves two alone", () => {
    expect(pad2(1)).toBe("01")
    expect(pad2(9)).toBe("09")
    expect(pad2(12)).toBe("12")
  })
})

describe("localDateString", () => {
  it("formats a Date as local YYYY-MM-DD", () => {
    expect(localDateString(new Date(2026, 0, 3))).toBe("2026-01-03")
    expect(localDateString(new Date(2026, 11, 31))).toBe("2026-12-31")
  })

  it("uses the local day, not the UTC day", () => {
    // Late-evening local time is already tomorrow in UTC for negative offsets;
    // the local date must not shift.
    const late = new Date(2026, 6, 26, 23, 30)
    expect(localDateString(late)).toBe("2026-07-26")
  })
})

describe("localToday / localDateOf", () => {
  it("localToday matches today's local date", () => {
    expect(localToday()).toBe(localDateString(new Date()))
  })

  it("localDateOf reads an ISO timestamp's local day", () => {
    const iso = new Date(2026, 6, 26, 9, 15).toISOString()
    expect(localDateOf(iso)).toBe("2026-07-26")
  })
})

describe("daysAgoDateString", () => {
  it("returns today for 0", () => {
    expect(daysAgoDateString(0)).toBe(localToday())
  })

  it("goes back the requested number of days", () => {
    const expected = localDateString(new Date(Date.now() - 7 * 86_400_000))
    expect(daysAgoDateString(7)).toBe(expected)
  })
})

describe("epochDay", () => {
  it("gives consecutive days consecutive indices", () => {
    const a = epochDay(new Date(2026, 6, 26, 8, 0).toISOString())
    const b = epochDay(new Date(2026, 6, 27, 8, 0).toISOString())
    expect(b - a).toBe(1)
  })

  it("is stable across times within the same local day", () => {
    const morning = epochDay(new Date(2026, 6, 26, 1, 0).toISOString())
    const night = epochDay(new Date(2026, 6, 26, 23, 0).toISOString())
    expect(morning).toBe(night)
  })

  it("accepts a Date as well as an ISO string", () => {
    const d = new Date(2026, 6, 26, 12, 0)
    expect(epochDay(d)).toBe(epochDay(d.toISOString()))
  })
})

describe("shiftDateString", () => {
  it("moves forward and back across month and year boundaries", () => {
    expect(shiftDateString("2026-07-26", 1)).toBe("2026-07-27")
    expect(shiftDateString("2026-07-01", -1)).toBe("2026-06-30")
    expect(shiftDateString("2026-12-31", 1)).toBe("2027-01-01")
    expect(shiftDateString("2027-01-01", -1)).toBe("2026-12-31")
  })

  it("is a no-op for 0", () => {
    expect(shiftDateString("2026-07-26", 0)).toBe("2026-07-26")
  })

  it("handles a leap day", () => {
    expect(shiftDateString("2028-02-28", 1)).toBe("2028-02-29")
    expect(shiftDateString("2028-02-29", 1)).toBe("2028-03-01")
  })
})
