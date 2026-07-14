import { describe, it, expect } from "vitest"
import { classifyMealGl, classifyDailyGl } from "./glycemic-load"

describe("classifyMealGl", () => {
  it("uses the conventional per-meal thresholds", () => {
    expect(classifyMealGl(0)).toBe("low")
    expect(classifyMealGl(10)).toBe("low")
    expect(classifyMealGl(11)).toBe("medium")
    expect(classifyMealGl(19)).toBe("medium")
    expect(classifyMealGl(20)).toBe("high")
    expect(classifyMealGl(55)).toBe("high")
  })

  it("treats junk input as low", () => {
    expect(classifyMealGl(NaN)).toBe("low")
    expect(classifyMealGl(-4)).toBe("low")
  })
})

describe("classifyDailyGl", () => {
  it("uses the conventional daily thresholds", () => {
    expect(classifyDailyGl(79)).toBe("low")
    expect(classifyDailyGl(80)).toBe("medium")
    expect(classifyDailyGl(120)).toBe("medium")
    expect(classifyDailyGl(121)).toBe("high")
  })
})
