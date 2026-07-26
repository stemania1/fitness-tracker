"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Pill, Check, Flame } from "lucide-react"
import { currentStreak } from "@/lib/creatine-streak"

const supabase = createClient()

const DEFAULT_DOSE_G = 5

/** Local YYYY-MM-DD (not UTC, so "today" matches the user's clock). */
function localToday(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface CreatineRow {
  taken_on: string
  dose_g: number
}

/**
 * Daily creatine tracker: one tap to mark today taken, a running streak, and
 * the dose. Consistency is what makes creatine work, so the card leads with
 * the streak. Sits by the caffeine card on the dashboard.
 */
export function CreatineCard() {
  const today = useMemo(() => localToday(), [])
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const { data: logs, isLoading } = useQuery({
    queryKey: ["creatine-logs", today],
    queryFn: async (): Promise<CreatineRow[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      // A window wide enough to cover any realistic streak.
      const since = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
      const pad = (n: number) => n.toString().padStart(2, "0")
      const sinceStr = `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())}`
      const { data, error } = await supabase
        .from("creatine_logs")
        .select("taken_on, dose_g")
        .eq("user_id", user.id)
        .gte("taken_on", sinceStr)
        .order("taken_on", { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const takenToday = useMemo(
    () => (logs ?? []).some((l) => l.taken_on === today),
    [logs, today]
  )
  const streak = useMemo(
    () => currentStreak((logs ?? []).map((l) => l.taken_on), today),
    [logs, today]
  )
  // Carry the last dose forward as the default next dose.
  const lastDose = logs?.[0]?.dose_g ?? DEFAULT_DOSE_G

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["creatine-logs"] })
    queryClient.invalidateQueries({ queryKey: ["creatine-today"] })
  }

  const markTaken = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase.from("creatine_logs").upsert(
        { user_id: user.id, taken_on: today, dose_g: lastDose },
        { onConflict: "user_id,taken_on" }
      )
      if (error) throw error
    },
    onMutate: () => setBusy(true),
    onSettled: () => setBusy(false),
    onSuccess: invalidate,
  })

  const undo = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase
        .from("creatine_logs")
        .delete()
        .eq("user_id", user.id)
        .eq("taken_on", today)
      if (error) throw error
    },
    onMutate: () => setBusy(true),
    onSettled: () => setBusy(false),
    onSuccess: invalidate,
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pill className="h-5 w-5 text-indigo-500" />
          Creatine
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Flame
                  className={`h-5 w-5 ${streak > 0 ? "text-orange-500" : "text-gray-300"}`}
                />
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {streak}
                    <span className="ml-1 text-xs font-normal text-gray-500">
                      day{streak === 1 ? "" : "s"} in a row
                    </span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {takenToday
                      ? `Taken today · ${lastDose} g`
                      : "Not logged yet today"}
                  </p>
                </div>
              </div>

              {takenToday ? (
                <button
                  onClick={() => undo.mutate()}
                  disabled={busy}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                  title="Tap to undo"
                >
                  <Check className="h-4 w-4" />
                  Done
                </button>
              ) : (
                <button
                  onClick={() => markTaken.mutate()}
                  disabled={busy}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  Mark taken
                </button>
              )}
            </div>

            {(markTaken.isError || undo.isError) && (
              <p className="text-sm text-red-600">
                Couldn&apos;t save — try again.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
