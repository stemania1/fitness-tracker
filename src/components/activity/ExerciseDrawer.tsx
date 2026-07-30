"use client"

import { Button } from "@/components/ui/button"
import { Check, Flame, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ActiveExercise } from "@/lib/active-workout"

interface ExerciseDrawerProps {
  exercises: ActiveExercise[]
  /** Index of the exercise currently open in the logger. */
  currentIdx: number
  /** Calories logged so far for one exercise; 0 hides the flame. */
  caloriesFor: (ex: ActiveExercise) => number
  onSelect: (idx: number) => void
  onClose: () => void
}

/**
 * Bottom-sheet list of the workout's exercises — set progress per exercise and
 * a tap target to jump to any of them.
 */
export function ExerciseDrawer({
  exercises,
  currentIdx,
  caloriesFor,
  onSelect,
  onClose,
}: ExerciseDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Exercises"
        className="relative mt-auto max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white pb-8"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h3 className="font-semibold text-gray-900">Exercises</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ul className="divide-y divide-gray-50">
          {exercises.map((ex, ei) => {
            const completedSets = ex.sets.filter((s) => s.completed).length
            const totalSets = ex.sets.length
            const allDone = completedSets === totalSets && totalSets > 0
            const calories = caloriesFor(ex)

            return (
              <li key={ei}>
                <button
                  onClick={() => onSelect(ei)}
                  aria-current={ei === currentIdx ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-gray-50",
                    ei === currentIdx && "bg-purple-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      allDone
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {allDone ? <Check className="h-4 w-4" /> : ei + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {ex.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>
                        {completedSets}/{totalSets} sets
                      </span>
                      {calories > 0 && (
                        <span className="flex items-center gap-0.5 text-orange-400">
                          <Flame className="h-3 w-3" />
                          {calories}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
