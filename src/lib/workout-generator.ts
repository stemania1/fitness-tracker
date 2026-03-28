import { exercises, type ExerciseDefinition } from "@/data/exercises"

export interface GenerateWorkoutInput {
  goal: "lose_weight" | "build_muscle" | "improve_endurance" | "general_fitness"
  fitnessLevel: "beginner" | "intermediate" | "advanced"
  workoutDays: number
  splitType?: string
  limitations?: string
}

export interface GeneratedExercise {
  exerciseId: string
  name: string
  sets: number
  reps: string
  restSeconds: number
  muscleGroups: string[]
}

export interface GeneratedWorkout {
  name: string
  splitType: string
  estimatedMins: number
  exercises: GeneratedExercise[]
}

const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
}

const GOAL_SCHEME: Record<
  string,
  { sets: number; reps: string; restSeconds: number }
> = {
  lose_weight: { sets: 3, reps: "12-15", restSeconds: 30 },
  build_muscle: { sets: 4, reps: "8-12", restSeconds: 90 },
  improve_endurance: { sets: 2, reps: "15-20", restSeconds: 30 },
  general_fitness: { sets: 3, reps: "10-12", restSeconds: 60 },
}

interface SplitDay {
  name: string
  splitType: string
  muscleGroups: string[][]
  addCardio: boolean
}

function determineSplitDays(
  workoutDays: number,
  goal: string
): SplitDay[] {
  const wantsCardio = goal === "lose_weight" || goal === "improve_endurance"

  if (workoutDays <= 3) {
    const days: SplitDay[] = []
    for (let i = 0; i < workoutDays; i++) {
      days.push({
        name: `Full Body ${String.fromCharCode(65 + i)}`,
        splitType: "full_body",
        muscleGroups: [
          ["chest", "shoulders"],
          ["back"],
          ["quads", "hamstrings", "glutes"],
          ["core"],
        ],
        addCardio: wantsCardio,
      })
    }
    return days
  }

  if (workoutDays === 4) {
    return [
      {
        name: "Upper Body A",
        splitType: "upper",
        muscleGroups: [
          ["chest"],
          ["back"],
          ["shoulders"],
          ["biceps"],
          ["triceps"],
        ],
        addCardio: false,
      },
      {
        name: "Lower Body A",
        splitType: "lower",
        muscleGroups: [
          ["quads"],
          ["hamstrings", "glutes"],
          ["calves"],
        ],
        addCardio: wantsCardio,
      },
      {
        name: "Upper Body B",
        splitType: "upper",
        muscleGroups: [
          ["chest"],
          ["back"],
          ["shoulders"],
          ["biceps"],
          ["triceps"],
        ],
        addCardio: false,
      },
      {
        name: "Lower Body B",
        splitType: "lower",
        muscleGroups: [
          ["quads"],
          ["hamstrings", "glutes"],
          ["calves"],
        ],
        addCardio: wantsCardio,
      },
    ]
  }

  // 5-6 days: push/pull/legs
  const pplBase: SplitDay[] = [
    {
      name: "Push",
      splitType: "push",
      muscleGroups: [["chest"], ["shoulders"], ["triceps"]],
      addCardio: false,
    },
    {
      name: "Pull",
      splitType: "pull",
      muscleGroups: [["back"], ["biceps"]],
      addCardio: false,
    },
    {
      name: "Legs",
      splitType: "legs",
      muscleGroups: [
        ["quads"],
        ["hamstrings", "glutes"],
        ["calves"],
      ],
      addCardio: wantsCardio,
    },
  ]

  if (workoutDays <= 5) {
    // PPL + upper + lower
    return [
      ...pplBase,
      {
        name: "Upper Body",
        splitType: "upper",
        muscleGroups: [
          ["chest"],
          ["back"],
          ["shoulders"],
          ["biceps"],
          ["triceps"],
        ],
        addCardio: false,
      },
      {
        name: "Lower Body",
        splitType: "lower",
        muscleGroups: [
          ["quads"],
          ["hamstrings", "glutes"],
          ["calves"],
        ],
        addCardio: wantsCardio,
      },
    ]
  }

  // 6+ days: PPL x2
  return [
    { ...pplBase[0], name: "Push A" },
    { ...pplBase[1], name: "Pull A" },
    { ...pplBase[2], name: "Legs A" },
    { ...pplBase[0], name: "Push B" },
    { ...pplBase[1], name: "Pull B" },
    { ...pplBase[2], name: "Legs B" },
  ]
}

