"use client"

import { useRef } from "react"
import { swipeDirection } from "@/lib/swipe"

/**
 * Touch-swipe handlers for horizontal day navigation. Returns props to spread
 * onto the swipeable element; a deliberate left/right swipe (see
 * `swipeDirection`) fires the matching callback. Left = "next" (content moves
 * left, like a carousel), right = "previous".
 */
export function useSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 40
) {
  const start = useRef<{ x: number; y: number } | null>(null)

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      const dir = swipeDirection(
        t.clientX - start.current.x,
        t.clientY - start.current.y,
        threshold
      )
      start.current = null
      if (dir === "left") onSwipeLeft()
      else if (dir === "right") onSwipeRight()
    },
  }
}
