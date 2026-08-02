import { describe, it, expect } from "vitest"
import {
  caffeineOnBoardMg,
  caffeineStatus,
  lateCaffeineFlag,
  formatHour,
  CAFFEINE_HALF_LIFE_MIN,
  CAFFEINE_PRESETS,
  type CaffeineDose,
} from "./caffeine"
import { buildBedtimePlan } from "./bedtime"

describe("CAFFEINE_PRESETS", () => {
  const mg = (label: string) =>
    CAFFEINE_PRESETS.find((p) => p.label === label)?.mg

  it("keeps Thermos at exactly two coffees", () => {
    // Derived rather than hardcoded, so revising the Coffee estimate can't
    // silently leave the Thermos preset describing something else.
    expect(mg("Thermos")).toBe(mg("Coffee")! * 2)
  })

  it("has no duplicate labels", () => {
    const labels = CAFFEINE_PRESETS.map((p) => p.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it("puts the most-used drink first, since the dialog opens on it", () => {
    expect(CAFFEINE_PRESETS[0].label).toBe("Thermos")
  })
})

describe("caffeineOnBoardMg", () => {
  it("returns the full dose at time zero", () => {
    expect(caffeineOnBoardMg([{ mg: 100, minutesAgo: 0, hour: 8 }])).toBeCloseTo(100)
  })

  it("halves the dose after one half-life", () => {
    const doses: CaffeineDose[] = [{ mg: 100, minutesAgo: CAFFEINE_HALF_LIFE_MIN, hour: 8 }]
    expect(caffeineOnBoardMg(doses)).toBeCloseTo(50, 1)
  })

  it("sums multiple doses", () => {
    const doses: CaffeineDose[] = [
      { mg: 100, minutesAgo: 0, hour: 12 },
      { mg: 100, minutesAgo: CAFFEINE_HALF_LIFE_MIN, hour: 8 },
    ]
    expect(caffeineOnBoardMg(doses)).toBeCloseTo(150, 0)
  })

  it("ignores future doses", () => {
    expect(caffeineOnBoardMg([{ mg: 100, minutesAgo: -30, hour: 9 }])).toBe(0)
  })
})

describe("caffeineStatus", () => {
  it("reports none when nothing meaningful was consumed", () => {
    expect(caffeineStatus([]).level).toBe("none")
    expect(caffeineStatus([{ mg: 20, minutesAgo: 0, hour: 8 }]).level).toBe("none")
  })

  it("reports active while a real dose is on board", () => {
    const s = caffeineStatus([{ mg: 95, minutesAgo: 30, hour: 9 }])
    expect(s.level).toBe("active")
    expect(s.onBoardMg).toBeGreaterThan(50)
    expect(s.totalTodayMg).toBe(95)
  })

  it("reports fading once a real dose has mostly cleared", () => {
    // 120mg taken ~3 half-lives ago → ~15mg left: past the peak, into the crash.
    const s = caffeineStatus([
      { mg: 120, minutesAgo: CAFFEINE_HALF_LIFE_MIN * 3, hour: 8 },
    ])
    expect(s.level).toBe("fading")
    expect(s.onBoardMg).toBeGreaterThanOrEqual(10)
    expect(s.onBoardMg).toBeLessThan(50)
  })

  it("returns to none once caffeine is essentially gone", () => {
    // 100mg taken ~5 half-lives ago → ~3mg left.
    const s = caffeineStatus([
      { mg: 100, minutesAgo: CAFFEINE_HALF_LIFE_MIN * 5, hour: 7 },
    ])
    expect(s.level).toBe("none")
  })
})

describe("lateCaffeineFlag", () => {
  it("does not flag caffeine taken before the cutoff", () => {
    const f = lateCaffeineFlag([{ mg: 95, minutesAgo: 60, hour: 9 }])
    expect(f.late).toBe(false)
    expect(f.latestHour).toBeNull()
  })

  it("flags caffeine at or after the 2pm default cutoff", () => {
    const f = lateCaffeineFlag([{ mg: 95, minutesAgo: 30, hour: 15 }])
    expect(f.late).toBe(true)
    expect(f.latestHour).toBe(15)
    expect(f.message).toMatch(/deep sleep/i)
  })

  it("reports the latest offending dose when several are late", () => {
    const f = lateCaffeineFlag([
      { mg: 95, minutesAgo: 200, hour: 14 },
      { mg: 65, minutesAgo: 40, hour: 17 },
    ])
    expect(f.latestHour).toBe(17)
  })

  it("respects a custom cutoff", () => {
    const noon: CaffeineDose[] = [{ mg: 95, minutesAgo: 30, hour: 12 }]
    expect(lateCaffeineFlag(noon, { hour: 11, minute: 0 }).late).toBe(true)
    expect(lateCaffeineFlag(noon, { hour: 13, minute: 0 }).late).toBe(false)
  })

  // An early riser's cutoff lands off the hour (6:30am wake, 7.5h goal →
  // 11pm bedtime → 3pm cutoff; a 6:45am wake puts it at 3:15pm). Comparing
  // whole hours would flag a drink taken before the cutoff.
  it("compares minutes, not just the hour, against an off-the-hour cutoff", () => {
    const cutoff = { hour: 15, minute: 15 }
    expect(
      lateCaffeineFlag([{ mg: 95, minutesAgo: 30, hour: 15, minute: 5 }], cutoff).late
    ).toBe(false)
    expect(
      lateCaffeineFlag([{ mg: 95, minutesAgo: 30, hour: 15, minute: 20 }], cutoff).late
    ).toBe(true)
  })

  it("treats a dose with no minute as being on the hour", () => {
    const cutoff = { hour: 15, minute: 30 }
    expect(lateCaffeineFlag([{ mg: 95, minutesAgo: 30, hour: 15 }], cutoff).late).toBe(
      false
    )
    expect(lateCaffeineFlag([{ mg: 95, minutesAgo: 30, hour: 16 }], cutoff).late).toBe(
      true
    )
  })

  it("picks the latest dose by clock time within the same hour", () => {
    const f = lateCaffeineFlag([
      { mg: 95, minutesAgo: 60, hour: 16, minute: 50 },
      { mg: 65, minutesAgo: 90, hour: 16, minute: 10 },
    ])
    expect(f.message).toContain("4:50pm")
  })

  it("names the cutoff it actually applied", () => {
    const f = lateCaffeineFlag(
      [{ mg: 95, minutesAgo: 30, hour: 16 }],
      { hour: 13, minute: 30 }
    )
    expect(f.message).toContain("after 1:30pm")
  })

  it("uses the bedtime-derived cutoff for an early riser", () => {
    // Up at 5am on a 7.5h goal → 9:30pm bedtime → 1:30pm cutoff. A 1:45pm
    // coffee passes the generic 2pm default and fails on this schedule.
    const plan = buildBedtimePlan("05:00", 7.5)
    const quarterToTwo: CaffeineDose[] = [
      { mg: 95, minutesAgo: 30, hour: 13, minute: 45 },
    ]
    expect(plan?.caffeineCutoff).toEqual({ hour: 13, minute: 30 })
    expect(lateCaffeineFlag(quarterToTwo).late).toBe(false)
    expect(lateCaffeineFlag(quarterToTwo, plan?.caffeineCutoff).late).toBe(true)
  })
})

describe("formatHour", () => {
  it("formats hours as friendly clock times", () => {
    expect(formatHour(0)).toBe("12am")
    expect(formatHour(9)).toBe("9am")
    expect(formatHour(12)).toBe("12pm")
    expect(formatHour(14)).toBe("2pm")
    expect(formatHour(23)).toBe("11pm")
  })
})
