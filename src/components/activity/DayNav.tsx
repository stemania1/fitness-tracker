"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

interface DayNavProps {
  /** Text between the arrows, e.g. "Today's Plan". */
  label: string
  /** Go to the previous day; omit to disable the ‹ arrow (at a boundary). */
  onPrev?: () => void
  /** Go to the next day; omit to disable the › arrow (at a boundary). */
  onNext?: () => void
}

const btn =
  "rounded-md p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"

/** Prev / label / next day switcher used on the dashboard's plan and meal
 *  cards. Pairs with a swipe gesture on the card body. */
export function DayNav({ label, onPrev, onNext }: DayNavProps) {
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={!onPrev}
        aria-label="Previous day"
        className={btn}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-center">{label}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!onNext}
        aria-label="Next day"
        className={btn}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </span>
  )
}
