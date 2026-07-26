import { describe, it, expect } from "vitest"
import { swipeDirection } from "./swipe"

describe("swipeDirection", () => {
  it("detects a left swipe (finger moves left, dx negative)", () => {
    expect(swipeDirection(-80, 5)).toBe("left")
  })

  it("detects a right swipe (finger moves right, dx positive)", () => {
    expect(swipeDirection(80, -5)).toBe("right")
  })

  it("ignores movement under the threshold", () => {
    expect(swipeDirection(-30, 0)).toBeNull()
    expect(swipeDirection(30, 0)).toBeNull()
  })

  it("ignores a mostly-vertical drag (a scroll)", () => {
    expect(swipeDirection(-50, -120)).toBeNull()
    expect(swipeDirection(50, 120)).toBeNull()
  })

  it("respects a custom threshold", () => {
    expect(swipeDirection(-45, 0)).toBe("left")
    expect(swipeDirection(-45, 0, 60)).toBeNull()
  })
})
