import { describe, it, expect } from "vitest"
import { getWeekLabel, calcWeeklyStreak, startOfWeekISO } from "./weekly-progress"

describe("getWeekLabel", () => {
  it("labels early-January dates as an early week", () => {
    expect(getWeekLabel("2026-01-05T12:00:00")).toMatch(/^W[12]$/)
  })

  it("gives later dates a higher week number than earlier ones", () => {
    const early = parseInt(getWeekLabel("2026-01-05T12:00:00").slice(1), 10)
    const late = parseInt(getWeekLabel("2026-06-15T12:00:00").slice(1), 10)
    expect(late).toBeGreaterThan(early)
  })
})

describe("calcWeeklyStreak", () => {
  it("returns 0 with no logs or a non-positive target", () => {
    expect(calcWeeklyStreak([], 3)).toBe(0)
    expect(
      calcWeeklyStreak([{ started_at: "2026-01-05T10:00:00" }], 0)
    ).toBe(0)
  })

  it("counts a single week that hits the target", () => {
    const logs = [
      { started_at: "2026-01-05T10:00:00" },
      { started_at: "2026-01-06T10:00:00" },
      { started_at: "2026-01-07T10:00:00" },
    ]
    expect(calcWeeklyStreak(logs, 2)).toBe(1)
  })

  it("does not count a week below target", () => {
    const logs = [{ started_at: "2026-01-05T10:00:00" }]
    expect(calcWeeklyStreak(logs, 3)).toBe(0)
  })

  it("stops at the first recent week that misses the target", () => {
    // Two logs in an earlier week, one in the most recent week; target 2.
    const logs = [
      { started_at: "2026-01-05T10:00:00" }, // week A
      { started_at: "2026-01-06T10:00:00" }, // week A
      { started_at: "2026-01-12T10:00:00" }, // week B (most recent) — only 1
    ]
    expect(calcWeeklyStreak(logs, 2)).toBe(0)
  })
})

describe("startOfWeekISO", () => {
  it("returns the local Monday at midnight for a mid-week date", () => {
    // 2026-01-07 is a Wednesday.
    const iso = startOfWeekISO(new Date("2026-01-07T15:30:00"))
    const d = new Date(iso)
    expect(d.getDay()).toBe(1) // Monday
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it("treats Sunday as the end of the prior week (Monday-start)", () => {
    // 2026-01-11 is a Sunday; its week should start Monday 2026-01-05.
    const iso = startOfWeekISO(new Date("2026-01-11T09:00:00"))
    const d = new Date(iso)
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(5)
  })
})
