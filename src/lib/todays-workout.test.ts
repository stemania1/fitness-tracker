import { describe, it, expect } from "vitest"
import { todaysWorkout, plannedSession } from "./todays-workout"

// Plan starts Monday 2026-07-06. Local noon to avoid TZ edges.
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12)

describe("todaysWorkout", () => {
  it("expands a Pull A day into named exercise items with sets/reps", () => {
    const w = todaysWorkout(d(2026, 7, 11)) // Saturday week 1 = Pull A
    expect(w.title).toMatch(/pull a/i)
    expect(w.type).toBe("strength")
    expect(w.isRest).toBe(false)
    // First preset exercise is the assisted pull-up.
    expect(w.items[0].label).toBe("Assisted Pull-Up")
    expect(w.items[0].detail).toMatch(/4 × 6-8/)
    // Every item has a resolved (non-id) label and a stable id.
    for (const item of w.items) {
      expect(item.label.length).toBeGreaterThan(0)
      // A resolved catalog name, not a raw id like "lat-pulldown-exercise"
      // (ids are all lowercase/digits/hyphens; names have spaces or capitals).
      expect(item.label).not.toMatch(/^[a-z0-9-]+$/)
      expect(item.id.length).toBeGreaterThan(0)
    }
  })

  it("expands a Pull B day from its preset", () => {
    const w = todaysWorkout(d(2026, 7, 9)) // Thursday week 1 = Pull B
    expect(w.title).toMatch(/pull b/i)
    expect(w.items[0].label).toBe("Assisted Pull-Up")
    expect(w.items.length).toBeGreaterThan(3)
  })

  it("uses the session detail bullets as items for a cardio day", () => {
    const w = todaysWorkout(d(2026, 7, 7)) // Tuesday = 4×4 intervals
    expect(w.type).toBe("cardio")
    expect(w.items.length).toBeGreaterThan(0)
    expect(w.items[0].label).toMatch(/warm-up/i)
    // Phase note surfaces for the interval day.
    expect(w.sessionNote).toMatch(/3 rounds/i)
  })

  it("marks a rest day with no items", () => {
    const w = todaysWorkout(d(2026, 7, 10)) // Friday week 1 = rest
    expect(w.isRest).toBe(true)
    expect(w.items).toEqual([])
  })

  it("flags a deload week and surfaces a test title on test weekends", () => {
    expect(todaysWorkout(d(2026, 8, 18)).isDeload).toBe(true) // week 7
    expect(todaysWorkout(d(2026, 7, 11)).testTitle).toMatch(/baseline/i)
  })

  it("still returns the weekly session after the plan ends (week null)", () => {
    const w = todaysWorkout(d(2026, 10, 6)) // after week 12
    expect(w.week).toBeNull()
    expect(w.type).toBe("cardio") // Tuesday rhythm persists
  })
})

describe("plannedSession", () => {
  it("pre-loads Pull A lifts plus the Zone 2 bike finisher", () => {
    const s = plannedSession(d(2026, 7, 11)) // Saturday = Pull A
    expect(s.isRest).toBe(false)
    expect(s.name).toMatch(/pull a/i)
    // First lift is the assisted pull-up with its rep target and rest.
    expect(s.exercises[0].exerciseId).toBe("assisted-pull-up")
    expect(s.exercises[0].reps).toBe("6-8")
    expect(s.exercises[0].sets).toBe(4)
    // Last entry is the Zone 2 cardio finisher on the bike.
    const last = s.exercises[s.exercises.length - 1]
    expect(last.exerciseId).toBe("stationary-bike-exercise")
    expect(last.reps).toMatch(/min/)
  })

  it("pre-loads Pull B lifts with no cardio finisher", () => {
    const s = plannedSession(d(2026, 7, 9)) // Thursday = Pull B
    expect(s.name).toMatch(/pull b/i)
    expect(s.exercises.length).toBe(5)
    expect(
      s.exercises.some((e) => e.exerciseId === "stationary-bike-exercise")
    ).toBe(false)
  })

  it("pre-loads one running entry for the 4×4 interval day", () => {
    const s = plannedSession(d(2026, 7, 7)) // Tuesday = 4×4 intervals
    expect(s.isRest).toBe(false)
    expect(s.exercises).toHaveLength(1)
    expect(s.exercises[0].exerciseId).toBe("treadmill-run")
    expect(s.exercises[0].reps).toMatch(/min/)
  })

  it("pre-loads one bike entry for the 30/30 interval day", () => {
    const s = plannedSession(d(2026, 7, 12)) // Sunday = 30/30 + Zone 2
    expect(s.exercises).toHaveLength(1)
    expect(s.exercises[0].exerciseId).toBe("stationary-bike-exercise")
  })

  it("returns no exercises on a rest day", () => {
    const s = plannedSession(d(2026, 7, 10)) // Friday = rest
    expect(s.isRest).toBe(true)
    expect(s.exercises).toEqual([])
  })

  it("maps every planned exercise to a real catalog id", async () => {
    const { exercises } = await import("@/data/exercises")
    const ids = new Set(exercises.map((e) => e.id))
    for (const day of [7, 9, 11, 12]) {
      for (const ex of plannedSession(d(2026, 7, day)).exercises) {
        expect(ids.has(ex.exerciseId)).toBe(true)
      }
    }
  })
})
