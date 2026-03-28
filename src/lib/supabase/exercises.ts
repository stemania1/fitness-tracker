import { exercises as staticExercises } from "@/data/exercises"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * Looks up exercises from static data in the Supabase exercises table (already seeded).
 * Returns a map of static exercise ID -> Supabase UUID.
 */
export async function ensureExercisesExist(
  supabase: SupabaseClient<Database>,
  exerciseIds: string[]
): Promise<Map<string, string>> {
  const needed = staticExercises.filter((e) => exerciseIds.includes(e.id))
  if (needed.length === 0) return new Map()

  const names = needed.map((e) => e.name)
  const { data: existing, error } = await supabase
    .from("exercises")
    .select("id, name")
    .in("name", names)

  if (error) throw error

  const nameToDbId = new Map<string, string>()
  for (const row of existing ?? []) {
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
