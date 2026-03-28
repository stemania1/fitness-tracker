"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface RestTimerProps {
  seconds: number
  onComplete: () => void
  onSkip: () => void
}

export function RestTimer({ seconds, onComplete, onSkip }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (remaining <= 0) {
      setDone(true)
      onComplete()
      return
    }
    const id = setInterval(() => {
      setRemaining((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(id)
  }, [remaining, onComplete])

  const progress = seconds > 0 ? ((seconds - remaining) / seconds) * 100 : 100
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  const formatTime = useCallback((s: number) => {
    const mins = Math.floor(Math.max(0, s) / 60)
    const secs = Math.max(0, s) % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }, [])

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
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
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
        <p className="mb-6 text-lg font-medium text-purple-300">
          Time is up!
        </p>
      ) : null}

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
