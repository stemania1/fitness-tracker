import { describe, it, expect } from "vitest"
import { buildWeeklyDigest, type DigestInput } from "./weekly-digest"

function base(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    workoutsThisWeek: 3,
    workoutsLastWeek: 3,
    tdee: 2500,
    weightTrendLbsPerWeek: -1,
    targetRateLbsPerWeek: -1,
    avgIntake: 2000,
    targetIntake: 2000,
    avgEnergyThisWeek: 4,
    avgEnergyLastWeek: 4,
    avgSleepHours: 7.5,
    sleepDeltaHours: 0,
    topEnergyInsight: null,
    ...overrides,
  }
}

describe("buildWeeklyDigest — sections", () => {
  it("marks a good week across the board", () => {
    const d = buildWeeklyDigest(base())
    expect(d.sections.map((s) => s.tone)).toEqual(["good", "good", "good"])
    expect(d.sections[0].headline).toMatch(/3 workouts/)
    expect(d.sections[1].headline).toMatch(/down 1 lb\/wk/)
    expect(d.sections[2].headline).toMatch(/Energy 4\/5/)
  })

  it("warns when no workouts and weight moving the wrong way", () => {
    const d = buildWeeklyDigest(
      base({ workoutsThisWeek: 0, weightTrendLbsPerWeek: 1, targetRateLbsPerWeek: -1 })
    )
    expect(d.sections[0].tone).toBe("warn")
    expect(d.sections[1].tone).toBe("warn")
  })

  it("shows a learning state for weight without a TDEE", () => {
    const d = buildWeeklyDigest(base({ tdee: null, weightTrendLbsPerWeek: null }))
    expect(d.sections[1].headline).toMatch(/Learning your maintenance/)
    expect(d.sections[1].tone).toBe("neutral")
  })

  it("treats holding at goal as good", () => {
    const d = buildWeeklyDigest(
      base({ weightTrendLbsPerWeek: 0, targetRateLbsPerWeek: 0 })
    )
    expect(d.sections[1].headline).toMatch(/holding steady/)
    expect(d.sections[1].tone).toBe("good")
  })
})

describe("buildWeeklyDigest — actions", () => {
  it("nudges to eat toward the target when well off", () => {
    const d = buildWeeklyDigest(base({ avgIntake: 2600, targetIntake: 2000 }))
    expect(d.actions[0].text).toMatch(/Trim ~600\/day/)
  })

  it("nudges to add calories when well under", () => {
    const d = buildWeeklyDigest(base({ avgIntake: 1500, targetIntake: 2000 }))
    expect(d.actions.some((a) => /Add ~500\/day/.test(a.text))).toBe(true)
  })

  it("prioritizes zero-workouts over other nudges and caps at two", () => {
    const d = buildWeeklyDigest(
      base({
        workoutsThisWeek: 0,
        avgIntake: 2600,
        targetIntake: 2000,
        avgSleepHours: 6,
      })
    )
    expect(d.actions).toHaveLength(2)
    expect(d.actions[0].text).toMatch(/No workouts/)
  })

  it("flags low sleep as the biggest lever", () => {
    const d = buildWeeklyDigest(base({ avgSleepHours: 6.2 }))
    expect(d.actions.some((a) => /biggest energy lever/.test(a.text))).toBe(true)
  })

  it("surfaces the top energy insight when nothing more urgent", () => {
    const d = buildWeeklyDigest(
      base({ topEnergyInsight: "Energy runs ~15% higher on days you train." })
    )
    expect(d.actions.some((a) => /15% higher/.test(a.text))).toBe(true)
  })

  it("falls back to an all-clear message", () => {
    const d = buildWeeklyDigest(base())
    expect(d.actions).toHaveLength(1)
    expect(d.actions[0].text).toMatch(/on track/)
  })
})
