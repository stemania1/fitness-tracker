/**
 * Build today's prescribed session as a checkable list, so "Start Workout"
 * can load the plan's session for the day and the user ticks each item off.
 *
 * Strength days (Pull A / Pull B) expand to their template-preset exercises
 * with resolved catalog names; cardio days use the session's detail bullets;
 * rest days have no items.
 */

import { todayPlan } from "@/lib/training-plan"
import { PULL_A_PRESET, PULL_B_PRESET } from "@/data/template-presets"
import { exercises } from "@/data/exercises"
import type { SessionType } from "@/data/training-plan"

export interface ChecklistItem {
  /** Stable id for check state. */
  id: string
  label: string
  /** Sets/reps or coaching detail; empty for a bare instruction line. */
  detail: string
}

export interface TodaysWorkout {
  week: number | null
  title: string
  time: string
  durationMins: number
  type: SessionType
  phaseLabel: string | null
  isRest: boolean
  isDeload: boolean
  testTitle: string | null
  sessionNote: string | null
  items: ChecklistItem[]
}

const NAME_BY_ID = new Map(exercises.map((e) => [e.id, e.name]))

/** Build the checklist for whichever plan session falls on `date`. */
export function todaysWorkout(date: Date): TodaysWorkout {
  const plan = todayPlan(date)
  const { session } = plan

  let items: ChecklistItem[] = []

  if (session.key === "pull-a" || session.key === "pull-b") {
    const preset = session.key === "pull-a" ? PULL_A_PRESET : PULL_B_PRESET
    items = preset.exercises.map((ex, i) => {
      const name = NAME_BY_ID.get(ex.exerciseId) ?? ex.exerciseId
      const detail = ex.notes
        ? `${ex.sets} × ${ex.reps} · ${ex.notes}`
        : `${ex.sets} × ${ex.reps}`
      return { id: `${ex.exerciseId}-${i}`, label: name, detail }
    })
  } else if (session.type === "cardio") {
    items = session.details.map((d, i) => ({
      id: `step-${i}`,
      label: d,
      detail: "",
    }))
  }

  return {
    week: plan.week,
    title: session.title,
    time: session.time,
    durationMins: session.durationMins,
    type: session.type,
    phaseLabel: plan.phase?.label ?? null,
    isRest: session.type === "rest",
    isDeload: plan.isDeload,
    testTitle: plan.testTitle,
    sessionNote: plan.sessionNote,
    items,
  }
}

/** A prescribed exercise, shaped for the workout logger to pre-load. */
export interface PlannedExercise {
  /** Static catalog id from src/data/exercises.ts. */
  exerciseId: string
  sets: number
  /** Rep-range target (drives progressive-overload); e.g. "6-8", "15-20 min". */
  reps: string | null
  restSeconds: number
  notes: string | null
}

export interface PlannedSession {
  /** Workout name shown at the top of the logger. */
  name: string
  isRest: boolean
  exercises: PlannedExercise[]
}

/**
 * Today's session shaped for the real workout logger: strength days expand to
 * their preset lifts (Pull A also carries its Zone 2 bike/elliptical finisher),
 * cardio days pre-load one machine entry so total time/distance gets logged,
 * and rest days return no exercises. Powers "Start Workout" → /activity/log.
 */
export function plannedSession(date: Date): PlannedSession {
  const plan = todayPlan(date)
  const { session } = plan

  if (session.key === "pull-a" || session.key === "pull-b") {
    const preset = session.key === "pull-a" ? PULL_A_PRESET : PULL_B_PRESET
    const exercises: PlannedExercise[] = preset.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets,
      reps: ex.reps,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
    }))
    // Pull A finishes with 15-20 min easy Zone 2 — pre-add it so the aerobic
    // minutes get logged in the same session as the lifts.
    if (session.key === "pull-a") {
      exercises.push({
        exerciseId: "stationary-bike-exercise",
        sets: 1,
        reps: "15-20 min",
        restSeconds: 0,
        notes:
          "Zone 2 finisher — easy, conversational pace. Elliptical works too; swap the exercise if you used it.",
      })
    }
    return { name: session.title, isRest: false, exercises }
  }

  if (session.type === "cardio") {
    // One machine entry captures total time/distance; the interval structure
    // stays on the plan card. 4×4 = running intervals; 30/30 = bike.
    const isBike = session.key === "intervals-3030"
    return {
      name: session.title,
      isRest: false,
      exercises: [
        {
          exerciseId: isBike ? "stationary-bike-exercise" : "treadmill-run",
          sets: 1,
          reps: `${session.durationMins} min`,
          restSeconds: 0,
          notes: isBike
            ? "30/30 intervals + Zone 2 cool-down. Log total time and distance."
            : "4×4 VO2 intervals incl. warm-up. Log total time and distance.",
        },
      ],
    }
  }

  return { name: session.title, isRest: true, exercises: [] }
}
