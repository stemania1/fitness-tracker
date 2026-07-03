/**
 * Parse free-text injury/limitation notes into structured exercise
 * exclusions for the workout generator.
 *
 * This is conservative keyword matching, not medical advice: when a body
 * area is mentioned, we exclude the catalog exercises that most commonly
 * aggravate it and steer cardio toward low-impact options. Users can always
 * add exercises back manually when editing a generated template.
 */

export type LimitationArea =
  | "knee"
  | "hip"
  | "lower_back"
  | "shoulder"
  | "elbow"
  | "wrist"
  | "ankle"

/** Keywords matched (case-insensitive, word-boundary) against the free text. */
const AREA_KEYWORDS: Record<LimitationArea, string[]> = {
  knee: ["knee", "knees", "acl", "mcl", "meniscus", "patella", "patellar"],
  hip: ["hip", "hips"],
  lower_back: ["back", "spine", "spinal", "disc", "sciatica", "lumbar"],
  shoulder: ["shoulder", "shoulders", "rotator cuff", "impingement", "labrum"],
  elbow: ["elbow", "elbows"],
  wrist: ["wrist", "wrists", "carpal"],
  ankle: ["ankle", "ankles", "achilles"],
}

/**
 * Catalog exercise IDs (src/data/exercises.ts) excluded per affected area.
 * Machine-supported, low-shear alternatives are deliberately left in
 * (e.g. leg press and leg curl stay available with a knee limitation;
 * face pulls and rear-delt flys stay available with a shoulder one).
 */
const AREA_EXCLUSIONS: Record<LimitationArea, string[]> = {
  knee: [
    "smith-machine-squat",
    "dumbbell-goblet-squat",
    "dumbbell-lunge",
    "smith-machine-lunge",
    "bulgarian-split-squat",
    "dumbbell-step-up",
    "leg-extension-exercise",
    "mountain-climbers",
    "treadmill-jog",
    "treadmill-run",
    "outdoor-run",
    "stairmaster-exercise",
  ],
  hip: [
    "smith-machine-squat",
    "dumbbell-goblet-squat",
    "dumbbell-lunge",
    "smith-machine-lunge",
    "bulgarian-split-squat",
    "dumbbell-step-up",
    "hip-abductor-exercise",
    "hip-adductor-exercise",
    "treadmill-jog",
    "treadmill-run",
    "outdoor-run",
    "stairmaster-exercise",
  ],
  lower_back: [
    "smith-machine-squat",
    "dumbbell-goblet-squat",
    "dumbbell-romanian-deadlift",
    "dumbbell-row",
    "dumbbell-shrug",
    "cable-woodchop",
    "ab-crunch-machine-exercise",
    "bicycle-crunches",
    "rowing-exercise",
    "treadmill-run",
    "outdoor-run",
  ],
  shoulder: [
    "shoulder-press-machine-exercise",
    "dumbbell-shoulder-press",
    "dumbbell-arnold-press",
    "smith-machine-overhead-press",
    "dumbbell-incline-press",
    "dumbbell-lateral-raise",
    "dumbbell-front-raise",
    "cable-lateral-raise",
    "dumbbell-flyes",
    "dumbbell-pullover",
    "pull-up",
    "assisted-pull-up",
    "rowing-exercise",
  ],
  elbow: [
    "dumbbell-skull-crusher",
    "dumbbell-tricep-overhead",
    "cable-overhead-tricep",
    "preacher-curl-machine",
    "concentration-curl",
  ],
  wrist: [
    "push-ups",
    "mountain-climbers",
    "dumbbell-reverse-curl",
    "rowing-exercise",
  ],
  ankle: [
    "dumbbell-lunge",
    "smith-machine-lunge",
    "bulgarian-split-squat",
    "dumbbell-step-up",
    "dumbbell-calf-raise",
    "mountain-climbers",
    "treadmill-jog",
    "treadmill-run",
    "outdoor-run",
    "stairmaster-exercise",
  ],
}

/** Areas whose limitation should also steer cardio toward low impact. */
const LOWER_BODY_AREAS: ReadonlySet<LimitationArea> = new Set([
  "knee",
  "hip",
  "lower_back",
  "ankle",
])

/**
 * Detect which body areas a free-text limitations note mentions.
 * Returns an empty array for blank/unrecognized text.
 */
export function parseLimitations(text: string | null | undefined): LimitationArea[] {
  if (!text) return []
  const lower = text.toLowerCase()
  const areas: LimitationArea[] = []
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS) as Array<
    [LimitationArea, string[]]
  >) {
    const hit = keywords.some((kw) =>
      new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i").test(lower)
    )
    if (hit) areas.push(area)
  }
  return areas
}

/** Union of catalog exercise IDs to exclude for the given areas. */
export function excludedExerciseIds(areas: LimitationArea[]): Set<string> {
  const excluded = new Set<string>()
  for (const area of areas) {
    for (const id of AREA_EXCLUSIONS[area]) excluded.add(id)
  }
  return excluded
}

/** True when any affected area means high-impact cardio should be avoided. */
export function affectsLowerBody(areas: LimitationArea[]): boolean {
  return areas.some((a) => LOWER_BODY_AREAS.has(a))
}
