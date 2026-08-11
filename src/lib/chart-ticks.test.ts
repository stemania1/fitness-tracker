import { describe, expect, it } from "vitest"
import { formatHourTick, hourlyTicks } from "./chart-ticks"

// Local-time timestamp builder so expectations hold in any test timezone.
const at = (hour: number, minute = 0) =>
  new Date(2026, 7, 11, hour, minute).getTime()

describe("hourlyTicks", () => {
  it("returns clock-hour ticks for an overnight heart-rate range", () => {
    // 12:01 AM – 5:09 AM, like an Oura sleep-time HR series
    const ticks = hourlyTicks(at(0, 1), at(5, 9))
    expect(ticks).toEqual([at(1), at(2), at(3), at(4), at(5)])
  })

  it("includes the start when it falls exactly on an hour boundary", () => {
    const ticks = hourlyTicks(at(0), at(4))
    expect(ticks).toEqual([at(0), at(1), at(2), at(3), at(4)])
  })

  it("spaces every tick evenly", () => {
    const ticks = hourlyTicks(at(6, 17), at(21, 48))
    expect(ticks.length).toBeGreaterThan(1)
    const gaps = new Set<number>()
    for (let i = 1; i < ticks.length; i++) gaps.add(ticks[i] - ticks[i - 1])
    expect(gaps.size).toBe(1)
  })

  it("keeps all ticks inside the data range", () => {
    const min = at(0, 1)
    const max = at(5, 9)
    for (const t of hourlyTicks(min, max)) {
      expect(t).toBeGreaterThanOrEqual(min)
      expect(t).toBeLessThanOrEqual(max)
    }
  })

  it("widens the step and aligns to step multiples for long ranges", () => {
    // Full day: 1-hour steps would need 24 ticks, so a larger step is used
    const ticks = hourlyTicks(at(0), at(23, 59))
    expect(ticks.length).toBeLessThanOrEqual(7)
    const stepHours = (ticks[1] - ticks[0]) / 3_600_000
    expect(stepHours).toBeGreaterThan(1)
    for (const t of ticks) {
      expect(new Date(t).getHours() % stepHours).toBe(0)
      expect(new Date(t).getMinutes()).toBe(0)
    }
  })

  it("returns no ticks for empty, inverted, or invalid ranges", () => {
    expect(hourlyTicks(at(5), at(5))).toEqual([])
    expect(hourlyTicks(at(5), at(4))).toEqual([])
    expect(hourlyTicks(NaN, at(4))).toEqual([])
    expect(hourlyTicks(at(4), Infinity)).toEqual([])
  })

  it("returns no ticks when the range contains no hour boundary", () => {
    expect(hourlyTicks(at(3, 10), at(3, 50))).toEqual([])
  })
})

describe("formatHourTick", () => {
  it("drops the minutes for hour-aligned ticks", () => {
    expect(formatHourTick(at(1))).toBe("1 AM")
    expect(formatHourTick(at(0))).toBe("12 AM")
    expect(formatHourTick(at(17))).toBe("5 PM")
  })

  it("keeps the minutes for off-hour timestamps", () => {
    expect(formatHourTick(at(1, 30))).toBe("1:30 AM")
  })
})
