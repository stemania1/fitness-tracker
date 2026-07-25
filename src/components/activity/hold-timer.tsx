"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"

interface HoldTimerProps {
  /** Optional target seconds — draws a subtle goal marker / label. */
  targetSeconds?: number | null
  /** Called with the elapsed whole seconds when the user taps Done. */
  onDone: (seconds: number) => void
  onCancel: () => void
}

/**
 * Count-up stopwatch for timed holds (e.g. plank). Starts immediately; the
 * user taps Done to record the elapsed seconds into the set. A full-screen
 * overlay mirroring the rest timer so it's readable mid-exercise.
 */
export function HoldTimer({ targetSeconds, onDone, onCancel }: HoldTimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const formatTime = useCallback((s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}`
  }, [])

  const hitTarget = targetSeconds != null && elapsed >= targetSeconds

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <p className="mb-6 text-lg font-medium text-white">Hold Timer</p>

      <div className="mb-2 flex h-36 w-36 items-center justify-center rounded-full border-8 border-white/15">
        <span
          aria-live="polite"
          aria-atomic="true"
          className={`text-5xl font-bold tabular-nums ${hitTarget ? "text-emerald-300" : "text-white"}`}
        >
          {formatTime(elapsed)}
        </span>
      </div>
      <p className="mb-8 text-sm text-white/70">
        {targetSeconds != null
          ? hitTarget
            ? `Target ${targetSeconds}s reached — hold on!`
            : `Target: ${targetSeconds}s`
          : "seconds"}
      </p>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onCancel} className="gap-2">
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button size="lg" onClick={() => onDone(elapsed)} className="gap-2">
          <Check className="h-4 w-4" />
          Done
        </Button>
      </div>
    </div>
  )
}
