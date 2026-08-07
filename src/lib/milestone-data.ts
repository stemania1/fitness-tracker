/**
 * Assemble the Milestones component's input from raw logs — first/tenth
 * workout dates, achieved-goal counts, and the four-week-streak marker.
 * Extracted from the goals page; pure, with `now` injectable for tests.
 */

export interface MilestoneData {
  workoutCount: number
  firstWorkoutDate: string | null
  tenthWorkoutDate: string | null
  hasNewPR: boolean
  prDate: string | null
  goalsAchievedCount: number
  firstGoalAchievedDate: string | null
  streakLength: number
  fourWeekStreakDate: string | null
}

export function buildMilestoneData(
  workoutLogs: { started_at: string }[],
  goals: { achieved_at: string | null }[],
  streakLength: number,
  now: Date = new Date()
): MilestoneData {
  const sorted = [...workoutLogs].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )

  const achievedGoals = goals.filter((g) => g.achieved_at)

  return {
    workoutCount: workoutLogs.length,
    firstWorkoutDate: sorted[0]?.started_at ?? null,
    tenthWorkoutDate: sorted[9]?.started_at ?? null,
    hasNewPR: false, // determined externally if needed
    prDate: null,
    goalsAchievedCount: achievedGoals.length,
    firstGoalAchievedDate: achievedGoals[0]?.achieved_at ?? null,
    streakLength,
    fourWeekStreakDate: streakLength >= 4 ? now.toISOString() : null,
  }
}
