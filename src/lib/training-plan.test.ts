import { describe, it, expect } from "vitest"
import {
  planWeekNumber,
  sessionForDate,
  phaseForWeek,
  todayPlan,
} from "./training-plan"

// Plan starts Monday 2026-07-06 (local). Construct dates as local times.
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12)

describe("planWeekNumber", () => {
  it("returns null before the plan starts", () => {
    expect(planWeekNumber(d(2026, 7, 5))).toBeNull()
  })

  it("returns 1 for the first Monday and the following Sunday", () => {
    expect(planWeekNumber(d(2026, 7, 6))).toBe(1)
    expect(planWeekNumber(d(2026, 7, 12))).toBe(1)
  })

  it("rolls to week 2 on the second Monday", () => {
    expect(planWeekNumber(d(2026, 7, 13))).toBe(2)
  })

  it("covers week 12 and returns null after the plan ends", () => {
    // Week 12: Sep 21-27, 2026.
    expect(planWeekNumber(d(2026, 9, 21))).toBe(12)
    expect(planWeekNumber(d(2026, 9, 27))).toBe(12)
    expect(planWeekNumber(d(2026, 9, 28))).toBeNull()
  })
})

describe("sessionForDate", () => {
  it("prescribes the AM-lane weekday sessions", () => {
    expect(sessionForDate(d(2026, 7, 7)).key).toBe("intervals-4x4") // Tue
    expect(sessionForDate(d(2026, 7, 9)).key).toBe("pull-b") // Thu
    expect(sessionForDate(d(2026, 7, 10)).key).toBe("rest") // Fri
  })

  it("prescribes the weekend sessions", () => {
    expect(sessionForDate(d(2026, 7, 11)).key).toBe("pull-a") // Sat
    expect(sessionForDate(d(2026, 7, 12)).key).toBe("intervals-3030") // Sun
  })
})

describe("phaseForWeek", () => {
  it("maps weeks to phases", () => {
    expect(phaseForWeek(1)?.label).toBe("Base")
    expect(phaseForWeek(4)?.label).toBe("Build")
    expect(phaseForWeek(7)?.label).toBe("Deload")
    expect(phaseForWeek(12)?.label).toBe("Peak")
  })

  it("returns null outside the plan", () => {
    expect(phaseForWeek(null)).toBeNull()
    expect(phaseForWeek(13)).toBeNull()
  })
})

describe("todayPlan", () => {
  it("flags the deload week", () => {
    // Week 7: Aug 17-23, 2026.
    const plan = todayPlan(d(2026, 8, 18)) // Tuesday of week 7
    expect(plan.week).toBe(7)
    expect(plan.isDeload).toBe(true)
    expect(plan.sessionNote).toMatch(/2 rounds/i)
  })

  it("surfaces the test title during test weeks", () => {
    expect(todayPlan(d(2026, 7, 11)).testTitle).toMatch(/baseline/i)
    expect(todayPlan(d(2026, 8, 15)).testTitle).toMatch(/week 6/i)
    expect(todayPlan(d(2026, 9, 26)).testTitle).toMatch(/final/i)
    expect(todayPlan(d(2026, 7, 20)).testTitle).toBeNull()
  })

  it("gives phase-adjusted notes per session type", () => {
    // Week 1 Tuesday: 4x4 day in Base phase.
    expect(todayPlan(d(2026, 7, 7)).sessionNote).toMatch(/3 rounds/)
    // Week 3 Sunday (Jul 26): 30/30 day in Build phase... week of Jul 20 = week 3.
    expect(todayPlan(d(2026, 7, 26)).sessionNote).toMatch(/3 sets of 10/)
    // Week 2 Saturday: strength note.
    expect(todayPlan(d(2026, 7, 18)).sessionNote).toMatch(/reps in the tank/i)
    // Rest days carry no phase note.
    expect(todayPlan(d(2026, 7, 10)).sessionNote).toBeNull()
  })

  it("still returns the weekly rhythm with null week after the plan ends", () => {
    const plan = todayPlan(d(2026, 10, 6)) // Tuesday after week 12
    expect(plan.week).toBeNull()
    expect(plan.session.key).toBe("intervals-4x4")
    expect(plan.phase).toBeNull()
    expect(plan.sessionNote).toBeNull()
  })
})
