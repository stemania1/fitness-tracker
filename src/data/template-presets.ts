/**
 * One-tap workout template presets for the 12-week training plan
 * (docs/training-plan-vo2max-pullups.md). Exercise IDs reference the
 * static catalog in src/data/exercises.ts; DB uuids are resolved at
 * insert time via ensureExercisesExist.
 *
 * Two moves have no exact catalog entry and use the closest stand-in,
 * with the real prescription carried in notes: hollow hold → plank,
 * farmer hold → dumbbell shrug (held).
 */

export interface PresetExercise {
  /** Static catalog ID from src/data/exercises.ts. */
  exerciseId: string
  sets: number
  reps: string
  restSeconds: number
  notes: string | null
}

export interface TemplatePreset {
  name: string
  description: string
  splitType: "pull"
  estimatedMins: number
  exercises: PresetExercise[]
}

export const PULL_A_PRESET: TemplatePreset = {
  name: "Pull A",
  description:
    "Saturday volume day from the 12-week plan. Finish with 15-20 min easy Zone 2 on the bike or elliptical.",
  splitType: "pull",
  estimatedMins: 60,
  exercises: [
    {
      exerciseId: "assisted-pull-up",
      sets: 4,
      reps: "6-8",
      restSeconds: 120,
      notes:
        "Leave 1-2 reps in the tank. Drop assistance 5-10 lb after any week you hit all reps.",
    },
    {
      exerciseId: "pull-up",
      sets: 3,
      reps: "3-5",
      restSeconds: 90,
      notes: "Slow negatives: jump to the top, lower for 5 seconds to a full hang.",
    },
    {
      exerciseId: "lat-pulldown-exercise",
      sets: 3,
      reps: "8-12",
      restSeconds: 90,
      notes: null,
    },
    {
      exerciseId: "seated-row-exercise",
      sets: 3,
      reps: "10-12",
      restSeconds: 90,
      notes: null,
    },
    {
      exerciseId: "plank",
      sets: 3,
      reps: "20-30 sec",
      restSeconds: 60,
      notes: "Hollow hold if comfortable — pull-ups are half core.",
    },
  ],
}

export const PULL_B_PRESET: TemplatePreset = {
  name: "Pull B",
  description:
    "Thursday 5:45 AM heavier day from the 12-week plan — lower reps, less assistance than Pull A.",
  splitType: "pull",
  estimatedMins: 45,
  exercises: [
    {
      exerciseId: "assisted-pull-up",
      sets: 5,
      reps: "4-6",
      restSeconds: 120,
      notes: "10-15 lb less assistance than Pull A (heavier day).",
    },
    {
      exerciseId: "pull-up",
      sets: 3,
      reps: "8",
      restSeconds: 60,
      notes:
        "Scapular pulls: dead hang, shrug the shoulder blades down and back — no arm bend.",
    },
    {
      exerciseId: "dumbbell-row",
      sets: 3,
      reps: "8-10",
      restSeconds: 90,
      notes: "Per side.",
    },
    {
      exerciseId: "cable-face-pull",
      sets: 3,
      reps: "12-15",
      restSeconds: 60,
      notes: "Shoulder-health insurance for all this pulling.",
    },
    {
      exerciseId: "dumbbell-shrug",
      sets: 3,
      reps: "30 sec",
      restSeconds: 60,
      notes: "Farmer hold: heavy dumbbells at your sides, grip until the clock runs out.",
    },
  ],
}

export const TRAINING_PLAN_PRESETS: TemplatePreset[] = [
  PULL_A_PRESET,
  PULL_B_PRESET,
]
