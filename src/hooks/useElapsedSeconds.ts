"use client"

import { useEffect, useState } from "react"

/** Whole seconds between `from` and `now`, floored, never negative. */
export function secondsSince(from: Date | null, now: number = Date.now()): number {
  if (!from) return 0
  return Math.max(0, Math.floor((now - from.getTime()) / 1000))
}

/**
 * Seconds elapsed since `startedAt`, ticking once a second.
 *
 * Derived from the wall clock on every tick rather than incremented, so it
 * stays correct when the interval is throttled — which iOS does aggressively
 * to a backgrounded PWA. An incrementing counter would drift behind by however
 * long the app spent in the background.
 *
 * Returns 0 while `startedAt` is null (the workout is still loading), and
 * recomputes immediately when it arrives instead of waiting out the first tick.
 */
export function useElapsedSeconds(startedAt: Date | null): number {
  const [elapsed, setElapsed] = useState(() => secondsSince(startedAt))

  useEffect(() => {
    setElapsed(secondsSince(startedAt))
    if (!startedAt) return
    const id = setInterval(() => setElapsed(secondsSince(startedAt)), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return elapsed
}
