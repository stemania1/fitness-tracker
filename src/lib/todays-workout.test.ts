import { describe, it, expect } from "vitest"
import { todaysWorkout, plannedSession } from "./todays-workout"

// Plan starts Monday 2026-07-06. Local noon to avoid TZ edges.
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12)

describe("todaysWorkout", () => {
  it("expands a Pull A day into named exercise items with sets/reps", () => {
    const w = todaysWorkout(d(2026, 8, 6)) // Thursday week 1 = Pull A
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
    const w = todaysWorkout(d(2026, 8, 4)) // Tuesday week 1 = Pull B
    expect(w.title).toMatch(/pull b/i)
    expect(w.items[0].label).toBe("Assisted Pull-Up")
    expect(w.items.length).toBeGreaterThan(3)
  })

  it("uses the session detail bullets as items for a cardio day", () => {
    const w = todaysWorkout(d(2026, 8, 8)) // Saturday = 4×4 intervals
    expect(w.type).toBe("cardio")
    expect(w.items.length).toBeGreaterThan(0)
    expect(w.items[0].label).toMatch(/warm-up/i)
    // Phase note surfaces for the interval day. August is week 5 (Build),
    // which prescribes 4 rounds — the count is phase-driven, not fixed.
    expect(w.sessionNote).toMatch(/4 rounds/i)
  })

  it("marks a rest day with no items", () => {
    const w = todaysWorkout(d(2026, 8, 7)) // Friday week 1 = rest
    expect(w.isRest).toBe(true)
    expect(w.items).toEqual([])
  })

  it("flags a deload week and surfaces a test title on test weekends", () => {
    expect(todaysWorkout(d(2026, 8, 18)).isDeload).toBe(true) // week 7
    expect(todaysWorkout(d(2026, 7, 11)).testTitle).toMatch(/baseline/i) // week 1
  })

  it("still returns the weekly session after the plan ends (week null)", () => {
    const w = todaysWorkout(d(2026, 10, 6)) // after week 12
    expect(w.week).toBeNull()
    expect(w.type).toBe("strength") // Tuesday rhythm persists (Pull B)
  })
})

describe("plannedSession", () => {
  it("pre-loads Pull A lifts, lifts only", () => {
    const s = plannedSession(d(2026, 8, 6)) // Thursday = Pull A
    expect(s.isRest).toBe(false)
    expect(s.name).toMatch(/pull a/i)
    // First lift is the assisted pull-up with its rep target and rest.
    expect(s.exercises[0].exerciseId).toBe("assisted-pull-up")
    expect(s.exercises[0].reps).toBe("6-8")
    expect(s.exercises[0].sets).toBe(4)
    // The Zone 2 finisher went away when Pull A moved to a 5:45 AM weekday
    // slot; Sunday's 30 min carries those aerobic minutes now.
    expect(
      s.exercises.some((e) => e.exerciseId === "stationary-bike-exercise")
    ).toBe(false)
  })

  it("pre-loads Pull B lifts with no cardio finisher", () => {
    const s = plannedSession(d(2026, 8, 4)) // Tuesday = Pull B
    expect(s.name).toMatch(/pull b/i)
    expect(s.exercises.length).toBe(5)
    expect(
      s.exercises.some((e) => e.exerciseId === "stationary-bike-exercise")
    ).toBe(false)
  })

  it("pre-loads one running entry for the 4×4 interval day", () => {
    const s = plannedSession(d(2026, 8, 8)) // Saturday = 4×4 intervals
    expect(s.isRest).toBe(false)
    expect(s.exercises).toHaveLength(1)
    expect(s.exercises[0].exerciseId).toBe("treadmill-run")
    expect(s.exercises[0].reps).toMatch(/min/)
  })

  it("carries the protocol into the cardio note, not just 'log time'", () => {
    // The screen you hold mid-session has to tell you what to run. These
    // bullets used to live only on the plan card, which is no help at the gym.
    const s = plannedSession(d(2026, 8, 8)) // Saturday = 4×4
    const notes = s.exercises[0].notes ?? ""
    expect(notes).toMatch(/4 min @ ~90-95% max HR \/ 3 min easy recovery/)
    expect(notes).toMatch(/10-min warm-up/)
    expect(notes).toMatch(/log total time and distance/i)
    // Multi-line so the logger can render it as lines, not a run-on sentence.
    expect(notes.split("\n").length).toBeGreaterThan(3)
  })

  it("leads the cardio note with the phase-adjusted round count", () => {
    // "4×4" in the title is a name, not this week's prescription — the round
    // count changes by phase, so it has to be the first thing you read.
    const notes = plannedSession(d(2026, 8, 8)).exercises[0].notes ?? ""
    expect(notes.split("\n")[0]).toMatch(/this phase/i)
    expect(notes.split("\n")[0]).toMatch(/rounds/i)
  })

  it("gives the 30/30 day its own protocol, not the 4×4 one", () => {
    const notes = plannedSession(d(2026, 8, 9)).exercises[0].notes ?? "" // Sunday
    expect(notes).toMatch(/30s hard \/ 30s easy/)
    expect(notes).not.toMatch(/90-95% max HR/)
  })

  it("pre-loads one bike entry for the 30/30 interval day", () => {
    const s = plannedSession(d(2026, 8, 9)) // Sunday = 30/30 + Zone 2
    expect(s.exercises).toHaveLength(1)
    expect(s.exercises[0].exerciseId).toBe("stationary-bike-exercise")
  })

  it("returns no exercises on a rest day", () => {
    const s = plannedSession(d(2026, 8, 7)) // Friday = rest
    expect(s.isRest).toBe(true)
    expect(s.exercises).toEqual([])
  })

  it("maps every planned exercise to a real catalog id", async () => {
    const { exercises } = await import("@/data/exercises")
    const ids = new Set(exercises.map((e) => e.id))
    for (const day of [4, 6, 8, 9]) {
      for (const ex of plannedSession(d(2026, 8, day)).exercises) {
        expect(ids.has(ex.exerciseId)).toBe(true)
      }
    }
  })
})
