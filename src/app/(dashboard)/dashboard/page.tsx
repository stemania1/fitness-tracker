"use client"

import { useMemo, useEffect } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dumbbell,
  Flame,
  Plus,
  Moon,
  Heart,
  Zap,
  Wind,
  Brain,
  Shield,
  TrendingUp,
} from "lucide-react"
import type { OuraSummary } from "@/lib/oura"
import { generateInsights } from "@/lib/oura-insights"
import { planSuggestion } from "@/lib/plan-adaptation"
import type { OuraInsight } from "@/lib/oura-insights"
import { QuickLogExercise } from "@/components/activity/QuickLogExercise"
import { QuickLogStrength } from "@/components/activity/QuickLogStrength"
import { QuickLogWeight } from "@/components/activity/QuickLogWeight"
import { TrainingPlanTodayCard } from "@/components/activity/TrainingPlanTodayCard"
import { todaysWorkout } from "@/lib/todays-workout"
import { localToday } from "@/lib/dates"
import { Section } from "@/components/layout/section"
import { ouraSummaryQuery } from "@/lib/queries/oura"
import { queryKeys } from "@/lib/queries/keys"
import { useTodaysSignals } from "@/hooks/useTodaysSignals"
import { useProfile } from "@/hooks/useProfile"
import { EnergyCheckInCard } from "@/components/activity/EnergyCheckInCard"
import { BedtimeCard } from "@/components/activity/BedtimeCard"
import { WeeklyDigestCard } from "@/components/activity/WeeklyDigestCard"
import { ExpressWorkoutCard } from "@/components/activity/ExpressWorkoutCard"
import { ThisWeekCard } from "@/components/activity/ThisWeekCard"
import { RemindersCard } from "@/components/activity/RemindersCard"
import { QuickLogFood } from "@/components/activity/QuickLogFood"
import { QuickLogCaffeine } from "@/components/activity/QuickLogCaffeine"
import { NutritionCard } from "@/components/activity/NutritionCard"
import { CaffeineCard } from "@/components/activity/CaffeineCard"
import { CreatineCard } from "@/components/activity/CreatineCard"
import dynamic from "next/dynamic"
import { CardStack } from "@/components/ui/card-stack"
import { InsightCard } from "@/components/ui/insight-card"
import { useUserQuery } from "@/lib/supabase/user-query"

const supabase = createClient()

// The dashboard's two Recharts consumers. Loaded after first paint so the
// chart library stays out of the page's first-load bundle; both cards fetch
// their own data and show a skeleton anyway, so nothing visible changes
// except a lighter initial load.
const OuraSummaryCard = dynamic(
  () =>
    import("@/components/activity/OuraSummaryCard").then(
      (m) => m.OuraSummaryCard
    ),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> }
)

const DailyMovementCard = dynamic(
  () =>
    import("@/components/activity/DailyMovementCard").then(
      (m) => m.DailyMovementCard
    ),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full" /> }
)

const insightIconMap: Record<OuraInsight["icon"], typeof Heart> = {
  dumbbell: Dumbbell,
  moon: Moon,
  zap: Zap,
  flame: Flame,
  heart: Heart,
  brain: Brain,
  shield: Shield,
  wind: Wind,
  "trending-up": TrendingUp,
}

const insightPriorityColors: Record<OuraInsight["priority"], string> = {
  high: "border-l-amber-500 bg-amber-50",
  medium: "border-l-blue-400 bg-blue-50",
  low: "border-l-emerald-400 bg-emerald-50",
}

