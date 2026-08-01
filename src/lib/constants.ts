export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "core",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "full_body",
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const FITNESS_LEVELS = [
  { value: "beginner", label: "Beginner", description: "New to working out or returning after a long break" },
  { value: "intermediate", label: "Intermediate", description: "Consistent training for 6+ months" },
  { value: "advanced", label: "Advanced", description: "Consistent training for 2+ years with solid form" },
] as const

export type FitnessLevel = (typeof FITNESS_LEVELS)[number]["value"]

export const GOALS = [
  { value: "lose_weight", label: "Lose Weight", description: "Burn fat and reduce body weight" },
  { value: "build_muscle", label: "Build Muscle", description: "Increase muscle mass and strength" },
  { value: "improve_endurance", label: "Improve Endurance", description: "Boost cardiovascular fitness and stamina" },
  { value: "general_fitness", label: "General Fitness", description: "Stay active and maintain overall health" },
] as const

export type Goal = (typeof GOALS)[number]["value"]

export const SPLIT_TYPES = [
  { value: "full_body", label: "Full Body", description: "Hit every major muscle group each session" },
  { value: "upper", label: "Upper Body", description: "Chest, back, shoulders, and arms" },
  { value: "lower", label: "Lower Body", description: "Quads, hamstrings, glutes, and calves" },
  { value: "push", label: "Push", description: "Chest, shoulders, and triceps" },
  { value: "pull", label: "Pull", description: "Back and biceps" },
  { value: "legs", label: "Legs", description: "Full lower body focus" },
  { value: "cardio", label: "Cardio", description: "Cardiovascular and endurance training" },
  { value: "express", label: "Express (30 min)", description: "Quick full-body circuit for busy days" },
] as const

export type SplitType = (typeof SPLIT_TYPES)[number]["value"]

export const RPE_SCALE = [
  { value: 1, label: "1 - Very Light", description: "Barely any effort" },
  { value: 2, label: "2 - Light", description: "Comfortable, could do this all day" },
  { value: 3, label: "3 - Light-Moderate", description: "Easy effort, breathing normally" },
  { value: 4, label: "4 - Moderate", description: "Starting to feel it" },
  { value: 5, label: "5 - Moderate", description: "Challenging but manageable" },
  { value: 6, label: "6 - Moderate-Hard", description: "Could do 4 more reps" },
  { value: 7, label: "7 - Hard", description: "Could do 3 more reps" },
  { value: 8, label: "8 - Hard", description: "Could do 2 more reps" },
  { value: 9, label: "9 - Very Hard", description: "Could do 1 more rep" },
  { value: 10, label: "10 - Maximum", description: "Absolute failure, nothing left" },
] as const

export const REST_TIMES = {
  lose_weight: { seconds: 30, label: "30s", description: "Short rest to keep heart rate elevated" },
  build_muscle: { seconds: 90, label: "90s", description: "Moderate rest for hypertrophy" },
  improve_endurance: { seconds: 30, label: "30s", description: "Minimal rest for conditioning" },
  general_fitness: { seconds: 60, label: "60s", description: "Balanced rest periods" },
  strength: { seconds: 180, label: "3 min", description: "Full recovery for heavy lifts" },
} as const

export const EQUIPMENT_CATEGORIES = [
  { value: "cardio", label: "Cardio" },
  { value: "strength_machine", label: "Strength Machine" },
  { value: "free_weight", label: "Free Weight" },
  { value: "cable", label: "Cable" },
  { value: "other", label: "Other" },
] as const

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number]["value"]

export const EXERCISE_TYPES = [
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardio" },
  { value: "flexibility", label: "Flexibility" },
] as const

export type ExerciseType = (typeof EXERCISE_TYPES)[number]["value"]

export const DEFAULT_WORKOUT_DAYS = 3
export const MIN_WORKOUT_DAYS = 1
export const MAX_WORKOUT_DAYS = 7

export const PF_DUMBBELL_MAX_WEIGHT = 75
export const PF_FIXED_BARBELL_MAX_WEIGHT = 60

// ── Card accents ────────────────────────────────────────────────────────
//
// Card header icons had drifted to seventeen distinct hues across
// twenty-six cards — purple, orange, indigo, amber, teal, rose, cyan, blue,
// yellow, violet, lime, red, emerald — so the dashboard read as a pile of
// unrelated widgets rather than one product.
//
// The rule: colour means something, or it means nothing. Four semantic
// tokens carry meaning; everything else is neutral, because a card's
// identity comes from its title and icon shape, not its hue. That keeps the
// coloured cards genuinely scannable — if every card is coloured, none is.

export const CARD_ACCENTS = {
  /** Actions and the plan — the things you're meant to do. */
  brand: "text-purple-600",
  /** Achievement: streaks, records, goals moving the right way. */
  progress: "text-emerald-600",
  /** Worth a look: nudges, watch-this readings. */
  attention: "text-amber-600",
  /** Something is wrong or needs care. */
  danger: "text-red-600",
  /** The default. Identity only, no signal. */
  neutral: "text-gray-400",
} as const

export type CardAccent = keyof typeof CARD_ACCENTS

/**
 * Chip / pill backgrounds, for the same four meanings plus neutral.
 *
 * Every classification scale in the app had independently invented its own
 * middle stop — "medium" confidence was blue, "average" VO2 was blue,
 * "moderate" energy was sky, "moderate" readiness was blue. A scale needs
 * steps, not new hues: not-yet / getting-there / good reads perfectly well as
 * neutral / attention / progress.
 */
export const CHIP_TONES = {
  brand: "bg-purple-100 text-purple-700",
  progress: "bg-emerald-100 text-emerald-700",
  attention: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  neutral: "bg-gray-100 text-gray-600",
} as const

/** The softer variant, for panels and inline callouts rather than pills. */
export const PANEL_TONES = {
  brand: "bg-purple-50 text-purple-700",
  progress: "bg-emerald-50 text-emerald-700",
  attention: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  neutral: "bg-gray-50 text-gray-600",
} as const

/**
 * Macro colours — categorical, not semantic.
 *
 * The tokens above encode *meaning* (good / watch / wrong). A stacked macro
 * bar needs the opposite: hues whose only job is to be told apart, with no
 * implication that fat is worse than protein. Flattening these to neutral
 * would make the bar unreadable, so they stay distinct — but they live here,
 * named, rather than being invented inline per component.
 *
 * Anything outside a macro breakdown should use CHIP_TONES instead.
 */
export const MACRO_TONES = {
  protein: { chip: "bg-rose-50 text-rose-700", bar: "bg-rose-400", text: "text-rose-700" },
  carbs: { chip: "bg-amber-50 text-amber-700", bar: "bg-amber-400", text: "text-amber-700" },
  fat: { chip: "bg-sky-50 text-sky-700", bar: "bg-sky-400", text: "text-sky-700" },
  sugar: { chip: "bg-fuchsia-50 text-fuchsia-700", bar: "bg-fuchsia-400", text: "text-fuchsia-700" },
} as const
