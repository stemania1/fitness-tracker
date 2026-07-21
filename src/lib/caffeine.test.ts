import { describe, it, expect } from "vitest"
import {
  caffeineOnBoardMg,
  caffeineStatus,
  lateCaffeineFlag,
  formatHour,
  CAFFEINE_HALF_LIFE_MIN,
  type CaffeineDose,
} from "./caffeine"

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
    expect(lateCaffeineFlag([{ mg: 95, minutesAgo: 30, hour: 12 }], 11).late).toBe(true)
    expect(lateCaffeineFlag([{ mg: 95, minutesAgo: 30, hour: 12 }], 13).late).toBe(false)
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
