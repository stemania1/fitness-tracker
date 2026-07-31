"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Minus, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface RestTimerProps {
  seconds: number
  onComplete: () => void
  onSkip: () => void
}

/** How much each adjust button moves the rest interval. */
const STEP_SECONDS = 30

function formatTime(s: number): string {
  const mins = Math.floor(Math.max(0, s) / 60)
  const secs = Math.max(0, s) % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * Rest countdown between sets, with the interval prescribed by the exercise.
 *
 * Counts down to a DEADLINE rather than decrementing a counter each tick. iOS
 * throttles timers in a backgrounded PWA, so a decrementing counter keeps
 * whatever value it had when the app went away — you'd return to a rest timer
 * still showing a minute left long after the rest actually ended. Deriving
 * from the clock means it catches up on the next tick.
 *
 * −30s / +30s adjust the interval in the moment: the prescription is a
 * suggestion, and reaching for the plan mid-set to change it isn't realistic.
 * Taking the timer to zero counts as the rest finishing (so the logger's
 * auto-advance runs), which is deliberately different from Skip.
 */
export function RestTimer({ seconds, onComplete, onSkip }: RestTimerProps) {
  const [total, setTotal] = useState(seconds)
  const [remaining, setRemaining] = useState(seconds)
  const [done, setDone] = useState(false)

  const deadlineRef = useRef(Date.now() + seconds * 1000)
  const doneRef = useRef(false)
  // Held in a ref so a parent that passes a fresh inline callback on every
  // render doesn't tear down and restart the interval.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  })

  // Restart cleanly if the same instance is handed a new interval.
  useEffect(() => {
    deadlineRef.current = Date.now() + seconds * 1000
    doneRef.current = false
    setTotal(seconds)
    setRemaining(seconds)
    setDone(false)
  }, [seconds])

  useEffect(() => {
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1000)
      )
      setRemaining(left)
      if (left <= 0 && !doneRef.current) {
        doneRef.current = true
        setDone(true)
        onCompleteRef.current()
      }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [seconds])

  const adjust = useCallback((delta: number) => {
    // Never push the deadline before now — the floor is "rest is over".
    deadlineRef.current = Math.max(
      Date.now(),
      deadlineRef.current + delta * 1000
    )
    setRemaining(
      Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
    )
    // Growing the total keeps the progress ring proportional; shrinking it
    // would make the ring jump backwards.
    if (delta > 0) setTotal((prev) => prev + delta)
  }, [])

  const progress = total > 0 ? ((total - remaining) / total) * 100 : 100
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-colors duration-300",
        done && "bg-purple-900/80"
      )}
    >
      <p className="mb-6 text-lg font-medium text-white">Rest Timer</p>

      {/* Circular progress */}
      <div className="relative mb-8">
        <svg width="140" height="140" className="-rotate-90">
          {/* Background circle */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={done ? "#a855f7" : "#7c3aed"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "text-4xl font-bold tabular-nums text-white transition-colors",
              done && "text-purple-300"
            )}
          >
            {formatTime(remaining)}
          </span>
        </div>
      </div>

      {done ? (
        <p className="mb-6 text-lg font-medium text-purple-300">Time is up!</p>
      ) : (
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => adjust(-STEP_SECONDS)}
            aria-label={`Subtract ${STEP_SECONDS} seconds`}
            className="gap-1"
          >
            <Minus className="h-4 w-4" />
            {STEP_SECONDS}s
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => adjust(STEP_SECONDS)}
            aria-label={`Add ${STEP_SECONDS} seconds`}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            {STEP_SECONDS}s
          </Button>
        </div>
      )}

      <Button
        variant="secondary"
        size="lg"
        onClick={onSkip}
        className="min-w-[140px] gap-2"
      >
        <X className="h-4 w-4" />
        {done ? "Dismiss" : "Skip"}
      </Button>
    </div>
  )
}
