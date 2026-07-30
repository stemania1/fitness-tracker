/**
 * The in-progress workout model used by the logger, plus the pure helpers
 * that build and describe it.
 *
 * Extracted from `activity/log/page.tsx` so the shape of a live workout and
 * the cardio maths around it are testable without mounting the 1,500-line
 * logger. Everything here is pure — no React, no Supabase.
 */

import type { ExerciseDefinition } from "@/data/exercises"

/** One logged set. Every metric is nullable: a set is created empty and
 *  filled in as the user works, and which fields apply depends on whether the
 *  exercise is strength or cardio. */
export interface ActiveSet {
  reps: number | null
  weight: number | null
  durationMins: number | null
  distanceMiles: number | null
  speedMph: number | null
  inclinePercent: number | null
  rpe: number | null
  completed: boolean
}

export interface ActiveExercise {
  exerciseId: string
  name: string
  muscleGroups: string[]
  exerciseType: "strength" | "cardio" | "flexibility"
  /** True when logged "weight" is machine assistance (higher = easier). */
  assisted: boolean
  equipmentId: string | null
  /** Prescribed rep range string from the template (e.g. "8-12"). Null for
   *  freestyle workouts. Drives the progressive-overload suggestion. */
  repsTarget: string | null
  sets: ActiveSet[]
  notes: string
  restSeconds: number
}

export interface ActiveWorkout {
  name: string
  templateId: string | null
  startedAt: Date
  exercises: ActiveExercise[]
}

/** A blank set — every metric null, not yet completed. */
export function makeSet(): ActiveSet {
  return {
    reps: null,
    weight: null,
    durationMins: null,
    distanceMiles: null,
    speedMph: null,
    inclinePercent: null,
    rpe: null,
    completed: false,
  }
}

export function makeExercise(
  def: ExerciseDefinition,
  restSec: number = 60,
  repsTarget: string | null = null
): ActiveExercise {
  const numSets = def.defaultSets || 3
  return {
    exerciseId: def.id,
    name: def.name,
    muscleGroups: def.muscleGroups,
    assisted: def.assisted ?? false,
    exerciseType: def.exerciseType,
    equipmentId: def.equipmentId,
    // Freestyle adds fall back to the catalog default so the card still
    // shows a target (and timed holds get their seconds labelling).
    repsTarget: repsTarget ?? def.defaultReps ?? null,
    sets: Array.from({ length: numSets }, () => makeSet()),
    notes: "",
    restSeconds: restSec,
  }
}

export function isTreadmill(ex: ActiveExercise): boolean {
  return ex.equipmentId === "treadmill"
}

export function isOutdoorRun(ex: ActiveExercise): boolean {
  return ex.exerciseId === "outdoor-run"
}

/** Exercises where we compute speed from time + distance instead of taking
 *  it as input. Treadmill (with incline) and outdoor run (with pace). */
export function isDistanceCardio(ex: ActiveExercise): boolean {
  return isTreadmill(ex) || isOutdoorRun(ex)
}

/** Average speed (mph) computed from distance + duration. Returns null when
 *  either input is missing or zero. */
export function computeSpeedMph(
  distanceMiles: number | null,
  durationMins: number | null
): number | null {
  if (!distanceMiles || !durationMins) return null
  if (distanceMiles <= 0 || durationMins <= 0) return null
  return distanceMiles / (durationMins / 60)
}

/** Format pace as "M:SS" per mile from distance + duration. */
export function formatPace(
  distanceMiles: number | null,
  durationMins: number | null
): string {
  if (!distanceMiles || !durationMins) return "—"
  if (distanceMiles <= 0 || durationMins <= 0) return "—"
  const minPerMile = durationMins / distanceMiles
  const mins = Math.floor(minPerMile)
  const secs = Math.round((minPerMile - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/** Elapsed-time display: "M:SS", or "H:MM:SS" once past an hour. */
export function formatTimer(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  if (hrs > 0)
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
