/**
 * Persist a finished workout (log + exercises + sets) to Supabase. Extracted
 * from the logger so the same path can (a) save immediately and (b) replay a
 * workout that was queued offline. The payload is a plain serializable object
 * so it can be stashed in the offline queue and re-sent verbatim.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { ensureExercisesExist } from "@/lib/supabase/exercises"

export interface WorkoutPayloadSet {
  reps: number | null
  weight: number | null
  durationMins: number | null
  distanceMiles: number | null
  inclinePercent: number | null
  rpe: number | null
}

export interface WorkoutPayloadExercise {
  /** Static catalog id; resolved to a DB uuid at save time. */
  exerciseId: string
  notes: string
  /** order_index within the workout (offset added for appends). */
  orderIndex: number
  completedSets: WorkoutPayloadSet[]
}

export interface WorkoutPayload {
  userId: string
  name: string
  templateId: string | null
  startedAt: string
  finishedAt: string
  durationMins: number
  /** When set, append to this existing workout_log instead of creating one. */
  appendToLogId: string | null
  orderOffset: number
  exercises: WorkoutPayloadExercise[]
}

/**
 * Insert the workout and its exercises/sets. Returns the workout_log id.
 * Throws on a failed workout_log insert (so the caller can queue it offline).
 */
export async function saveWorkout(
  supabase: SupabaseClient<Database>,
  payload: WorkoutPayload
): Promise<string> {
  let logId: string
  if (payload.appendToLogId) {
    logId = payload.appendToLogId
  } else {
    const { data, error } = await supabase
      .from("workout_logs")
      .insert({
        user_id: payload.userId,
        template_id: payload.templateId,
        name: payload.name,
        started_at: payload.startedAt,
        finished_at: payload.finishedAt,
        duration_mins: payload.durationMins,
      })
      .select("id")
      .single()
    if (error || !data) {
      throw error ?? new Error("Failed to create workout log")
    }
    logId = data.id
  }

  const idMap = await ensureExercisesExist(
    supabase,
    payload.exercises.map((e) => e.exerciseId)
  )

  for (const ex of payload.exercises) {
    const dbExerciseId = idMap.get(ex.exerciseId)
    if (!dbExerciseId) continue

    const { data: exRow } = await supabase
      .from("exercise_logs")
      .insert({
        workout_log_id: logId,
        exercise_id: dbExerciseId,
        order_index: payload.orderOffset + ex.orderIndex,
        notes: ex.notes || null,
      })
      .select("id")
      .single()
    if (!exRow) continue

    const setInserts = ex.completedSets.map((s, si) => ({
      exercise_log_id: exRow.id,
      set_number: si + 1,
      reps: s.reps,
      weight: s.weight,
      duration_mins: s.durationMins,
      distance_miles: s.distanceMiles,
      incline_percent: s.inclinePercent,
      rpe: s.rpe,
    }))
    await supabase.from("set_logs").insert(setInserts)
  }

  return logId
}
