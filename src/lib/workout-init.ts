/**
 * Build the logger's starting exercise list from whatever it was launched
 * with — a training-plan session, a saved template, or an append to a
 * workout already in progress.
 *
 * All three used to be written out inline in the page, each with its own copy
 * of the same catalog-definition-to-ActiveExercise mapping. Same shape, three
 * chances to drift. They share one builder here, and the differences that are
 * real (a template carries its own sets/reps and matches the catalog by NAME;
 * a plan carries them and matches by id) stay visible as separate functions.
 *
 * Pure, so the page is left with the IO.
 */

import { makeSet, type ActiveExercise } from "./active-workout"
import type { ExerciseDefinition } from "@/data/exercises"
import type { PlannedExercise } from "./todays-workout"

/** A `template_exercises` row with `exercises(name)` embedded. */
export interface TemplateExerciseRow {
  exercise_id: string
  sets: number | null
  reps: string | null
  rest_seconds: number | null
  order_index: number
  exercises: { name: string } | { name: string }[] | null
}

/** Sets a template row gets when it doesn't say. */
export const DEFAULT_TEMPLATE_SETS = 3
/** Rest a template row gets when it doesn't say. */
export const DEFAULT_TEMPLATE_REST_SECONDS = 60

/**
 * Read the name out of an embedded to-one relation.
 *
 * PostgREST returns these as an object or as a single-element array depending
 * on how it infers the relationship, and the logger has been hit by both.
 */
export function embeddedName(
  rel: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (!rel) return null
  const row = Array.isArray(rel) ? rel[0] : rel
  return row?.name ?? null
}

/**
 * One exercise, ready to log: the catalog definition for identity and the
 * prescription (sets / reps / rest / notes) for what to do with it.
 */
export function toActiveExercise(
  def: ExerciseDefinition,
  prescription: {
    sets: number
    reps: string | null
    restSeconds: number
    notes?: string | null
  }
): ActiveExercise {
  return {
    exerciseId: def.id,
    name: def.name,
    muscleGroups: def.muscleGroups,
    assisted: def.assisted ?? false,
    exerciseType: def.exerciseType,
    equipmentId: def.equipmentId,
    repsTarget: prescription.reps,
    sets: Array.from({ length: prescription.sets }, () => makeSet()),
    notes: prescription.notes ?? "",
    restSeconds: prescription.restSeconds,
  }
}

/** Catalog by id, for the plan paths (a plan references catalog ids). */
export function catalogById(
  catalog: ExerciseDefinition[]
): Map<string, ExerciseDefinition> {
  return new Map(catalog.map((e) => [e.id, e]))
}

/** Catalog by name, for the template path (see `templateRowsToActive`). */
export function catalogByName(
  catalog: ExerciseDefinition[]
): Map<string, ExerciseDefinition> {
  return new Map(catalog.map((e) => [e.name, e]))
}

/**
 * A planned session's exercises, ready to log. An entry whose catalog id no
 * longer exists is dropped rather than rendering a nameless row.
 */
export function plannedToActive(
  planned: PlannedExercise[],
  catalog: ExerciseDefinition[]
): ActiveExercise[] {
  const byId = catalogById(catalog)
  return planned.flatMap((p) => {
    const def = byId.get(p.exerciseId)
    if (!def) return []
    return [
      toActiveExercise(def, {
        sets: p.sets,
        reps: p.reps,
        restSeconds: p.restSeconds,
        notes: p.notes,
      }),
    ]
  })
}

/**
 * The planned exercises NOT already logged in a workout being appended to, so
 * resuming a session offers only what's left rather than everything again.
 */
export function remainingPlannedExercises(
  planned: PlannedExercise[],
  loggedNames: ReadonlySet<string>,
  catalog: ExerciseDefinition[]
): ActiveExercise[] {
  return plannedToActive(planned, catalog).filter(
    (ex) => !loggedNames.has(ex.name)
  )
}

/**
 * Template rows, ready to log.
 *
 * Matched to the catalog by NAME, not id: `template_exercises.exercise_id` is
 * a database UUID while the logger works from the static catalog, and name is
 * the only key the two share. A row whose name isn't in the catalog is
 * therefore dropped — worth knowing, since that silently loses an exercise
 * from a template that has one the catalog doesn't carry.
 *
 * Rows arrive ordered by `order_index` from the query; that order is kept.
 */
export function templateRowsToActive(
  rows: TemplateExerciseRow[],
  catalog: ExerciseDefinition[]
): ActiveExercise[] {
  const byName = catalogByName(catalog)
  return rows.flatMap((row) => {
    const name = embeddedName(row.exercises)
    if (!name) return []
    const def = byName.get(name)
    if (!def) return []
    return [
      toActiveExercise(def, {
        // `||`, not `??`, preserving the page's behaviour exactly: a stored 0
        // falls back to the default. Harmless for `sets`, where 0 is a broken
        // row, but it does mean a template prescribing 0 rest (a superset)
        // would silently get 60s. No template writes 0 today, so this is
        // recorded rather than changed — fixing it is a behaviour change and
        // belongs in its own commit.
        sets: row.sets || DEFAULT_TEMPLATE_SETS,
        reps: row.reps,
        restSeconds: row.rest_seconds || DEFAULT_TEMPLATE_REST_SECONDS,
      }),
    ]
  })
}

/** Names already logged against a workout, from `exercise_logs`. */
export function loggedExerciseNames(
  rows: Array<{ exercises: { name: string } | { name: string }[] | null }>
): Set<string> {
  const names = new Set<string>()
  for (const row of rows) {
    const name = embeddedName(row.exercises)
    if (name) names.add(name)
  }
  return names
}
