"use client"

import { Trophy, Lock } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface MilestoneDefinition {
  id: string
  title: string
  description: string
  check: (data: MilestoneData) => boolean
  getDate: (data: MilestoneData) => string | null
}

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

const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  {
    id: "first-workout",
    title: "First Workout",
    description: "Completed your first workout log",
    check: (data) => data.workoutCount >= 1,
    getDate: (data) => data.firstWorkoutDate,
  },
  {
    id: "ten-workouts",
    title: "10 Workouts",
    description: "Completed 10 workout logs",
    check: (data) => data.workoutCount >= 10,
    getDate: (data) => data.tenthWorkoutDate,
  },
  {
    id: "new-pr",
    title: "New PR",
    description: "Set a new personal record",
    check: (data) => data.hasNewPR,
    getDate: (data) => data.prDate,
  },
  {
    id: "goal-achieved",
    title: "Goal Achieved",
    description: "Completed a fitness goal",
    check: (data) => data.goalsAchievedCount >= 1,
    getDate: (data) => data.firstGoalAchievedDate,
  },
  {
    id: "four-week-streak",
    title: "4 Week Streak",
    description: "Maintained consistency for 4 weeks",
    check: (data) => data.streakLength >= 4,
    getDate: (data) => data.fourWeekStreakDate,
  },
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface MilestonesProps {
  data: MilestoneData
}

export default function Milestones({ data }: MilestonesProps) {
  const milestones = MILESTONE_DEFINITIONS.map((def) => ({
    ...def,
    achieved: def.check(data),
    dateAchieved: def.getDate(data),
  }))

  const achievedCount = milestones.filter((m) => m.achieved).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Milestones
          <span className="ml-auto text-sm font-normal text-gray-500">
            {achievedCount} / {milestones.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                milestone.achieved
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-gray-100 bg-gray-50 opacity-60"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  milestone.achieved
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {milestone.achieved ? (
                  <Trophy className="h-5 w-5" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    milestone.achieved ? "text-emerald-900" : "text-gray-500"
                  }`}
                >
                  {milestone.title}
                </p>
                <p className="text-xs text-gray-500">{milestone.description}</p>
              </div>
              {milestone.achieved && milestone.dateAchieved && (
                <span className="shrink-0 text-xs text-emerald-600">
                  {formatDate(milestone.dateAchieved)}
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
