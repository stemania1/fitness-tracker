"use client"

import { useState } from "react"
import { ChevronDown, Info, Clock } from "lucide-react"
import { MuscleMap } from "./MuscleMap"
import { ExercisePositions } from "./ExercisePositions"
import { exerciseDescription } from "@/data/exercise-descriptions"
import { formatMuscleGroup } from "@/lib/muscle-groups"
import { cn } from "@/lib/utils"

interface ExerciseInfoBodyProps {
  exerciseId: string
  muscleGroups: string[]
  /** Prescribed rest between sets, in seconds. */
  restSeconds?: number | null
  className?: string
}

type ExerciseInfoProps = Omit<ExerciseInfoBodyProps, "className">

function formatRest(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60} min`
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

/**
 * The "what is this and how do I do it" panel itself, without a disclosure
 * around it: the two-position movement diagram, the muscle map, the
 * plain-language description and the prescribed rest.
 *
 * Split out from `ExerciseInfo` so callers that already own the disclosure can
 * render the same panel rather than nesting a second "About this exercise"
 * toggle inside their own — the Express card expands a circuit row straight
 * into this.
 */
export function ExerciseInfoBody({
  exerciseId,
  muscleGroups,
  restSeconds,
  className,
}: ExerciseInfoBodyProps) {
  const description = exerciseDescription(exerciseId)

  return (
    <div className={cn("space-y-3", className)}>
      {/* How the movement goes, before which muscles it works — mid-workout
          the unfamiliar thing is the motion, not the anatomy. */}
      <ExercisePositions
        exerciseId={exerciseId}
        className="rounded-md bg-gray-50 py-2"
      />
      <div className="flex items-start gap-3">
        <MuscleMap groups={muscleGroups} className="h-24 w-32 shrink-0" />
        <div className="min-w-0 space-y-1.5">
          {description && <p className="text-sm text-gray-700">{description}</p>}
          {muscleGroups.length > 0 && (
            <p className="text-xs text-gray-500">
              Works: {muscleGroups.map(formatMuscleGroup).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* The icon and the sentence are the only flex items. Putting the
          text directly in a flex container makes each run — "Rest about",
          the bolded duration, "between sets…" — its own flex item, so each
          wraps in its own column and the sentence reads across broken:
          "Rest 1 between sets…" / "about min automatically…". */}
      {restSeconds != null && restSeconds > 0 && (
        <div className="flex items-start gap-1.5 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <p>
            Rest about{" "}
            <span className="font-medium text-gray-800">
              {formatRest(restSeconds)}
            </span>{" "}
            between sets — the timer starts automatically when you check off a
            set.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Collapsible "About this exercise" panel: a generated muscle-map diagram,
 * a plain-language description, and the recommended rest between sets — so
 * an unfamiliar machine name isn't a mystery mid-workout.
 */
export function ExerciseInfo({
  exerciseId,
  muscleGroups,
  restSeconds,
}: ExerciseInfoProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-3 rounded-lg border border-gray-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-1.5">
          <Info className="h-4 w-4 text-purple-500" />
          About this exercise
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ExerciseInfoBody
          exerciseId={exerciseId}
          muscleGroups={muscleGroups}
          restSeconds={restSeconds}
          className="px-3 pb-3"
        />
      )}
    </div>
  )
}
