"use client"

import { useMemo } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarCheck, ClipboardCheck, Dumbbell, Flame } from "lucide-react"
import {
  PLAN_PHASES,
  PLAN_TESTS,
  PLAN_WEEKS,
  PLAN_START_DATE,
  WEEKLY_SCHEDULE,
} from "@/data/training-plan"
import { planWeekNumber } from "@/lib/training-plan"
import { AddPlanTemplates } from "@/components/workouts/AddPlanTemplates"

/** Display order Monday → Sunday, as Date.getDay() indices. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const typeDot: Record<string, string> = {
  cardio: "bg-cyan-500",
  strength: "bg-purple-500",
  rest: "bg-gray-300",
}

export default function PlanPage() {
  const today = useMemo(() => new Date(), [])
  const currentWeek = planWeekNumber(today)
  const todayDow = today.getDay()

  const planStartLabel = useMemo(() => {
    const [y, m, d] = PLAN_START_DATE.split("-").map(Number)
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Training Plan</h1>
        {currentWeek != null ? (
          <Badge className="bg-purple-100 text-purple-700">
            Week {currentWeek} of {PLAN_WEEKS}
          </Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-600">
            {new Date() < new Date(PLAN_START_DATE) ? "Starts soon" : "Complete"}
          </Badge>
        )}
      </div>

      <p className="text-sm text-gray-600">
        12 weeks to a higher VO2 Max and more pull-ups, starting{" "}
        {planStartLabel}. Two short weekday mornings, two longer weekend
        sessions, everything on Planet Fitness equipment. Full write-up lives
        in <code className="text-xs">docs/training-plan-vo2max-pullups.md</code>.
      </p>

      <AddPlanTemplates />

      {/* Weekly schedule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-5 w-5 text-purple-500" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {DAY_ORDER.map((dow) => {
            const session = WEEKLY_SCHEDULE[dow]
            const isToday = dow === todayDow
            return (
              <div
                key={dow}
                className={`rounded-lg border p-3 ${
                  isToday
                    ? "border-purple-300 bg-purple-50"
                    : "border-gray-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${typeDot[session.type]}`}
                  />
                  <span className="w-10 text-sm font-semibold text-gray-900">
                    {DAY_LABELS[dow]}
                  </span>
                  <span className="text-sm text-gray-900">{session.title}</span>
                  {session.time && (
                    <span className="ml-auto shrink-0 text-xs text-gray-500">
                      {session.time} · {session.durationMins} min
                    </span>
                  )}
                  {isToday && !session.time && (
                    <span className="ml-auto shrink-0 text-xs font-medium text-purple-600">
                      Today
                    </span>
                  )}
                </div>
                <ul className="ml-4 mt-1 space-y-0.5 text-xs text-gray-500">
                  {session.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Progression phases */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-5 w-5 text-orange-500" />
            Progression
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PLAN_PHASES.map((phase) => {
            const isCurrent =
              currentWeek != null &&
              currentWeek >= phase.fromWeek &&
              currentWeek <= phase.toWeek
            return (
              <div
                key={phase.label}
                className={`rounded-lg border p-3 ${
                  isCurrent ? "border-orange-300 bg-orange-50" : "border-gray-100"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">
                  {phase.label}{" "}
                  <span className="font-normal text-gray-500">
                    · week{phase.fromWeek === phase.toWeek ? "" : "s"}{" "}
                    {phase.fromWeek}
                    {phase.fromWeek === phase.toWeek ? "" : `-${phase.toWeek}`}
                  </span>
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                  <li>4×4 intervals: {phase.fourByFourRounds}</li>
                  <li>30/30s: {phase.thirtyThirtyReps}</li>
                  <li>Pull work: {phase.pullNote}</li>
                </ul>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Tests */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-emerald-500" />
            Tests &amp; Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PLAN_TESTS.map((test) => (
            <div
              key={test.week}
              className={`rounded-lg border p-3 ${
                currentWeek === test.week
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-100"
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">
                {test.title}{" "}
                <span className="font-normal text-gray-500">
                  · week {test.week}
                </span>
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                {test.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="pt-1 text-xs text-gray-500">
            <Dumbbell className="mr-1 inline h-3.5 w-3.5" />
            Every pound of body weight lost is a pound less to pull — a small
            deficit or maintenance is the sweet spot while chasing intervals.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
