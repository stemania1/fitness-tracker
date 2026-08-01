"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarRange, Dumbbell, Timer, Moon } from "lucide-react"
import { buildWeeklySchedule } from "@/lib/weekly-schedule"
import { useProfile } from "@/hooks/useProfile"
import { CARD_ACCENTS } from "@/lib/constants"

const supabase = createClient()

const kindStyle = {
  strength: { icon: Dumbbell, cls: "text-purple-500" },
  long: { icon: Timer, cls: "text-gray-400" },
  rest: { icon: Moon, cls: "text-gray-300" },
} as const

/**
 * A realistic week built from the time you actually have: short weekday
 * sessions (with a post-wake slot when a wake time is known) and the longer
 * work on weekends. Complements the fixed 12-week plan.
 */
export function WeeklyScheduleCard() {
  const { data: profile, isLoading } = useProfile()

  const schedule = profile
    ? buildWeeklySchedule({
        workoutDays: profile.workout_days ?? 3,
        weekdayMinutes: profile.weekday_workout_minutes ?? 25,
        weekendMinutes: profile.weekend_workout_minutes ?? 60,
        wakeTime: profile.wake_time,
      })
    : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className={`h-5 w-5 ${CARD_ACCENTS.brand}`} />
            Your Realistic Week
          </CardTitle>
          {schedule && (
            <span className="text-xs text-gray-500">
              {Math.round(schedule.totalMinutes / 5) * 5} min total
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !schedule ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">{schedule.summary}</p>

            <ul className="space-y-1">
              {schedule.days.map((d) => {
                const { icon: Icon, cls } = kindStyle[d.kind]
                const isRest = d.kind === "rest"
                return (
                  <li
                    key={d.day}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm ${
                      isRest ? "bg-transparent" : "bg-gray-50"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${cls}`} />
                    <span
                      className={`w-20 shrink-0 ${isRest ? "text-gray-400" : "font-medium text-gray-900"}`}
                    >
                      {d.dayName}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate ${isRest ? "text-gray-400" : "text-gray-700"}`}
                    >
                      {d.label}
                    </span>
                    {d.suggestedTime && (
                      <span className="shrink-0 text-xs text-gray-500">
                        {d.suggestedTime}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>

            <p className="text-[11px] text-gray-400">
              Built from your workout days and available time.{" "}
              <Link
                href="/profile"
                className="font-medium text-purple-700 hover:underline"
              >
                Adjust in profile
              </Link>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
