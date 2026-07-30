"use client"

import { Button } from "@/components/ui/button"
import type { ActiveExercise } from "@/lib/active-workout"

interface UncheckedExercisesDialogProps {
  /** Exercises with no checked-off sets — these will not be saved. */
  exercises: ActiveExercise[]
  /** Disables the confirm button while the save is in flight. */
  saving: boolean
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Last-chance confirmation before finishing a workout that still has exercises
 * with nothing checked off. Only completed sets are persisted, so without this
 * a session's work can silently fail to save.
 */
export function UncheckedExercisesDialog({
  exercises,
  saving,
  onCancel,
  onConfirm,
}: UncheckedExercisesDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unchecked-exercises-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <h3
          id="unchecked-exercises-title"
          className="text-base font-semibold text-gray-900"
        >
          Save without these?
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {exercises.length}{" "}
          {exercises.length === 1 ? "exercise has" : "exercises have"} no
          checked-off sets and won&apos;t be saved. Tap the checkmark on a set to
          include it.
        </p>
        {exercises.length > 0 && (
          <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto text-sm text-gray-500">
            {exercises.map((ex) => (
              <li key={ex.exerciseId} className="truncate">
                • {ex.name}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Keep logging
          </Button>
          <Button className="flex-1" disabled={saving} onClick={onConfirm}>
            Save anyway
          </Button>
        </div>
      </div>
    </div>
  )
}
