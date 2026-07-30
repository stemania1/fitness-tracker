import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { startOfWeek, currentWeekStreak, totalWeightLifted } from "./profile-stats"

/** Local ISO for a given Y/M/D at noon, so the test never straddles midnight. */
function day(y: number, m: number, d: number): { started_at: string } {
  return { started_at: new Date(y, m - 1, d, 12, 0, 0).toISOString() }
}

describe("startOfWeek", () => {
  it("snaps to the Monday of that week at midnight", () => {
    // Wed 15 Jul 2026 -> Mon 13 Jul
    const monday = startOfWeek(new Date(2026, 6, 15, 15, 30))
    expect(monday.getFullYear()).toBe(2026)
    expect(monday.getMonth()).toBe(6)
    expect(monday.getDate()).toBe(13)
    expect(monday.getHours()).toBe(0)
    expect(monday.getMinutes()).toBe(0)
  })

  it("treats Sunday as the end of the previous week, not the start", () => {
    // Sun 19 Jul 2026 -> Mon 13 Jul
    expect(startOfWeek(new Date(2026, 6, 19, 9)).getDate()).toBe(13)
  })

  it("is idempotent", () => {
    const once = startOfWeek(new Date(2026, 6, 15))
    expect(startOfWeek(once).getTime()).toBe(once.getTime())
  })
})

describe("currentWeekStreak", () => {
  it("is 0 with no workouts", () => {
    expect(currentWeekStreak([], new Date(2026, 6, 15))).toBe(0)
  })

  it("counts the current week", () => {
    const now = new Date(2026, 6, 15) // Wed 15 Jul
    expect(currentWeekStreak([day(2026, 7, 13)], now)).toBe(1)
  })

  it("counts consecutive weeks back", () => {
    const now = new Date(2026, 6, 15)
    const logs = [day(2026, 7, 14), day(2026, 7, 8), day(2026, 7, 1)]
    expect(currentWeekStreak(logs, now)).toBe(3)
  })

  it("stops at a missed week", () => {
    const now = new Date(2026, 6, 15)
    // This week and last week, then a gap, then an older week.
    const logs = [day(2026, 7, 14), day(2026, 7, 8), day(2026, 6, 24)]
    expect(currentWeekStreak(logs, now)).toBe(2)
  })

  // Monday morning before training shouldn't read as a broken streak.
  it("falls back to last week when this week has nothing yet", () => {
    const now = new Date(2026, 6, 20, 8) // Mon 20 Jul, 8am
    const logs = [day(2026, 7, 15), day(2026, 7, 8)]
    expect(currentWeekStreak(logs, now)).toBe(2)
  })

  it("is 0 when neither this week nor last week has a workout", () => {
    const now = new Date(2026, 6, 20)
    expect(currentWeekStreak([day(2026, 7, 1)], now)).toBe(0)
  })

  it("counts a week once however many workouts it holds", () => {
    const now = new Date(2026, 6, 15)
    const logs = [day(2026, 7, 13), day(2026, 7, 14), day(2026, 7, 15)]
    expect(currentWeekStreak(logs, now)).toBe(1)
  })
})

// Stepping back by a fixed 7×24h of milliseconds lands an hour off across a
// DST boundary (Mon 9 Mar 2026 -> Sun 8 Mar 23:00 in US Eastern), so the week
// never matches a bucketed workout week and the streak truncates. These only
// mean anything in a zone that observes DST — the suite otherwise runs in UTC.
describe("currentWeekStreak across daylight-saving boundaries", () => {
  const original = process.env.TZ

  beforeAll(() => {
    process.env.TZ = "America/New_York"
  })
  afterAll(() => {
    process.env.TZ = original
  })

  it("counts through the spring-forward transition", () => {
    // US DST 2026 starts Sun 8 Mar. Weeks of 9 Mar, 2 Mar, 23 Feb.
    const now = new Date(2026, 2, 11) // Wed 11 Mar
    const logs = [day(2026, 3, 10), day(2026, 3, 3), day(2026, 2, 24)]
    expect(currentWeekStreak(logs, now)).toBe(3)
  })

  it("counts through the fall-back transition", () => {
    // US DST 2026 ends Sun 1 Nov. Weeks of 2 Nov, 26 Oct, 19 Oct.
    const now = new Date(2026, 10, 4) // Wed 4 Nov
    const logs = [day(2026, 11, 3), day(2026, 10, 27), day(2026, 10, 20)]
    expect(currentWeekStreak(logs, now)).toBe(3)
  })
})

describe("totalWeightLifted", () => {
  it("sums weight times reps", () => {
    expect(
      totalWeightLifted([
        { weight: 100, reps: 10 },
        { weight: 50, reps: 8 },
      ])
    ).toBe(1400)
  })

  it("is 0 for no sets", () => {
    expect(totalWeightLifted([])).toBe(0)
  })

  it("counts a set with weight but no reps once", () => {
    expect(totalWeightLifted([{ weight: 135, reps: null }])).toBe(135)
  })

  it("ignores a set with no weight", () => {
    expect(totalWeightLifted([{ weight: null, reps: 12 }])).toBe(0)
  })
})
