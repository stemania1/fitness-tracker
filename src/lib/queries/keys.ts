/**
 * Every React Query cache key in the app, in one place.
 *
 * A key is a contract: whoever mounts first decides what everyone else reads.
 * When the same key was written out at several call sites, the definitions
 * drifted — `["workout-logs-all"]` existed three times with two different
 * `select()` lists, so navigating dashboard → goals silently handed the goals
 * page rows that were missing a column it had asked for. Nothing broke, but
 * only because the extra column happened to be unused.
 *
 * Declaring the keys here doesn't stop two call sites projecting different
 * columns, but it does put them next to each other where the mismatch is
 * visible, and it makes "who else uses this key?" a definition lookup rather
 * than a grep for a string literal.
 */
export const queryKeys = {
  authUser: ["auth-user"] as const,
  profile: ["profile"] as const,
  profileStats: ["profile-stats"] as const,

  // Workouts
  workoutLogsAll: ["workout-logs-all"] as const,
  /** The Activity page's finished-workout history, with exercise counts. */
  workoutHistory: ["workout-history"] as const,
  recentWorkouts: ["recent-workouts"] as const,
  workoutDetail: (id: string) => ["workout-detail", id] as const,
  weeklyWorkouts: (weekStart: string) => ["weekly-workouts", weekStart] as const,
  weeklyCalories: (weekStart: string, weightLbs: number) =>
    ["weekly-calories", weekStart, weightLbs] as const,
  workoutTemplates: ["workout-templates"] as const,
  workoutTemplate: (id: string) => ["workout-template", id] as const,
  planPresetTemplates: ["plan-preset-templates"] as const,
  allStrengthSets: ["all-strength-sets"] as const,
  setLogsAll: ["set-logs-all"] as const,
  exerciseHistory: (staticId: string) => ["exercise-history", staticId] as const,

  // Plan
  planAdaptationWorkouts: ["plan-adaptation-workouts"] as const,
  planAdaptationTests: ["plan-adaptation-tests"] as const,

  // Daily logs. Each is keyed by the local day it describes so day-navigating
  // cards get their own cache entry per day rather than fighting over one.
  foodLogsToday: (dayStartIso: string) => ["food-logs-today", dayStartIso] as const,
  caffeineToday: (dayStartIso: string) => ["caffeine-today", dayStartIso] as const,
  creatineLogs: (day: string) => ["creatine-logs", day] as const,
  energyCheckins: (day: string) => ["energy-checkins", day] as const,
  hungerLogs: ["hunger-logs"] as const,
  weightLogs: ["weight-logs"] as const,
  weightLogsRecent: ["weight-logs-recent"] as const,
  lastWeighIn: ["last-weigh-in"] as const,

  // Goals
  userGoals: ["user-goals"] as const,
  goalExerciseBests: ["goal-exercise-bests"] as const,

  // Oura
  ouraSummary: ["oura-summary"] as const,
  ouraConnected: ["oura-connected"] as const,
  ouraSync: (day: string) => ["oura-sync", day] as const,
  ouraTrend: (windowDays: number) => ["oura-trend", windowDays] as const,
  ouraMetrics: (days: number) => ["oura-metrics", days] as const,
  ouraVo2History: ["oura-vo2-history"] as const,

  // Movement. Keyed by window because the card and any future longer view
  // read different spans of the stored Oura history.
  movementHistory: (windowDays: number) =>
    ["movement-history", windowDays] as const,

  // Derived / analytical
  weeklyDigest: ["weekly-digest"] as const,
  muscleBalance: (windowDays: number) => ["muscle-balance", windowDays] as const,
  energyDrivers: (windowDays: number) => ["energy-drivers", windowDays] as const,
  energyBalance: (windowDays: number) => ["energy-balance", windowDays] as const,
  sessionRecap: (startedAt: string, uuids: string) =>
    ["session-recap", startedAt, uuids] as const,
} as const
