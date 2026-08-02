import { describe, it, expect } from "vitest"
import { visualViewportBox } from "./visual-viewport"

describe("visualViewportBox", () => {
  it("reports the visible box when the keyboard shrinks the viewport", () => {
    // iPhone-sized: 956pt screen, ~336pt keyboard.
    expect(visualViewportBox({ height: 620, offsetTop: 0 }, 956)).toEqual({
      top: 0,
      height: 620,
    })
  })

  it("returns null when nothing is covering the screen", () => {
    // Same as the layout viewport and unscrolled — no adjustment to make, so
    // callers keep their ordinary full-screen positioning.
    expect(visualViewportBox({ height: 956, offsetTop: 0 }, 956)).toBeNull()
  })

  it("tolerates sub-pixel rounding between the two viewports", () => {
    expect(visualViewportBox({ height: 955.6, offsetTop: 0 }, 956)).toBeNull()
  })

  it("carries the offset when the visual viewport is panned", () => {
    expect(visualViewportBox({ height: 620, offsetTop: 140 }, 956)).toEqual({
      top: 140,
      height: 620,
    })
  })

  it("reports an offset even at full height, since the box has moved", () => {
    expect(visualViewportBox({ height: 956, offsetTop: 40 }, 956)).toEqual({
      top: 40,
      height: 956,
    })
  })

  it("rounds to whole pixels", () => {
    expect(visualViewportBox({ height: 620.4, offsetTop: 12.6 }, 956)).toEqual({
      top: 13,
      height: 620,
    })
  })

  it("never reports a negative offset", () => {
    // iOS can report a small negative offsetTop during rubber-banding.
    expect(visualViewportBox({ height: 620, offsetTop: -8 }, 956)).toEqual({
      top: 0,
      height: 620,
    })
  })

  it("returns null where visualViewport is unsupported", () => {
    expect(visualViewportBox(null, 956)).toBeNull()
    expect(visualViewportBox(undefined, 956)).toBeNull()
  })

  it("returns null for a nonsense height rather than pinning zero", () => {
    // A collapsed box would hide the dialog entirely; better to fall back.
    expect(visualViewportBox({ height: 0, offsetTop: 0 }, 956)).toBeNull()
    expect(visualViewportBox({ height: NaN, offsetTop: 0 }, 956)).toBeNull()
  })
})
