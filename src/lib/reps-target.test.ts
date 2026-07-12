import { describe, it, expect } from "vitest"
import { isTimedTarget, repsTargetLabel } from "./reps-target"

describe("isTimedTarget", () => {
  it("detects second-based holds", () => {
    expect(isTimedTarget("20-30 sec")).toBe(true)
    expect(isTimedTarget("3×30s hold")).toBe(false) // "30s" isn't a sec word
    expect(isTimedTarget("30 secs")).toBe(true)
  })

  it("is false for rep ranges, minutes, and missing targets", () => {
    expect(isTimedTarget("6-8")).toBe(false)
    expect(isTimedTarget("15-20 min")).toBe(false)
    expect(isTimedTarget(null)).toBe(false)
    expect(isTimedTarget(undefined)).toBe(false)
  })
})

describe("repsTargetLabel", () => {
  it("appends 'reps' to bare rep ranges", () => {
    expect(repsTargetLabel("6-8")).toBe("6-8 reps")
    expect(repsTargetLabel("12")).toBe("12 reps")
  })

  it("passes through targets that already carry a unit", () => {
    expect(repsTargetLabel("20-30 sec")).toBe("20-30 sec")
    expect(repsTargetLabel("15-20 min")).toBe("15-20 min")
  })
})