function filterByDifficulty(
  pool: ExerciseDefinition[],
  fitnessLevel: string
): ExerciseDefinition[] {
  const maxRank = DIFFICULTY_RANK[fitnessLevel] ?? 1
  return pool.filter((e) => (DIFFICULTY_RANK[e.difficulty] ?? 1) <= maxRank)
}

function pickExercises(
  muscleTargets: string[],
  fitnessLevel: string,
  count: number,
  alreadyPicked: Set<string>
): ExerciseDefinition[] {
  const pool = filterByDifficulty(
    exercises.filter(
      (e) =>
        e.exerciseType === "strength" &&
        e.muscleGroups.some((mg) => muscleTargets.includes(mg)) &&
        !alreadyPicked.has(e.id)
    ),
    fitnessLevel
  )

  // Shuffle deterministically by spreading and sorting with pseudo-random
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function pickCardio(
  fitnessLevel: string,
  alreadyPicked: Set<string>
): ExerciseDefinition | null {
  const pool = filterByDifficulty(
    exercises.filter(
      (e) => e.exerciseType === "cardio" && !alreadyPicked.has(e.id)
    ),
    fitnessLevel
  )
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

export function generateWorkout(
  input: GenerateWorkoutInput
): GeneratedWorkout[] {
  const { goal, fitnessLevel, workoutDays } = input
  const scheme = GOAL_SCHEME[goal]
  const splitDays = determineSplitDays(workoutDays, goal)

  return splitDays.map((day) => {
    const picked: Set<string> = new Set()
    const generatedExercises: GeneratedExercise[] = []

    // For each muscle group target, pick 1-2 exercises
    const targetExerciseCount = day.splitType === "full_body" ? 6 : 7
    const perGroup = Math.max(
      1,
      Math.floor(targetExerciseCount / day.muscleGroups.length)
    )

    for (const targets of day.muscleGroups) {
      const selected = pickExercises(targets, fitnessLevel, perGroup, picked)
      for (const ex of selected) {
        picked.add(ex.id)
        generatedExercises.push({
          exerciseId: ex.id,
          name: ex.name,
          sets: scheme.sets,
          reps: scheme.reps,
          restSeconds: scheme.restSeconds,
          muscleGroups: ex.muscleGroups,
        })
      }
    }

    // Cap at 8 strength exercises
    while (generatedExercises.length > 8) {
      generatedExercises.pop()
    }

    // Add cardio at the end for applicable goals
    if (day.addCardio) {
      const cardio = pickCardio(fitnessLevel, picked)
      if (cardio) {
        generatedExercises.push({
          exerciseId: cardio.id,
          name: cardio.name,
          sets: cardio.defaultSets,
          reps: cardio.defaultReps,
          restSeconds: 0,
          muscleGroups: cardio.muscleGroups,
        })
      }
    }

    // Ensure minimum of 6
    if (generatedExercises.length < 6) {
      const extraTargets = day.muscleGroups.flat()
      const extras = pickExercises(
        extraTargets,
        fitnessLevel,
        6 - generatedExercises.length,
        picked
      )
      for (const ex of extras) {
        picked.add(ex.id)
        generatedExercises.push({
          exerciseId: ex.id,
          name: ex.name,
          sets: scheme.sets,
          reps: scheme.reps,
          restSeconds: scheme.restSeconds,
          muscleGroups: ex.muscleGroups,
        })
      }
    }

    // Estimate duration: ~3 min per set for strength, plus cardio time
    const strengthSets = generatedExercises
      .filter((e) => e.restSeconds > 0)
      .reduce((sum, e) => sum + e.sets, 0)
    const cardioMins = generatedExercises.some((e) => e.restSeconds === 0)
      ? 20
      : 0
    const estimatedMins = Math.round(strengthSets * 2.5 + cardioMins)

    return {
      name: day.name,
      splitType: day.splitType,
      estimatedMins,
      exercises: generatedExercises,
    }
  })
}
