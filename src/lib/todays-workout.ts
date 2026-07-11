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
