"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Pill, Check, Flame, Undo2 } from "lucide-react"
import { localToday, daysAgoDateString } from "@/lib/dates"
import {
  currentStreak,
  creatineProgress,
  CREATINE_DOSE_OPTIONS,
  DEFAULT_CREATINE_TARGET_G,
} from "@/lib/creatine-streak"
import { useUserQuery, getAuthUserId } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"
import { useCreatineLogs, type CreatineRow } from "@/hooks/useDailyLogs"

const supabase = createClient()

/**
 * Daily creatine tracker. Doses accumulate across the day (a 10 g target is
 * often split), so the card tracks a running total against a per-user target
 * and keeps a consecutive-day streak — consistency is what makes creatine work.
 */
export function CreatineCard() {
  const today = useMemo(() => localToday(), [])
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const { data, isLoading } = useCreatineLogs(today)

  const logs = useMemo(() => data?.logs ?? [], [data])
  const todayTotal = useMemo(
    () => logs.find((l) => l.taken_on === today)?.dose_g ?? 0,
    [logs, today]
  )
  const streak = useMemo(
    () => currentStreak(logs.map((l) => l.taken_on), today),
    [logs, today]
  )
  const progress = creatineProgress(
    todayTotal,
    data?.targetG ?? DEFAULT_CREATINE_TARGET_G
  )

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["creatine-logs"] })
  }

  /** Add a dose to today's running total (upsert on the day's row). */
  const addDose = useMutation({
    mutationFn: async (grams: number) => {
      const userId = await getAuthUserId()
      const next = Math.round((todayTotal + grams) * 10) / 10
      const { error } = await supabase.from("creatine_logs").upsert(
        { user_id: userId, taken_on: today, dose_g: next },
        { onConflict: "user_id,taken_on" }
      )
      if (error) throw error
    },
    onMutate: () => setBusy(true),
    onSettled: () => setBusy(false),
    onSuccess: invalidate,
  })

  /** Clear today's log entirely (undo a mistaken tap). */
  const clearToday = useMutation({
    mutationFn: async () => {
      const userId = await getAuthUserId()
      const { error } = await supabase
        .from("creatine_logs")
        .delete()
        .eq("user_id", userId)
        .eq("taken_on", today)
      if (error) throw error
    },
    onMutate: () => setBusy(true),
    onSettled: () => setBusy(false),
    onSuccess: invalidate,
  })

  return (
    <InsightCard
      icon={Pill}
      title="Creatine"
    >
        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <div className="space-y-3">
        {/* Today's total vs target */}
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-2xl font-bold text-gray-900">
        {progress.totalG}
        <span className="text-base font-normal text-gray-400">
          {" "}
          / {progress.targetG} g
        </span>
        <span className="ml-1 text-xs font-normal text-gray-500">
          today
        </span>
          </p>
          {progress.met ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <Check className="h-3.5 w-3.5" />
          Target hit
        </span>
          ) : (
        <span className="shrink-0 text-xs text-gray-500">
          {progress.remainingG} g to go
        </span>
          )}
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-label="Creatine vs daily target"
          aria-valuenow={progress.totalG}
          aria-valuemax={progress.targetG}
        >
          <div
        className={`h-full rounded-full ${progress.met ? "bg-emerald-500" : "bg-purple-500"}`}
        style={{ width: `${progress.pct}%` }}
          />
        </div>

        {/* Add a dose — split doses across the day as needed */}
        <div className="flex items-center gap-2">
          {CREATINE_DOSE_OPTIONS.map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => addDose.mutate(g)}
          disabled={busy}
          className="flex-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-2 text-sm font-medium text-purple-800 transition-colors hover:bg-purple-100 disabled:opacity-50"
        >
          +{g} g
        </button>
          ))}
          {todayTotal > 0 && (
        <button
          type="button"
          onClick={() => clearToday.mutate()}
          disabled={busy}
          title="Clear today's creatine"
          aria-label="Clear today's creatine"
          className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 disabled:opacity-50"
        >
          <Undo2 className="h-4 w-4" />
        </button>
          )}
        </div>

        {/* Habit streak */}
        <div className="flex items-center gap-1.5 border-t border-gray-100 pt-2.5 text-xs">
          <Flame
        className={`h-4 w-4 ${streak > 0 ? "text-emerald-600" : "text-gray-300"}`}
          />
          <span className="text-gray-600">
        <span className="font-semibold text-gray-900">{streak}</span> day
        {streak === 1 ? "" : "s"} in a row
          </span>
        </div>

        {(addDose.isError || clearToday.isError) && (
          <p className="text-sm text-red-600">
        Couldn&apos;t save — try again.
          </p>
        )}
          </div>
        )}
    </InsightCard>
  )
}
