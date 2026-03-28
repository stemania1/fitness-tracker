"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Plus,
  Dumbbell,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  ListOrdered,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/utils"

interface WorkoutLogEntry {
  id: string
  name: string
  started_at: string
  duration_mins: number | null
  exercise_count: number
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
}

export default function ActivityPage() {
  const [tab, setTab] = useState<"history" | "calendar">("history")
  const [logs, setLogs] = useState<WorkoutLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  useEffect(() => {
    async function fetchLogs() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: workoutLogs } = await supabase
        .from("workout_logs")
        .select("id, name, started_at, duration_mins")
        .eq("user_id", user.id)
        .not("finished_at", "is", null)
        .order("started_at", { ascending: false })

      if (!workoutLogs) {
        setLoading(false)
        return
      }

      // Get exercise counts per workout
      const logIds = workoutLogs.map((l) => l.id)
      const { data: exerciseLogs } = await supabase
        .from("exercise_logs")
        .select("id, workout_log_id")
        .in("workout_log_id", logIds.length > 0 ? logIds : ["__none__"])

      const countMap = new Map<string, number>()
      exerciseLogs?.forEach((el) => {
        countMap.set(el.workout_log_id, (countMap.get(el.workout_log_id) ?? 0) + 1)
      })

      setLogs(
        workoutLogs.map((l) => ({
          id: l.id,
          name: l.name,
          started_at: l.started_at,
          duration_mins: l.duration_mins,
          exercise_count: countMap.get(l.id) ?? 0,
        }))
      )
      setLoading(false)
    }
    fetchLogs()
  }, [])

  // Calendar data
  const workoutDays = useMemo(() => {
    const days = new Set<string>()
    logs.forEach((l) => {
      const d = new Date(l.started_at)
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
    })
    return days
  }, [logs])

  const calendarGrid = useMemo(() => {
    const { year, month } = calendarMonth
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const rows: (number | null)[][] = []
    let row: (number | null)[] = []

    for (let i = 0; i < firstDay; i++) row.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      row.push(d)
      if (row.length === 7) {
        rows.push(row)
        row = []
      }
    }
    if (row.length > 0) {
      while (row.length < 7) row.push(null)
      rows.push(row)
    }
    return rows
  }, [calendarMonth])

  const prevMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const nextMonth = () => {
    setCalendarMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 }
      return { ...prev, month: prev.month + 1 }
    })
  }

  const today = new Date()

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Activity</h1>

      {/* Tab toggle */}
      <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setTab("history")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
            tab === "history"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <ListOrdered className="h-4 w-4" />
          History
        </button>
        <button
          onClick={() => setTab("calendar")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
            tab === "calendar"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          Calendar
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      ) : tab === "history" ? (
        /* History tab */
        logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Dumbbell className="mb-3 h-12 w-12 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">
              No workouts logged yet
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Start your first workout to see your history here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <Link key={log.id} href={`/activity/${log.id}`}>
                <Card className="transition-colors active:bg-gray-50 hover:border-purple-200">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">
                        {log.name}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        {formatDate(log.started_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-sm text-gray-500">
                      {log.duration_mins != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDuration(log.duration_mins)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Dumbbell className="h-3.5 w-3.5" />
                        {log.exercise_count}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : (
        /* Calendar tab */
        <Card>
          <CardContent className="p-4">
            {/* Month navigation */}
            <div className="mb-4 flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-sm font-semibold text-gray-900">
                {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
              </span>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Day headers */}
            <div className="mb-2 grid grid-cols-7 text-center">
              {DAY_NAMES.map((d) => (
                <span
                  key={d}
                  className="text-xs font-medium text-gray-400"
                >
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar grid */}
            {calendarGrid.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 text-center">
                {row.map((day, ci) => {
                  if (day === null)
                    return <div key={ci} className="py-2" />

                  const hasWorkout = workoutDays.has(
                    `${calendarMonth.year}-${calendarMonth.month}-${day}`
                  )
                  const isToday =
                    calendarMonth.year === today.getFullYear() &&
                    calendarMonth.month === today.getMonth() &&
                    day === today.getDate()

                  return (
                    <div
                      key={ci}
                      className="flex flex-col items-center py-2"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-sm",
                          isToday && "font-bold text-purple-600",
                          hasWorkout &&
                            "bg-purple-100 font-semibold text-purple-700"
                        )}
                      >
                        {day}
                      </span>
                      {hasWorkout && (
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-500" />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {logs.length === 0 && (
              <p className="mt-4 text-center text-sm text-gray-400">
                No workouts this month
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Floating action button */}
      <Link href="/activity/log">
        <Button
          size="lg"
          className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg shadow-purple-200"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Log Workout</span>
        </Button>
      </Link>
    </div>
  )
}
