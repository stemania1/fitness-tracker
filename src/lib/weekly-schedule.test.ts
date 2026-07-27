import { describe, it, expect } from "vitest"
import {
  buildWeeklySchedule,
  amSlotFor,
  type WeeklyScheduleInput,
} from "./weekly-schedule"

function base(overrides: Partial<WeeklyScheduleInput> = {}): WeeklyScheduleInput {
  return {
    workoutDays: 3,
    weekdayMinutes: 25,
    weekendMinutes: 60,
    wakeTime: "05:30",
    ...overrides,
  }
}

describe("buildWeeklySchedule", () => {
  it("always returns all 7 days, Monday first", () => {
    const s = buildWeeklySchedule(base())
    expect(s.days).toHaveLength(7)
    expect(s.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(s.days[0].dayName).toBe("Monday")
    expect(s.days[6].dayName).toBe("Sunday")
  })

  it("puts the longer sessions on the weekend and short ones on weekdays", () => {
    const s = buildWeeklySchedule(base({ workoutDays: 3 }))
    const long = s.days.filter((d) => d.kind === "long")
    const short = s.days.filter((d) => d.kind === "strength")
    // Weekend days carry the long work.
    expect(long.map((d) => d.day).sort()).toEqual([0, 6])
    expect(long.every((d) => d.minutes === 60)).toBe(true)
    // The remaining session is a short weekday one.
    expect(short).toHaveLength(1)
    expect([1, 2, 3, 4, 5]).toContain(short[0].day)
    expect(short[0].minutes).toBe(25)
  })

  it("spreads weekdays out rather than stacking consecutive days", () => {
    // 4 days → both weekend days + Tue/Thu (not Mon/Tue).
    const s = buildWeeklySchedule(base({ workoutDays: 4 }))
    const weekdays = s.days
      .filter((d) => d.kind === "strength")
      .map((d) => d.day)
      .sort()
    expect(weekdays).toEqual([2, 4]) // Tuesday, Thursday
  })

  it("counts sessions and total minutes", () => {
    const s = buildWeeklySchedule(base({ workoutDays: 3 }))
    expect(s.sessionCount).toBe(3)
    // 2 weekend × 60 + 1 weekday × 25
    expect(s.totalMinutes).toBe(145)
    expect(s.summary).toMatch(/3 sessions/)
    expect(s.summary).toMatch(/1 short weekday/)
    expect(s.summary).toMatch(/2 longer weekend/)
  })

  it("suggests a post-wake AM slot for weekday sessions", () => {
    const s = buildWeeklySchedule(base({ workoutDays: 4, wakeTime: "05:30" }))
    const weekday = s.days.find((d) => d.kind === "strength")!
    expect(weekday.suggestedTime).toBe("5:45 AM")
    // Weekend sessions aren't pinned to the commute-driven AM slot.
    const weekend = s.days.find((d) => d.kind === "long")!
    expect(weekend.suggestedTime).toBeUndefined()
  })

  it("omits the suggested time when no wake time is known", () => {
    const s = buildWeeklySchedule(base({ workoutDays: 4, wakeTime: null }))
    const weekday = s.days.find((d) => d.kind === "strength")!
    expect(weekday.suggestedTime).toBeUndefined()
  })

  it("handles a weekend-only week", () => {
    const s = buildWeeklySchedule(base({ workoutDays: 2 }))
    expect(s.sessionCount).toBe(2)
    expect(s.days.filter((d) => d.kind === "strength")).toHaveLength(0)
    expect(s.days.filter((d) => d.kind === "long")).toHaveLength(2)
  })

  it("handles zero workout days as all rest", () => {
    const s = buildWeeklySchedule(base({ workoutDays: 0 }))
    expect(s.sessionCount).toBe(0)
    expect(s.totalMinutes).toBe(0)
    expect(s.days.every((d) => d.kind === "rest")).toBe(true)
    expect(s.summary).toBe("No sessions scheduled")
  })

  it("clamps an over-long week to 7 days", () => {
    const s = buildWeeklySchedule(base({ workoutDays: 99 }))
    expect(s.sessionCount).toBe(7)
    expect(s.days.every((d) => d.kind !== "rest")).toBe(true)
  })

  it("enforces a minimum session length", () => {
    const s = buildWeeklySchedule(
      base({ workoutDays: 4, weekdayMinutes: 1, weekendMinutes: 2 })
    )
    expect(s.days.filter((d) => d.kind !== "rest").every((d) => d.minutes >= 10)).toBe(
      true
    )
  })
})

describe("amSlotFor", () => {
  it("returns a slot shortly after wake", () => {
    expect(amSlotFor("05:30")).toBe("5:45 AM")
    expect(amSlotFor("06:00")).toBe("6:15 AM")
  })

  it("returns undefined without a usable wake time", () => {
    expect(amSlotFor(null)).toBeUndefined()
    expect(amSlotFor("")).toBeUndefined()
    expect(amSlotFor("nonsense")).toBeUndefined()
  })
})
