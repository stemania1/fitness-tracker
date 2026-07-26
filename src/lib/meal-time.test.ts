import { describe, it, expect } from "vitest"
import { localTimeValue, withLocalTime } from "./meal-time"

describe("meal-time helpers", () => {
  it("round-trips a time through withLocalTime → localTimeValue", () => {
    const iso = new Date(2026, 6, 26, 9, 12).toISOString()
    expect(localTimeValue(iso)).toBe("09:12")
    const updated = withLocalTime(iso, "14:30")
    expect(localTimeValue(updated)).toBe("14:30")
  })

  it("keeps the calendar date when only the time changes", () => {
    const iso = new Date(2026, 6, 26, 21, 12).toISOString()
    const updated = withLocalTime(iso, "06:05")
    const d = new Date(updated)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(26)
    expect(localTimeValue(updated)).toBe("06:05")
  })

  it("zero-pads single-digit hours and minutes", () => {
    const iso = new Date(2026, 0, 1, 4, 5).toISOString()
    expect(localTimeValue(iso)).toBe("04:05")
  })

  it("returns the input unchanged for a malformed time", () => {
    const iso = new Date(2026, 6, 26, 9, 12).toISOString()
    expect(withLocalTime(iso, "")).toBe(iso)
    expect(withLocalTime(iso, "9am")).toBe(iso)
    expect(withLocalTime(iso, "25:00")).toBe(iso)
    expect(withLocalTime(iso, "10:75")).toBe(iso)
  })
})
