import { describe, it, expect } from "vitest"
import { offsetDate, dayWindow, dayLabel } from "./day-nav"

const base = new Date(2026, 6, 26, 15, 30) // Sun Jul 26 2026, 3:30pm local

describe("offsetDate", () => {
  it("returns local midnight of the offset day", () => {
    const d = offsetDate(0, base)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(26)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it("moves forward and backward by whole days", () => {
    expect(offsetDate(1, base).getDate()).toBe(27)
    expect(offsetDate(-1, base).getDate()).toBe(25)
  })

  it("does not mutate the base date", () => {
    offsetDate(5, base)
    expect(base.getDate()).toBe(26)
    expect(base.getHours()).toBe(15)
  })
})

describe("dayWindow", () => {
  it("spans exactly 24 hours from local midnight", () => {
    const { startIso, endIso } = dayWindow(0, base)
    const span = new Date(endIso).getTime() - new Date(startIso).getTime()
    expect(span).toBe(24 * 60 * 60 * 1000)
  })

  it("start matches the offset day's midnight", () => {
    const { startIso } = dayWindow(-2, base)
    const start = new Date(startIso)
    expect(start.getDate()).toBe(24)
    expect(start.getHours()).toBe(0)
  })
})

describe("dayLabel", () => {
  it("names today, tomorrow, and yesterday", () => {
    expect(dayLabel(0, base)).toBe("Today")
    expect(dayLabel(1, base)).toBe("Tomorrow")
    expect(dayLabel(-1, base)).toBe("Yesterday")
  })

  it("uses a weekday name within a week", () => {
    // base is Sunday; +2 days → Tuesday.
    expect(dayLabel(2, base)).toBe(
      offsetDate(2, base).toLocaleDateString(undefined, { weekday: "long" })
    )
  })

  it("uses a short date beyond a week out", () => {
    expect(dayLabel(10, base)).toBe(
      offsetDate(10, base).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    )
  })
})
