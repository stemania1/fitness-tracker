import { describe, it, expect } from "vitest"
import { vo2MaxPercentile, percentileLabel } from "./vo2max-percentile"

describe("vo2MaxPercentile (FRIEND treadmill, men 50-59)", () => {
  it("returns the exact percentile at a published breakpoint", () => {
    expect(vo2MaxPercentile(32.6, 51, "male")).toBe(50)
    expect(vo2MaxPercentile(45.6, 55, "male")).toBe(90)
    expect(vo2MaxPercentile(27.1, 50, "male")).toBe(25)
  })

  it("interpolates linearly between breakpoints", () => {
    // Midway between 50th (32.6) and 75th (39.7) → ~36.15 → ~62nd pct.
    expect(vo2MaxPercentile(36.15, 51, "male")).toBe(62)
  })

  it("clamps below and above the published range", () => {
    expect(vo2MaxPercentile(10, 51, "male")).toBe(5)
    expect(vo2MaxPercentile(80, 51, "male")).toBe(95)
  })

  it("returns null for brackets without verified data", () => {
    expect(vo2MaxPercentile(35, 51, "female")).toBeNull()
    expect(vo2MaxPercentile(35, 30, "male")).toBeNull()
    expect(vo2MaxPercentile(35, 51, "other")).toBeNull()
    expect(vo2MaxPercentile(35, null, "male")).toBeNull()
  })

  it("returns null for non-finite input", () => {
    expect(vo2MaxPercentile(NaN, 51, "male")).toBeNull()
  })
})

describe("percentileLabel", () => {
  it("frames high percentiles as top-X%", () => {
    expect(percentileLabel(90)).toMatch(/top 10%/)
    expect(percentileLabel(63)).toMatch(/top 37%/)
  })

  it("frames the median and low percentiles", () => {
    expect(percentileLabel(50)).toMatch(/top 50%/)
    expect(percentileLabel(25)).toMatch(/bottom 25%/)
  })

  it("handles the ceiling", () => {
    expect(percentileLabel(100)).toMatch(/top of your age group/)
  })
})
