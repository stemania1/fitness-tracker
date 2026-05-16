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
          ["biceps"],
          ["triceps"],
          ["core"],
        ],
        addCardio: true,
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
        addCardio: true,
      },
      {
        name: "Lower Body A",
        splitType: "lower",
        muscleGroups: [
          ["quads"],
          ["hamstrings", "glutes"],
          ["calves"],
          ["core"],
        ],
        addCardio: true,
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
        addCardio: true,
      },
      {
        name: "Lower Body B",
        splitType: "lower",
        muscleGroups: [
          ["quads"],
          ["hamstrings", "glutes"],
          ["calves"],
          ["core"],
        ],
        addCardio: true,
      },
    ]
  }

  // 5-6 days: push/pull/legs
  const pplBase: SplitDay[] = [
    {
      name: "Push",
      splitType: "push",
      muscleGroups: [["chest"], ["shoulders"], ["triceps"]],
      addCardio: true,
    },
    {
      name: "Pull",
      splitType: "pull",
      muscleGroups: [["back"], ["biceps"]],
      addCardio: true,
    },
    {
      name: "Legs",
      splitType: "legs",
      muscleGroups: [
        ["quads"],
        ["hamstrings", "glutes"],
        ["calves"],
        ["core"],
      ],
      addCardio: true,
    },
  ]

  if (workoutDays <= 5) {
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
        addCardio: true,
      },
      {
        name: "Lower Body",
        splitType: "lower",
        muscleGroups: [
          ["quads"],
          ["hamstrings", "glutes"],
          ["calves"],
          ["core"],
        ],
        addCardio: true,
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

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
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

  return shuffle(pool).slice(0, count)
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

function pickCalisthenics(
  muscleTargets: string[],
  fitnessLevel: string,
  count: number,
  alreadyPicked: Set<string>
): ExerciseDefinition[] {
  const bodyweightIds = [
    "push-ups",
    "plank",
    "mountain-climbers",
    "bicycle-crunches",
    "dead-bug",
  ]
  const pool = filterByDifficulty(
    exercises.filter(
      (e) =>
        bodyweightIds.includes(e.id) &&
        !alreadyPicked.has(e.id) &&
        e.muscleGroups.some((mg) => muscleTargets.includes(mg))
    ),
    fitnessLevel
  )

  return shuffle(pool).slice(0, count)
}

function generateExpressWorkout(
  fitnessLevel: string
): GeneratedWorkout {
  const picked: Set<string> = new Set()
  const generatedExercises: GeneratedExercise[] = []

  // Express circuit: 5-6 compound exercises covering major muscle groups + 1 cardio finisher
  // Prioritize compound movements that hit multiple muscle groups
  const circuitTargets: string[][] = [
    ["chest", "triceps", "shoulders"],  // upper push (compound)
    ["back", "biceps"],                 // upper pull (compound)
    ["quads", "hamstrings", "glutes"],  // lower body (compound)
    ["shoulders", "triceps"],           // shoulders
    ["core"],                           // core
  ]

  for (const targets of circuitTargets) {
    // Prefer compound exercises (those with 2+ muscle groups)
    const pool = filterByDifficulty(
      exercises.filter(
        (e) =>
          e.exerciseType === "strength" &&
          e.muscleGroups.some((mg) => targets.includes(mg)) &&
          !picked.has(e.id)
      ),
      fitnessLevel
    )

    // Sort so compound movements (more muscle groups) come first
    const sorted = [...pool].sort(
      (a, b) => b.muscleGroups.length - a.muscleGroups.length
    )
    const shuffledCompounds = shuffle(
      sorted.filter((e) => e.muscleGroups.length >= 2)
    )
    const fallback = shuffle(sorted)
    const pick = shuffledCompounds[0] ?? fallback[0]

    if (pick) {
      picked.add(pick.id)
      generatedExercises.push({
        exerciseId: pick.id,
        name: pick.name,
        sets: 3,
        reps: "10-12",
        restSeconds: 30,
        muscleGroups: pick.muscleGroups,
      })
    }
  }

  // Add one cardio finisher (short burst, not a long session)
  const cardio = pickCardio(fitnessLevel, picked)
  if (cardio) {
    picked.add(cardio.id)
    generatedExercises.push({
      exerciseId: cardio.id,
      name: cardio.name,
      sets: 1,
      reps: "5-8 min",
      restSeconds: 0,
      muscleGroups: cardio.muscleGroups,
    })
  }

  return {
    name: "Express 30-Minute Circuit",
    splitType: "express",
    estimatedMins: 30,
    exercises: generatedExercises,
  }
}

export function generateWorkout(
  input: GenerateWorkoutInput
): GeneratedWorkout[] {
  const { goal, fitnessLevel, workoutDays, splitType } = input

  // Handle express circuit as a standalone workout
  if (splitType === "express") {
    return [generateExpressWorkout(fitnessLevel)]
  }

  const scheme = GOAL_SCHEME[goal]
  const splitDays = determineSplitDays(workoutDays, goal)

  return splitDays.map((day) => {
    const picked: Set<string> = new Set()
    const generatedExercises: GeneratedExercise[] = []

    // For each muscle group target, pick 1-2 exercises
    const targetExerciseCount = day.splitType === "full_body" ? 5 : 6
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

    // Cap at 7 machine/weight exercises to leave room for calisthenics + cardio
    while (generatedExercises.length > 7) {
      generatedExercises.pop()
    }

    // Add 1-2 calisthenics exercises
    const calisthenicsMuscles = day.muscleGroups.flat()
    // Always try to include a core bodyweight exercise
    calisthenicsMuscles.push("core", "chest")
    const calisthenicsCount = goal === "improve_endurance" || goal === "lose_weight" ? 2 : 1
    const calisthenics = pickCalisthenics(
      calisthenicsMuscles,
      fitnessLevel,
      calisthenicsCount,
      picked
    )
    for (const ex of calisthenics) {
      picked.add(ex.id)
      generatedExercises.push({
        exerciseId: ex.id,
        name: ex.name,
        sets: scheme.sets,
        reps: ex.defaultReps,
        restSeconds: scheme.restSeconds,
        muscleGroups: ex.muscleGroups,
      })
    }

    // Always add cardio (running/treadmill preferred)
    const cardio = pickCardio(fitnessLevel, picked)
    if (cardio) {
      picked.add(cardio.id)
      const cardioDuration =
        goal === "lose_weight" || goal === "improve_endurance"
          ? "25-30 min"
          : "15-20 min"
      generatedExercises.push({
        exerciseId: cardio.id,
        name: cardio.name,
        sets: 1,
        reps: cardioDuration,
        restSeconds: 0,
        muscleGroups: cardio.muscleGroups,
      })
    }

    // Estimate duration
    const strengthSets = generatedExercises
      .filter((e) => e.restSeconds > 0)
      .reduce((sum, e) => sum + e.sets, 0)
    const hasCardio = generatedExercises.some((e) => e.restSeconds === 0)
    const cardioMins = hasCardio ? 20 : 0
    const estimatedMins = Math.round(strengthSets * 2.5 + cardioMins)

    return {
      name: day.name,
      splitType: day.splitType,
      estimatedMins,
      exercises: generatedExercises,
    }
  })
}
