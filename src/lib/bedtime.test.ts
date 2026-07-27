import { describe, it, expect } from "vitest"
import {
  parseClockTime,
  formatClockTime,
  subtractMinutes,
  buildBedtimePlan,
} from "./bedtime"

describe("parseClockTime", () => {
  it("parses valid HH:MM", () => {
    expect(parseClockTime("06:30")).toEqual({ hour: 6, minute: 30 })
    expect(parseClockTime("23:59")).toEqual({ hour: 23, minute: 59 })
    expect(parseClockTime("0:00")).toEqual({ hour: 0, minute: 0 })
  })

  it("rejects malformed or out-of-range input", () => {
    expect(parseClockTime("")).toBeNull()
    expect(parseClockTime("6:30am")).toBeNull()
    expect(parseClockTime("24:00")).toBeNull()
    expect(parseClockTime("06:60")).toBeNull()
  })
})

describe("formatClockTime", () => {
  it("formats AM/PM with 12-hour wraparound", () => {
    expect(formatClockTime({ hour: 6, minute: 30 })).toBe("6:30 AM")
    expect(formatClockTime({ hour: 0, minute: 0 })).toBe("12:00 AM")
    expect(formatClockTime({ hour: 12, minute: 0 })).toBe("12:00 PM")
    expect(formatClockTime({ hour: 22, minute: 5 })).toBe("10:05 PM")
  })
})

describe("subtractMinutes", () => {
  it("subtracts within the same day", () => {
    expect(subtractMinutes({ hour: 10, minute: 0 }, 30)).toEqual({
      hour: 9,
      minute: 30,
    })
  })

  it("wraps backward across midnight", () => {
    // 5:30 AM minus 7.5h (450 min) = 10:00 PM the previous day.
    expect(subtractMinutes({ hour: 5, minute: 30 }, 450)).toEqual({
      hour: 22,
      minute: 0,
    })
  })

  it("a negative amount adds time forward, wrapping past midnight", () => {
    expect(subtractMinutes({ hour: 23, minute: 0 }, -90)).toEqual({
      hour: 0,
      minute: 30,
    })
  })
})

describe("buildBedtimePlan", () => {
  it("computes bedtime, wind-down, and caffeine cutoff from wake time", () => {
    // Wake 5:30 AM, 7.5h goal → bedtime 10:00 PM the night before.
    const plan = buildBedtimePlan("05:30", 7.5)
    expect(plan).not.toBeNull()
    expect(plan!.bedtime).toEqual({ hour: 22, minute: 0 })
    // Wind-down is 30 min before bedtime.
    expect(plan!.windDownTime).toEqual({ hour: 21, minute: 30 })
    // Caffeine cutoff is 8h before bedtime.
    expect(plan!.caffeineCutoff).toEqual({ hour: 14, minute: 0 })
  })

  it("defaults the sleep goal when omitted or non-positive", () => {
    const withDefault = buildBedtimePlan("06:00")
    const explicit = buildBedtimePlan("06:00", 7.5)
    expect(withDefault).toEqual(explicit)
    expect(buildBedtimePlan("06:00", 0)!.sleepGoalHours).toBe(7.5)
    expect(buildBedtimePlan("06:00", -3)!.sleepGoalHours).toBe(7.5)
  })

  it("returns null for an unparseable wake time", () => {
    expect(buildBedtimePlan("not-a-time")).toBeNull()
  })

  it("handles a wake time that pushes bedtime to wrap past midnight", () => {
    // Wake 4:00 AM, 8h goal → bedtime 8:00 PM (no wrap needed here, sanity).
    const plan = buildBedtimePlan("04:00", 8)!
    expect(plan.bedtime).toEqual({ hour: 20, minute: 0 })
  })
})
