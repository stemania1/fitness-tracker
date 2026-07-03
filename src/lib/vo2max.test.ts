import { describe, it, expect } from "vitest"
import { classifyVo2Max } from "./vo2max"

describe("classifyVo2Max", () => {
  it("rates a 51-year-old male in the 50-59 bracket, not against absolute cutoffs", () => {
    // 43 would be "average" under the legacy absolute cutoffs (50 / 35),
    // but it's excellent for a man in his 50s.
    expect(classifyVo2Max(43, 51, "male")).toBe("excellent")
    expect(classifyVo2Max(35, 51, "male")).toBe("average")
    expect(classifyVo2Max(28, 51, "male")).toBe("low")
  })

  it("uses female bands when sex is female", () => {
    expect(classifyVo2Max(35, 51, "female")).toBe("excellent")
    expect(classifyVo2Max(28, 51, "female")).toBe("average")
    expect(classifyVo2Max(23, 51, "female")).toBe("low")
  })

  it("holds young users to higher standards", () => {
    expect(classifyVo2Max(43, 25, "male")).toBe("average")
    expect(classifyVo2Max(52, 25, "male")).toBe("excellent")
    expect(classifyVo2Max(37, 25, "male")).toBe("low")
  })

  it("uses the midpoint of male/female bands for unknown or other sex", () => {
    // 50-59 midpoint: excellent (42+34)/2 = 38, low (29+24)/2 = 26.5
    expect(classifyVo2Max(38, 51, "other")).toBe("excellent")
    expect(classifyVo2Max(30, 51, null)).toBe("average")
    expect(classifyVo2Max(26, 51, undefined)).toBe("low")
  })

  it("falls back to absolute cutoffs (50 / 35) when age is unknown", () => {
    expect(classifyVo2Max(50, null, "male")).toBe("excellent")
    expect(classifyVo2Max(43, null, "male")).toBe("average")
    expect(classifyVo2Max(34, undefined, "male")).toBe("low")
  })

  it("uses the 60+ bracket for older users", () => {
    expect(classifyVo2Max(38, 70, "male")).toBe("excellent")
    expect(classifyVo2Max(25, 70, "male")).toBe("low")
  })

  it("boundary values are inclusive for excellent, exclusive for low", () => {
    expect(classifyVo2Max(42, 51, "male")).toBe("excellent")
    expect(classifyVo2Max(29, 51, "male")).toBe("average")
    expect(classifyVo2Max(28.9, 51, "male")).toBe("low")
  })
})
