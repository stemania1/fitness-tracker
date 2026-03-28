import { exercises as staticExercises } from "@/data/exercises"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * Ensures exercises from static data exist in the Supabase exercises table.
 * Upserts by name and returns a map of static exercise ID -> Supabase UUID.
 */
export async function ensureExercisesExist(
  supabase: SupabaseClient<Database>,
  exerciseIds: string[]
): Promise<Map<string, string>> {
  const needed = staticExercises.filter((e) => exerciseIds.includes(e.id))
  if (needed.length === 0) return new Map()

  // Upsert all needed exercises by name
  const rows = needed.map((e) => ({
    name: e.name,
    muscle_groups: e.muscleGroups,
    exercise_type: e.exerciseType,
    difficulty: e.difficulty,
    default_sets: e.defaultSets,
    default_reps: e.defaultReps,
    pf_friendly: true,
  }))

  const { data: upserted, error } = await supabase
    .from("exercises")
    .upsert(rows, { onConflict: "name", ignoreDuplicates: false })
    .select("id, name")

  if (error) throw error

  // Also query existing exercises by name in case upsert returned partial
  const names = needed.map((e) => e.name)
  const { data: existing, error: fetchError } = await supabase
    .from("exercises")
    .select("id, name")
    .in("name", names)

  if (fetchError) throw fetchError

  // Build map: static ID -> supabase UUID
  const nameToDbId = new Map<string, string>()
  for (const row of existing ?? upserted ?? []) {
    nameToDbId.set(row.name, row.id)
  }

  const result = new Map<string, string>()
  for (const e of needed) {
    const dbId = nameToDbId.get(e.name)
    if (dbId) {
      result.set(e.id, dbId)
    }
  }

  return result
}
