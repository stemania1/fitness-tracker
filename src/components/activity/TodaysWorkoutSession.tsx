"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle, Moon, ArrowLeft } from "lucide-react"
import { todaysWorkout } from "@/lib/todays-workout"

const supabase = createClient()

/** Local YYYY-MM-DD for the storage key and started_at. */
function localDay(): string {
  return new Date().toLocaleDateString("en-CA")
}

export function TodaysWorkoutSession() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const workout = useMemo(() => todaysWorkout(new Date()), [])

  const storageKey = `todays-workout:${localDay()}:${workout.title}`
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [startedAt, setStartedAt] = useState<string | null>(null)

  // Restore progress + start time (survives a mid-workout reload).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw) as {
          checked?: string[]
          startedAt?: string
        }
        if (saved.checked) setChecked(new Set(saved.checked))
        if (saved.startedAt) {
          setStartedAt(saved.startedAt)
          return
        }
      }
      const now = new Date().toISOString()
      setStartedAt(now)
      localStorage.setItem(storageKey, JSON.stringify({ checked: [], startedAt: now }))
    } catch {
      setStartedAt(new Date().toISOString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ checked: [...next], startedAt })
        )
      } catch {
        // ignore storage failures — in-memory state still works
      }
      return next
    })
  }

  const doneCount = workout.items.filter((i) => checked.has(i.id)).length
  const total = workout.items.length

  const finishMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const start = startedAt ?? new Date().toISOString()
      const finished = new Date().toISOString()
      const durationMins = Math.max(
        1,
        Math.round((Date.parse(finished) - Date.parse(start)) / 60000)
      )

      const { error } = await supabase.from("workout_logs").insert({
        user_id: user.id,
        name: workout.title,
        started_at: start,
        finished_at: finished,
        duration_mins: durationMins,
        notes: `Completed ${doneCount} of ${total} items from the plan.`,
      })
      if (error) throw error
    },
    onSuccess: () => {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // ignore
      }
      queryClient.invalidateQueries({ queryKey: ["weekly-workouts"] })
      queryClient.invalidateQueries({ queryKey: ["workout-logs-all"] })
      queryClient.invalidateQueries({ queryKey: ["recent-workouts"] })
      router.push("/dashboard")
    },
  })

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Today&apos;s Workout</h1>
      </div>

      {workout.isRest ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Moon className="h-8 w-8 text-gray-300" />
            <p className="font-semibold text-gray-900">Rest day</p>
            <p className="max-w-xs text-sm text-gray-500">
              {workout.items.length === 0 &&
                (workout.title === "Rest"
                  ? "Nothing prescribed today — recover. Optional grease-the-groove sets or an easy walk if you feel like it."
                  : "")}
            </p>
            <Link
              href="/dashboard"
              className="mt-2 text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{workout.title}</CardTitle>
                <Badge className="bg-purple-100 text-purple-700">
                  {workout.week != null ? `Week ${workout.week}` : "Bonus"}
                  {workout.phaseLabel ? ` · ${workout.phaseLabel}` : ""}
                </Badge>
              </div>
              {workout.time && (
                <p className="text-xs text-gray-500">
                  {workout.time} · {workout.durationMins} min
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {workout.sessionNote && (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  {workout.sessionNote}
                </p>
              )}
              {workout.isDeload && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Deload week — recover, don&apos;t chase numbers.
                </p>
              )}
              {workout.testTitle && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {workout.testTitle} — log results via Log Test on the
                  dashboard.
                </p>
              )}

              <div className="flex items-center gap-3">
                <Progress
                  value={total > 0 ? (doneCount / total) * 100 : 0}
                  className="h-2 flex-1"
                />
                <span className="shrink-0 text-sm font-medium text-gray-600">
                  {doneCount}/{total}
                </span>
              </div>

              <ul className="space-y-2">
                {workout.items.map((item) => {
                  const isChecked = checked.has(item.id)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => toggle(item.id)}
                        aria-pressed={isChecked}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          isChecked
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {isChecked ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />
                        )}
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              isChecked
                                ? "text-gray-500 line-through"
                                : "text-gray-900"
                            }`}
                          >
                            {item.label}
                          </p>
                          {item.detail && (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {item.detail}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          {finishMutation.isError && (
            <p className="text-sm text-red-600">
              {(finishMutation.error as Error).message}
            </p>
          )}

          {/* Sticky finish bar for one-handed gym use */}
          <div className="fixed inset-x-0 bottom-16 z-10 border-t border-gray-200 bg-white/95 p-3 backdrop-blur">
            <button
              onClick={() => finishMutation.mutate()}
              disabled={finishMutation.isPending}
              className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {finishMutation.isPending
                ? "Saving…"
                : doneCount === total && total > 0
                  ? "Finish workout ✓"
                  : `Finish workout (${doneCount}/${total})`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
