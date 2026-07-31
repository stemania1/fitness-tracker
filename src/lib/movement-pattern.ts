/**
 * Movement pattern for an exercise — what the body actually does, as opposed
 * to which muscles it works.
 *
 * The "About this exercise" panel draws a start and end position from this.
 * Per-exercise artwork for 72 exercises would rot the moment the catalog grew,
 * whereas nearly every strength lift in the catalog is one of a dozen shapes:
 * a squat is a squat whether it's loaded with a barbell, a dumbbell or a sled.
 *
 * Cardio, stretches and mobility work return null — a two-position diagram
 * says nothing useful about a treadmill, and the panel just omits it.
 */

export type MovementPattern =
  | "horizontal-press"
  | "overhead-press"
  | "vertical-pull"
  | "horizontal-pull"
  | "fly"
  | "curl"
  | "tricep-extension"
  | "lateral-raise"
  | "shrug"
  | "squat"
  | "hinge"
  | "leg-extension"
  | "leg-curl"
  | "calf-raise"
  | "crunch"
  | "hold"

const BY_EXERCISE: Record<string, MovementPattern> = {
  // Push — horizontal
  "chest-press-machine-flat": "horizontal-press",
  "dumbbell-bench-press": "horizontal-press",
  "dumbbell-incline-press": "horizontal-press",
  "smith-machine-bench-press": "horizontal-press",
  "push-ups": "horizontal-press",
  "assisted-dip": "horizontal-press",

  // Push — overhead
  "shoulder-press-machine-exercise": "overhead-press",
  "dumbbell-shoulder-press": "overhead-press",
  "dumbbell-arnold-press": "overhead-press",
  "smith-machine-overhead-press": "overhead-press",

  // Arcing single-joint chest/rear-delt work
  "dumbbell-flyes": "fly",
  "pec-fly-machine-exercise": "fly",
  "cable-crossover-exercise": "fly",
  "reverse-pec-fly": "fly",
  "dumbbell-pullover": "fly",

  // Pull — vertical
  "lat-pulldown-exercise": "vertical-pull",
  "assisted-pull-up": "vertical-pull",
  "pull-up": "vertical-pull",
  "straight-arm-pulldown": "vertical-pull",

  // Pull — horizontal
  "seated-row-exercise": "horizontal-pull",
  "dumbbell-row": "horizontal-pull",
  "cable-row": "horizontal-pull",
  "cable-face-pull": "horizontal-pull",

  "dumbbell-shrug": "shrug",

  // Arms
  "dumbbell-bicep-curl": "curl",
  "preacher-curl-machine": "curl",
  "barbell-bicep-curl": "curl",
  "ez-bar-standing-curl": "curl",
  "hammer-curl": "curl",
  "concentration-curl": "curl",
  "dumbbell-reverse-curl": "curl",
  "cable-bicep-curl": "curl",
  "cable-tricep-pushdown": "tricep-extension",
  "dumbbell-tricep-overhead": "tricep-extension",
  "dumbbell-skull-crusher": "tricep-extension",
  "cable-overhead-tricep": "tricep-extension",

  // Shoulders — raises
  "dumbbell-lateral-raise": "lateral-raise",
  "dumbbell-front-raise": "lateral-raise",
  "cable-lateral-raise": "lateral-raise",

  // Legs
  "leg-press-exercise": "squat",
  "smith-machine-squat": "squat",
  "dumbbell-goblet-squat": "squat",
  "dumbbell-lunge": "squat",
  "smith-machine-lunge": "squat",
  "bulgarian-split-squat": "squat",
  "dumbbell-step-up": "squat",
  "dumbbell-romanian-deadlift": "hinge",
  "leg-extension-exercise": "leg-extension",
  "leg-curl-exercise": "leg-curl",
  "hip-abductor-exercise": "leg-extension",
  "hip-adductor-exercise": "leg-extension",
  "dumbbell-calf-raise": "calf-raise",

  // Core
  "ab-crunch-machine-exercise": "crunch",
  "cable-crunch": "crunch",
  "bicycle-crunches": "crunch",
  "mountain-climbers": "crunch",
  "cable-woodchop": "crunch",
  "dead-bug": "crunch",
  plank: "hold",
}

/**
 * The movement pattern for an exercise, or null when a two-position diagram
 * wouldn't help (cardio, stretching, mobility).
 */
export function movementPattern(exerciseId: string): MovementPattern | null {
  return BY_EXERCISE[exerciseId] ?? null
}

/**
 * Whether the pattern is a static hold, where "start" and "end" are the same
 * shape and the diagram should show one position rather than two.
 */
export function isStaticHold(pattern: MovementPattern): boolean {
  return pattern === "hold"
}
