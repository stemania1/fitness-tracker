"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Scale3d, AlertTriangle, CheckCircle2 } from "lucide-react"
import { exercises as staticExercises } from "@/data/exercises"
import { formatMuscleGroup } from "@/lib/muscle-groups"
import { analyzeMuscleBalance, type MuscleSet } from "@/lib/muscle-balance"
import { useUserQuery } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"

const supabase = createClient()

const WINDOW_DAYS = 28

/**
 * Muscle-group balance over the last four weeks: volume share per group plus
 * the push:pull and upper:lower ratios, and anything that's been neglected.
 * Catches the drift that creeps in when time is tight (all press, no pull;
 * legs skipped).
 */
export function MuscleBalanceCard() {
  const { data: sets, isLoading } = useUserQuery(
    ["muscle-balance", WINDOW_DAYS],
    async (userId: string): Promise<MuscleSet[]> => {
      const sinceIso = new Date(
        Date.now() - WINDOW_DAYS * 86_400_000
      ).toISOString()

      const { data, error } = await supabase
        .from("workout_logs")
        .select("started_at, exercise_logs(exercises(name), set_logs(weight, reps))")
        .eq("user_id", userId)
        .gte("started_at", sinceIso)
      if (error) throw error

      // Resolve each logged exercise's DB name back to its catalog entry so we
      // know which muscle groups it worked.
      const byName = new Map(
        staticExercises.map((e) => [e.name.toLowerCase(), e])
      )
      const workouts = (data ?? []) as unknown as Array<{
        exercise_logs: Array<{
          exercises: { name: string } | { name: string }[] | null
          set_logs: Array<{ weight: number | null; reps: number | null }>
        }>
      }>

      const out: MuscleSet[] = []
      for (const wl of workouts) {
        for (const el of wl.exercise_logs ?? []) {
          const rel = Array.isArray(el.exercises) ? el.exercises[0] : el.exercises
          const def = rel?.name
            ? byName.get(rel.name.toLowerCase())
            : undefined
          if (!def || def.muscleGroups.length === 0) continue
          for (const s of el.set_logs ?? []) {
            const volume = (s.weight ?? 0) * (s.reps ?? 0)
            if (volume > 0) {
              out.push({ muscleGroups: def.muscleGroups, volume })
            }
          }
        }
      }
      return out
    }
  )

  const balance = useMemo(
    () => (sets ? analyzeMuscleBalance(sets) : null),
    [sets]
  )

  const topGroups = balance?.groups.slice(0, 6) ?? []
  const skewed = balance?.ratios.filter((r) => r.verdict === "skewed") ?? []

  return (
    <InsightCard
      icon={Scale3d}
      title="Muscle Balance"
    >
        {isLoading || !balance ? (
          <Skeleton className="h-32 w-full" />
        ) : balance.ratios.length === 0 ? (
          <p className="text-sm text-gray-500">
        Log a few more strength sessions and I&apos;ll show how your volume
        is split across muscle groups.
          </p>
        ) : (
          <div className="space-y-3">
        {/* Volume share per group */}
        <div className="space-y-1.5">
          {topGroups.map((g) => (
        <div key={g.group} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs text-gray-600">
            {g.label}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-purple-400"
              style={{ width: `${g.sharePct}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs text-gray-500">
            {g.sharePct}%
          </span>
        </div>
          ))}
        </div>

        {/* Balance ratios */}
        <div className="space-y-1.5 border-t border-gray-100 pt-2.5">
          {balance.ratios.map((r) => (
        <div key={r.key} className="flex items-start gap-2 text-sm">
          {r.verdict === "skewed" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          ) : r.verdict === "balanced" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
          )}
          <p className="min-w-0 text-gray-700">
            {r.ratio != null && (
              <span className="font-medium">
                {r.leftLabel} : {r.rightLabel} = {r.ratio}
              </span>
            )}{" "}
            <span className={r.ratio != null ? "text-gray-600" : ""}>
              {r.message}
            </span>
          </p>
        </div>
          ))}
        </div>

        {balance.neglected.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <span className="font-semibold">Under-trained:</span>{" "}
        {balance.neglected.map(formatMuscleGroup).join(", ")} — worth
        working in over the next couple of sessions.
          </p>
        )}

        <p className="text-[11px] text-gray-400">
          Volume share over the last {WINDOW_DAYS} days
          {skewed.length === 0 && balance.neglected.length === 0
        ? " — nicely balanced."
        : "."}
        </p>
          </div>
        )}
    </InsightCard>
  )
}
