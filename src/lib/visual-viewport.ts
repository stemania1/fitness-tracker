"use client"

import { useEffect, useState } from "react"

/**
 * The region of the screen the user can actually see right now.
 *
 * `position: fixed` anchors to the LAYOUT viewport, which does not shrink when
 * the software keyboard opens — iOS instead shrinks the VISUAL viewport and
 * leaves the layout one alone. A fixed, centred dialog therefore stays centred
 * in the full screen while the keyboard covers its lower half, which is how
 * the meal dialog's text input ended up behind the keyboard with no way to
 * scroll to it.
 *
 * The document could previously be panned, so iOS would scroll the focused
 * input into view and paper over this. Pinning the body to stop the app shell
 * sliding up removed that escape hatch, so overlays have to track the visible
 * region themselves.
 */
export interface ViewportBox {
  /** Offset from the top of the layout viewport, in CSS pixels. */
  top: number
  /** Height of the visible region, in CSS pixels. */
  height: number
}

/** Just the parts of `window.visualViewport` this needs, so it can be faked. */
export interface VisualViewportLike {
  height: number
  offsetTop: number
}

/**
 * Normalise a visual viewport into a box, or null when there is nothing to
 * report — no `visualViewport` support, or a viewport that matches the layout
 * one anyway. Null means "no adjustment needed", letting callers keep their
 * ordinary full-screen positioning rather than pinning bogus numbers.
 */
export function visualViewportBox(
  vv: VisualViewportLike | null | undefined,
  layoutHeight: number
): ViewportBox | null {
  if (!vv || !Number.isFinite(vv.height) || vv.height <= 0) return null
  const height = Math.round(vv.height)
  const top = Math.max(0, Math.round(vv.offsetTop))
  // Within a pixel of the full height and unscrolled: nothing is covering the
  // screen, so leave positioning alone.
  if (top === 0 && Math.abs(height - Math.round(layoutHeight)) <= 1) return null
  return { top, height }
}

/**
 * Track the visible region while `active`, or null when no adjustment applies.
 *
 * Subscribes to both `resize` and `scroll`: the keyboard opening fires resize,
 * while panning a zoomed page fires scroll and moves `offsetTop`.
 */
export function useVisualViewportBox(active: boolean): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null)

  useEffect(() => {
    if (!active) {
      setBox(null)
      return
    }
    const vv = typeof window === "undefined" ? null : window.visualViewport
    const read = () =>
      setBox(visualViewportBox(vv, window.innerHeight))

    read()
    if (!vv) return
    vv.addEventListener("resize", read)
    vv.addEventListener("scroll", read)
    return () => {
      vv.removeEventListener("resize", read)
      vv.removeEventListener("scroll", read)
    }
  }, [active])

  return box
}
