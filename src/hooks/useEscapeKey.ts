"use client"

import { useEffect } from "react"

/**
 * Close an overlay on Escape. The shared Dialog primitive handles this
 * itself; the hand-rolled overlays (exercise picker, exercise drawer) each
 * need the same three lines, so they share them here.
 */
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onEscape])
}
