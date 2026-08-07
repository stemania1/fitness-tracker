"use client"

/**
 * Resolve what the logger session IS — appended, template, plan, or
 * freestyle — and load its starting exercises. Extracted from the log page's
 * init effect; the row→ActiveExercise shaping stays in lib/workout-init.
 */

import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { exercises as exerciseCatalog } from "@/data/exercises"
import {
  plannedToActive,
  remainingPlannedExercises,
  templateRowsToActive,
  loggedExerciseNames,
  type TemplateExerciseRow,
} from "@/lib/workout-init"
import { plannedSession } from "@/lib/todays-workout"
import type { ActiveWorkout } from "@/lib/active-workout"

export interface AppendInfo {
  /** The saved workout being appended to. */
  logId: string
  /** How many exercises it already has, so new order_index values continue
   *  after them. */
  orderOffset: number
}

export interface WorkoutInit {
  workout: ActiveWorkout | null
  setWorkout: Dispatch<SetStateAction<ActiveWorkout | null>>
  /** When this sitting's clock started. For an appended workout this is the
   *  moment of resuming, NOT the original session's started_at — the header
   *  timer counts the current sitting. */
  timerStart: Date | null
  /** Set when appending to a saved workout; null otherwise. */
  appendInfo: React.MutableRefObject<AppendInfo | null>
}

export function useWorkoutInit(
  templateId: string | null,
  planParam: string | null,
  appendId: string | null
): WorkoutInit {
  const router = useRouter()
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null)
  const [timerStart, setTimerStart] = useState<Date | null>(null)
  const appendInfo = useRef<AppendInfo | null>(null)

  useEffect(() => {
    async function init() {
      if (appendId) {
        // Add exercises to an existing saved workout. finishWorkout() inserts
        // into that workout instead of creating a new one. When the workout is
        // a plan session, pre-load the plan's remaining exercises (the ones not
        // already logged) so the user just fills in weights.
        const supabase = createClient()
        const { data: log } = await supabase
          .from("workout_logs")
          .select("id, name, started_at")
          .eq("id", appendId)
          .single()

        if (!log) {
          router.push("/activity")
          return
        }

        // Names already logged in this workout (join exercises(name)).
        const { data: existingRows } = await supabase
          .from("exercise_logs")
          .select("id, exercises(name)")
          .eq("workout_log_id", appendId)
        const existing = (existingRows ?? []) as Array<{
          id: string
          exercises: { name: string } | { name: string }[] | null
        }>

        // If this workout matches the plan session for its day, pre-load the
        // still-missing prescribed exercises; otherwise start empty.
        const planned = plannedSession(new Date(log.started_at))
        const preloaded =
          planned.name === log.name
            ? remainingPlannedExercises(
                planned.exercises,
                loggedExerciseNames(existing),
                exerciseCatalog
              )
            : []

        appendInfo.current = { logId: appendId, orderOffset: existing.length }
        setTimerStart(new Date())
        setWorkout({
          name: log.name,
          templateId: null,
          startedAt: new Date(log.started_at),
          exercises: preloaded,
        })
        return
      }

      if (templateId) {
        const supabase = createClient()
        const { data: template } = await supabase
          .from("workout_templates")
          .select("id, name")
          .eq("id", templateId)
          .single()

        const { data: templateExercises } = await supabase
          .from("template_exercises")
          .select(
            "exercise_id, sets, reps, rest_seconds, order_index, exercises(name)"
          )
          .eq("template_id", templateId)
          .order("order_index", { ascending: true })

        const activeExercises = templateRowsToActive(
          (templateExercises ?? []) as TemplateExerciseRow[],
          exerciseCatalog
        )

        const now = new Date()
        setTimerStart(now)
        setWorkout({
          name: template?.name ?? "Workout",
          templateId: templateId,
          startedAt: now,
          exercises: activeExercises,
        })
      } else if (planParam === "today") {
        // Pre-load today's prescribed session (lifts + Zone 2 finisher) from
        // the training plan — no DB round-trip, exercises come from the static
        // catalog so previous-performance + progressive-overload work as usual.
        const planned = plannedSession(new Date())
        const activeExercises = plannedToActive(planned.exercises, exerciseCatalog)

        const now = new Date()
        setTimerStart(now)
        setWorkout({
          name: planned.name,
          templateId: null,
          startedAt: now,
          exercises: activeExercises,
        })
      } else {
        const now = new Date()
        setTimerStart(now)
        setWorkout({
          name: "Freestyle Workout",
          templateId: null,
          startedAt: now,
          exercises: [],
        })
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, planParam, appendId])

  return { workout, setWorkout, timerStart, appendInfo }
}