function OuraInsightRow({ insight }: { insight: OuraInsight }) {
  const Icon = insightIconMap[insight.icon]
  return (
    <div className={`rounded-lg border-l-4 p-3 ${insightPriorityColors[insight.priority]}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
        <div>
          <p className="text-sm font-medium text-gray-900">{insight.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{insight.body}</p>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: profile, isLoading: profileLoading } = useProfile()

  // Start Workout opens the day's session in the logger (weights + previous
  // performance) on training days; rest days go to the lightweight rest screen.
  const startWorkoutHref = useMemo(
    () =>
      todaysWorkout(new Date()).isRest
        ? "/activity/today"
        : "/activity/log?plan=today",
    []
  )

  const { data: allWorkoutLogs } = useUserQuery(
    ["workout-logs-all"],
    async (userId: string) => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: true })
      if (error) throw error
      return data
    }
  )

  // Last ~9 days of logs + recent fitness tests feed the missed-session
  // detector behind the Today's Plan card (lib/plan-adaptation).
  const { data: planCatchupWorkouts } = useUserQuery(
    ["plan-adaptation-workouts"],
    async (userId: string) => {
      const since = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from("workout_logs")
        .select("name, started_at")
        .eq("user_id", userId)
        .gte("started_at", since.toISOString())
      if (error) throw error
      return data ?? []
    }
  )

  const { data: planCatchupTests } = useUserQuery(
    ["plan-adaptation-tests"],
    async (userId: string) => {
      const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from("fitness_tests")
        .select("test_type, tested_at")
        .eq("user_id", userId)
        .gte("tested_at", since.toISOString().slice(0, 10))
      if (error) throw error
      return data ?? []
    }
  )

  // Oura Ring daily summary
  const { data: ouraResult } = useQuery(ouraSummaryQuery())

  const ouraSummary = ouraResult?.summary ?? null

  // Missed-session catch-up suggestion for the Today's Plan card.
  const planCatchup = useMemo(
    () =>
      planSuggestion(
        new Date(),
        planCatchupWorkouts ?? [],
        planCatchupTests ?? []
      ),
    [planCatchupWorkouts, planCatchupTests]
  )

  const ouraInsights = useMemo(
    () =>
      ouraSummary
        ? generateInsights(ouraSummary, {
            age: profile?.age ?? null,
            sex: profile?.sex ?? null,
          })
        : [],
    [ouraSummary, profile?.age, profile?.sex]
  )

  // Everything derived about today — fuel, caffeine, reminders, whether a
  // workout has happened yet — lives in one hook rather than eleven queries
  // and six memos inline. See hooks/useTodaysSignals.
  const {
    fuel,
    caffeineLevel,
    caffeineWarning,
    trainedToday,
    sleepMinutesLastNight,
    reminders,
    nutritionTargets,
  } = useTodaysSignals(ouraSummary, allWorkoutLogs ?? undefined)

  // Backfill stored Oura daily history once a day (idempotent upsert on the
  // server; no-op when Oura isn't connected). Powers the energy correlations
  // and long-term sleep/readiness trends.
  const todayStr = localToday()
  const queryClient = useQueryClient()
  const { data: ouraSync } = useQuery({
    queryKey: queryKeys.ouraSync(todayStr),
    queryFn: async () => {
      const res = await fetch("/api/oura/sync", { method: "POST" })
      return res.ok ? await res.json() : { synced: 0 }
    },
    staleTime: Infinity,
    retry: false,
  })
  useEffect(() => {
    if (ouraSync?.synced > 0) {
      queryClient.invalidateQueries({ queryKey: ["energy-drivers"] })
    }
  }, [ouraSync, queryClient])

  const greeting = profile?.display_name
    ? `Welcome, ${profile.display_name}!`
    : "Welcome back!"

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        {profileLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        )}
      </div>

      {/* ── Today ──────────────────────────────────────────────────────
          The primary action first. Start Workout used to sit fourth, below
          three advisory cards, which put the one thing this app exists for
          below the fold. Nudges stay above it because they are how you find
          out there is something to act on at all. */}
      <CardStack className="space-y-3">
        <RemindersCard
          reminders={reminders}
          startWorkoutHref={startWorkoutHref}
        />

        <div className="space-y-2">
          <Link
            href={startWorkoutHref}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            Start Workout
          </Link>
          <div className="flex gap-2">
            <QuickLogStrength />
            <QuickLogExercise />
            <QuickLogWeight />
          </div>
          <div className="flex gap-2">
            <QuickLogFood />
            <QuickLogCaffeine />
          </div>
        </div>

        {/* Today's prescribed session, readiness-gated when Oura is connected */}
        <TrainingPlanTodayCard
          readinessScore={ouraSummary?.readiness?.score}
          suggestion={planCatchup}
        />

        {/* The time-boxed fallback, for when the prescribed session won't fit */}
        <ExpressWorkoutCard />
      </CardStack>

      {/* Movement sits above Recovery because it is the one card here you can
          still change today: steps are actionable until bedtime, while last
          night's sleep is settled.

          Gated on the same condition the card hides itself on. The card
          returning null is not enough — Section renders its heading
          regardless, so a member without a ring would get a "MOVEMENT"
          label above empty space. */}
      {ouraSummary?.activity && (
        <Section title="Movement">
          <DailyMovementCard />
        </Section>
      )}

      <Section title="Recovery">
        <EnergyCheckInCard
          sleepScore={ouraSummary?.sleep?.score}
          sleepMinutes={sleepMinutesLastNight}
          readinessScore={ouraSummary?.readiness?.score}
          trainedHardToday={trainedToday}
          fuel={fuel}
          caffeine={caffeineLevel}
          caffeineWarning={caffeineWarning}
        />
        <OuraSummaryCard />
        <BedtimeCard />
        {ouraInsights.length > 0 && (
          <InsightCard icon={Zap} accent="attention" title="Insights">
            <div className="space-y-3">
              {ouraInsights.map((insight, i) => (
                <OuraInsightRow key={i} insight={insight} />
              ))}
            </div>
          </InsightCard>
        )}
      </Section>

      {/* Creatine leads: it is a once-a-day, one-tap action that is either done
          or not, so burying it under two larger read-mostly cards meant
          scrolling past them every morning to tap a single chip. Nutrition and
          caffeine are consulted repeatedly through the day and read fine
          further down; a card you act on beats cards you check. */}
      <Section title="Fuel">
        <CreatineCard />
        <NutritionCard
          caloriesBurnedToday={ouraSummary?.activity?.total_calories}
          targets={nutritionTargets}
        />
        <CaffeineCard />
      </Section>

      <Section title="Progress">
        <ThisWeekCard />
        <WeeklyDigestCard />
      </Section>
    </div>
  )
}
