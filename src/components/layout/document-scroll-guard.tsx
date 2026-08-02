"use client"

import { useEffect } from "react"

/**
 * Snaps the document back to the top if anything ever scrolls it.
 *
 * The CSS takes the body out of flow so there is nothing left to pan, and that
 * should be the whole fix. This is here because the same bug has now been
 * "fixed" four times — overflow-x clip, an unconstrained root, the nav moved
 * out of `position: fixed`, the height chain — and each attempt looked
 * sufficient in a desktop browser and failed on the device.
 *
 * The cost of being wrong is not cosmetic: a scrolled document takes the
 * TopBar off screen, and the TopBar holds the only link to Profile. The user
 * loses the settings page, the diagnostics, and the viewport readout that
 * would explain what went wrong — the instrument disappears exactly when it
 * is needed. A few lines that make that unreachable state self-correcting are
 * worth more than the elegance of relying on the stylesheet alone.
 *
 * Correct by construction rather than by heuristic: the authenticated shell is
 * exactly one viewport tall with <main> as its only scroller, so a non-zero
 * document scroll is never a state the user asked for. Mounted only inside
 * that shell — ordinary pages scroll normally.
 */
export function DocumentScrollGuard() {
  useEffect(() => {
    const reset = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
    }

    // Catch a document that was already displaced before this mounted —
    // a client-side navigation into the shell, or a restored scroll position.
    reset()

    window.addEventListener("scroll", reset, { passive: true })
    // Rotating or opening the keyboard resizes the viewport, which is when iOS
    // is most likely to leave the document displaced.
    window.addEventListener("orientationchange", reset)
    window.addEventListener("resize", reset)
    return () => {
      window.removeEventListener("scroll", reset)
      window.removeEventListener("orientationchange", reset)
      window.removeEventListener("resize", reset)
    }
  }, [])

  return null
}
