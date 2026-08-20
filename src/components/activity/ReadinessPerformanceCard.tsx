"use client"

import { useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Gauge } from "lucide-react"
import { exercises as staticExercises } from "@/data/exercises"
import { OURA_HISTORY_DAYS } from "@/lib/oura"
import { useUserQuery } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"
import { CHIP_TONES } from "@/lib/constants"
import { localDateOf, daysAgoDateString } from "@/lib/dates"
import {
  sessionPerformances,
  readinessPerformance,
  MIN_SESSIONS_PER_GROUP,
  type PerfSession,
  type ReadinessVerdict,
} from "@/lib/readiness-performance"

const supabase = createClient()

/**
 * Capped at the stored Oura history, not at what we'd like.
 *
 * This asked for 180 days while the sync only ever writes 90, so every
 * workout older than that came back with a null readiness score and was
 * dropped — indistinguishable, from the card, from never having trained.
 */
const WINDOW_DAYS = OURA_HISTORY_DAYS

const VERDICT_TONE: Record<ReadinessVerdict, keyof typeof CHIP_TONES> = {
  "not-enough-data": "neutral",
  "no-spread": "neutral",
  "no-relationship": "neutral",
  predicts: "progress",
  inverse: "attention",
}

const VERDICT_CHIP: Record<ReadinessVerdict, string> = {
  "not-enough-data": "Collecting",
  "no-spread": "Inconclusive",
  "no-relationship": "No link",
  predicts: "Confirmed",
  inverse: "Unexpected",
}

/**
 * Audits the app's own readiness gate against what you actually lifted.
 *
 * `readinessGate` downshifts the prescribed session on a low readiness score.
 * This is the only place that checks whether that score predicts anything for
 * you — and "it doesn't" is the more useful answer of the two, because it
 * retires a rule that costs training days for nothing.
 */
export function ReadinessPerformanceCard() {
  const { data: sessions, isLoading } = useUserQuery(
    ["readiness-performance", WINDOW_DAYS],
    async (userId: string): Promise<PerfSession[]> => {
      const since = daysAgoDateString(WINDOW_DAYS)
      const sinceIso = new Date(
        Date.now() - WINDOW_DAYS * 86_400_000
      ).toISOString()

      const [workouts, readiness] = await Promise.all([
        supabase
          .from("workout_logs")
          .select(
            "started_at, exercise_logs(exercises(name), set_logs(weight, reps))"
          )
          .eq("user_id", userId)
          .not("finished_at", "is", null)
          .gte("started_at", sinceIso),
        supabase
          .from("oura_daily")
          .select("day, readiness_score")
          .eq("user_id", userId)
          .gte("day", since),
      ])
      if (workouts.error) throw workouts.error
      if (readiness.error) throw readiness.error

      const readinessByDay = new Map(
        (readiness.data ?? []).map((r) => [r.day, r.readiness_score])
      )
      // The catalog is what knows a lift is assisted — the logged row doesn't
      // carry it, and assisted weight must not enter a strength average.
      const byName = new Map(
        staticExercises.map((e) => [e.name.toLowerCase(), e])
      )

      const rows = (workouts.data ?? []) as unknown as Array<{
        started_at: string
        exercise_logs: Array<{
          exercises: { name: string } | { name: string }[] | null
          set_logs: Array<{ weight: number | null; reps: number | null }>
        }>
      }>

      return rows.map((wl) => {
        const day = localDateOf(wl.started_at)
        return {
          day,
          readiness: readinessByDay.get(day) ?? null,
          exercises: (wl.exercise_logs ?? []).map((el) => {
            const rel = Array.isArray(el.exercises)
              ? el.exercises[0]
              : el.exercises
            const def = rel?.name ? byName.get(rel.name.toLowerCase()) : undefined
            return {
              exerciseKey: rel?.name?.toLowerCase() ?? "unknown",
              assisted: def?.assisted ?? false,
              sets: el.set_logs ?? [],
            }
          }),
        }
      })
    }
  )

  const { result, funnel } = useMemo(() => {
    if (!sessions) return { result: null, funnel: null }
    const scored = sessionPerformances(sessions)
    return {
      result: readinessPerformance(scored.performances),
      funnel: scored.funnel,
    }
  }, [sessions])

  return (
    <InsightCard
      icon={Gauge}
      title="Readiness vs. performance"
      subtitle="Whether your readiness score actually predicts what you lift"
      isLoading={isLoading || !result}
      skeletonHeight="h-32"
      action={
        result && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              CHIP_TONES[VERDICT_TONE[result.verdict]]
            }`}
          >
            {VERDICT_CHIP[result.verdict]}
          </span>
        )
      }
    >
      {result && (
        <div className="space-y-3">
          <p className="text-base font-semibold text-gray-900">
            {result.headline}
          </p>
          <p className="text-sm leading-relaxed text-gray-600">
            {result.detail}
          </p>

          {/* Where the sessions went. "Not enough" reads as a broken feature
              when you know you've logged plenty; naming the stage that lost
              them is the difference between "keep training" and "your ring
              history doesn't reach back that far". */}
          {result.verdict === "not-enough-data" && funnel && funnel.sessions > 0 && (
            <dl className="space-y-1 rounded-lg bg-gray-50 p-3 text-xs">
              {[
                ["Workouts in range", funnel.sessions],
                ["No comparable lift yet", funnel.noComparableLift],
                ["No readiness stored for that day", funnel.noReadiness],
                ["Scored", funnel.scored],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-3">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-700">{value}</dd>
                </div>
              ))}
              {funnel.noReadiness > funnel.scored && (
                <p className="pt-1 text-gray-400">
                  Stored Oura history only reaches back {WINDOW_DAYS} days, so
                  older workouts can never be scored.
                </p>
              )}
            </dl>
          )}

          {result.low && result.high && (
            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
              {[
                { label: "Lower-readiness days", group: result.low },
                { label: "Higher-readiness days", group: result.high },
              ].map(({ label, group }) => (
                <div key={label} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-600">{label}</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {Math.round(group.meanRelative * 100)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    of your normal working weight
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    readiness {Math.round(group.meanReadiness)} · {group.n}{" "}
                    sessions
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Said plainly, and on every verdict: this is one person's log,
              not a study. The number above is a hypothesis with an n. */}
          <p className="text-xs text-gray-400">
            Each session is scored against your own recent norm for the same
            lifts, so session type and getting stronger don&apos;t skew it.
            Needs {MIN_SESSIONS_PER_GROUP} sessions either side of your median
            readiness before it will report anything.
          </p>
        </div>
      )}
    </InsightCard>
  )
}
