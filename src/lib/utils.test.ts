import { describe, it, expect } from "vitest"
import { cn, formatWeight, calculateOneRepMax, formatDuration } from "./utils"

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes via clsx syntax", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("resolves Tailwind conflicts by keeping the last value", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("resolves conflicting Tailwind color utilities", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("handles undefined and null inputs", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end")
  })

  it("handles empty string inputs", () => {
    expect(cn("", "foo", "")).toBe("foo")
  })

  it("merges complex Tailwind classes correctly", () => {
    const result = cn(
      "rounded-md bg-white p-4",
      "bg-black text-white"
    )
    expect(result).toContain("bg-black")
    expect(result).not.toContain("bg-white")
    expect(result).toContain("rounded-md")
    expect(result).toContain("p-4")
    expect(result).toContain("text-white")
  })
})

describe("formatWeight", () => {
  it("formats weight with lbs suffix", () => {
    expect(formatWeight(185)).toBe("185 lbs")
  })

  it("handles zero", () => {
    expect(formatWeight(0)).toBe("0 lbs")
  })
})

describe("calculateOneRepMax", () => {
  it("returns the weight itself for 1 rep", () => {
    expect(calculateOneRepMax(225, 1)).toBe(225)
  })

  it("estimates 1RM for multiple reps using Epley formula variant", () => {
    // formula: weight * (1 + reps/30)
    // 200 * (1 + 5/30) = 200 * 1.1667 = 233.33 -> 233
    expect(calculateOneRepMax(200, 5)).toBe(233)
  })

  it("increases with more reps at same weight", () => {
    const low = calculateOneRepMax(100, 3)
    const high = calculateOneRepMax(100, 10)
    expect(high).toBeGreaterThan(low)
  })
})

describe("formatDuration", () => {
  it("formats minutes-only durations", () => {
    expect(formatDuration(45)).toBe("45m")
  })

  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m")
  })

  it("formats exact hours", () => {
    expect(formatDuration(120)).toBe("2h 0m")
  })

  it("formats zero minutes", () => {
    expect(formatDuration(0)).toBe("0m")
  })
})
