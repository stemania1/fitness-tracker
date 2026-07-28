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
  ChevronRight,
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
import { macroTargets } from "@/lib/macro-targets"
import { planSuggestion } from "@/lib/plan-adaptation"
import type { OuraInsight } from "@/lib/oura-insights"
import { QuickLogExercise } from "@/components/activity/QuickLogExercise"
import { QuickLogStrength } from "@/components/activity/QuickLogStrength"
import { QuickLogWeight } from "@/components/activity/QuickLogWeight"
import { TrainingPlanTodayCard } from "@/components/activity/TrainingPlanTodayCard"
import { todaysWorkout } from "@/lib/todays-workout"
import { EnergyCheckInCard } from "@/components/activity/EnergyCheckInCard"
import { BedtimeCard } from "@/components/activity/BedtimeCard"
import { WeeklyDigestCard } from "@/components/activity/WeeklyDigestCard"
import { ExpressWorkoutCard } from "@/components/activity/ExpressWorkoutCard"
import { ThisWeekCard } from "@/components/activity/ThisWeekCard"
import { deriveFuelState } from "@/lib/energy"
import { caffeineStatus, lateCaffeineFlag } from "@/lib/caffeine"
import { computeReminders } from "@/lib/reminders"
import { normalizeReminderSettings } from "@/lib/reminder-settings"
import { RemindersCard } from "@/components/activity/RemindersCard"
import { QuickLogFood } from "@/components/activity/QuickLogFood"
import { QuickLogCaffeine } from "@/components/activity/QuickLogCaffeine"
import { NutritionCard } from "@/components/activity/NutritionCard"
import { CaffeineCard } from "@/components/activity/CaffeineCard"
import { CreatineCard } from "@/components/activity/CreatineCard"
import { OuraSummaryCard } from "@/components/activity/OuraSummaryCard"
import { ErrorBoundary } from "@/components/ui/error-boundary"

const supabase = createClient()

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
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      if (error) throw error
      return data
    },
  })

  // Start Workout opens the day's session in the logger (weights + previous
  // performance) on training days; rest days go to the lightweight rest screen.
  const startWorkoutHref = useMemo(
    () =>
      todaysWorkout(new Date()).isRest
        ? "/activity/today"
        : "/activity/log?plan=today",
    []
  )

  const { data: allWorkoutLogs } = useQuery({
    queryKey: ["workout-logs-all"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, started_at")
        .eq("user_id", user.id)
        .order("started_at", { ascending: true })
      if (error) throw error
      return data
    },
  })

  // Last ~9 days of logs + recent fitness tests feed the missed-session
  // detector behind the Today's Plan card (lib/plan-adaptation).
  const { data: planCatchupWorkouts } = useQuery({
    queryKey: ["plan-adaptation-workouts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const since = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from("workout_logs")
        .select("name, started_at")
        .eq("user_id", user.id)
        .gte("started_at", since.toISOString())
      if (error) throw error
      return data ?? []
    },
  })

  const { data: planCatchupTests } = useQuery({
    queryKey: ["plan-adaptation-tests"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from("fitness_tests")
        .select("test_type, tested_at")
        .eq("user_id", user.id)
        .gte("tested_at", since.toISOString().slice(0, 10))
      if (error) throw error
      return data ?? []
    },
  })

  // Oura Ring daily summary
  const { data: ouraResult } = useQuery<{
    connected: boolean
    summary: OuraSummary | null
    error?: string
  }>({
    queryKey: ["oura-summary"],
    queryFn: async () => {
      const localDate = new Date().toLocaleDateString("en-CA") // YYYY-MM-DD in local tz
      const offsetMin = new Date().getTimezoneOffset() // e.g. 240 for EDT (UTC-4)
      const sign = offsetMin <= 0 ? "+" : "-"
      const absMin = Math.abs(offsetMin)
      const tzOffset = `${sign}${String(Math.floor(absMin / 60)).padStart(2, "0")}:${String(absMin % 60).padStart(2, "0")}`
      const res = await fetch(`/api/oura?date=${localDate}&tz_offset=${encodeURIComponent(tzOffset)}`)
      if (res.status === 404) return { connected: false, summary: null }
      if (res.status === 401) return { connected: true, summary: null, error: "token_expired" }
      if (!res.ok) return { connected: true, summary: null, error: "fetch_failed" }
      const summary = (await res.json()) as OuraSummary
      return { connected: true, summary }
    },
    retry: false,
  })

  const ouraSummary = ouraResult?.summary ?? null

  // Recommended daily calorie/macro targets for the nutrition card.
  const nutritionTargets = useMemo(() => macroTargets(profile), [profile])

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

  // Signals for the energy check-in read. Everything is optional — the card
  // works on the subjective input alone when Oura data isn't available.
  const trainedToday = useMemo(() => {
    if (!allWorkoutLogs) return false
    const today = new Date().toLocaleDateString("en-CA")
    return allWorkoutLogs.some(
      (w) => new Date(w.started_at).toLocaleDateString("en-CA") === today
    )
  }, [allWorkoutLogs])

  const sleepMinutesLastNight =
    ouraSummary?.sleepPeriod?.total_sleep_duration != null
      ? Math.round(ouraSummary.sleepPeriod.total_sleep_duration / 60)
      : null

  // Today's fuel, for the energy read: total calories in + recency of the last
  // meal. Its own lightweight query (distinct key from the Nutrition card so
  // neither clobbers the other's cached shape).
  const { data: todaysFuelLogs } = useQuery({
    queryKey: ["energy-fuel-today"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from("food_logs")
        .select("calories, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", dayStart.toISOString())
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const fuelState = useMemo(() => {
    if (!todaysFuelLogs) return null
    const caloriesConsumed = todaysFuelLogs.reduce((sum, m) => sum + m.calories, 0)
    const lastMeal = todaysFuelLogs[todaysFuelLogs.length - 1]
    const minutesSinceLastMeal = lastMeal
      ? Math.round((Date.now() - new Date(lastMeal.logged_at).getTime()) / 60000)
      : null
    return deriveFuelState({
      hour: new Date().getHours(),
      caloriesConsumed,
      calorieTarget: nutritionTargets?.calories ?? null,
      minutesSinceLastMeal,
    })
  }, [todaysFuelLogs, nutritionTargets])

  // Today's caffeine, for the energy read (alertness/crash) and the
  // late-caffeine sleep warning.
  const { data: todaysCaffeine } = useQuery({
    queryKey: ["caffeine-today"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from("caffeine_logs")
        .select("mg, logged_at")
        .eq("user_id", user.id)
        .gte("logged_at", dayStart.toISOString())
        .order("logged_at", { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const { caffeineLevel, caffeineWarning } = useMemo(() => {
    if (!todaysCaffeine || todaysCaffeine.length === 0) {
      return { caffeineLevel: null, caffeineWarning: null }
    }
    const now = Date.now()
    const doses = todaysCaffeine.map((c) => {
      const t = new Date(c.logged_at)
      return {
        mg: c.mg,
        minutesAgo: Math.round((now - t.getTime()) / 60000),
        hour: t.getHours(),
      }
    })
    const status = caffeineStatus(doses)
    const flag = lateCaffeineFlag(doses)
    return {
      caffeineLevel: status.level === "none" ? null : status.level,
      caffeineWarning: flag.late ? flag.message : null,
    }
  }, [todaysCaffeine])

  // --- Reminders: small extra signals the other cards don't already fetch ---
  const todayStr = new Date().toLocaleDateString("en-CA")
  const queryClient = useQueryClient()

  // Backfill stored Oura daily history once a day (idempotent upsert on the
  // server; no-op when Oura isn't connected). Powers the energy correlations
  // and long-term sleep/readiness trends.
  const { data: ouraSync } = useQuery({
    queryKey: ["oura-sync", todayStr],
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

  const { data: energyCheckedInToday } = useQuery({
    queryKey: ["energy-checkin-exists", todayStr],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("energy_checkins")
        .select("id")
        .eq("user_id", user.id)
        .eq("logged_on", todayStr)
        .limit(1)
      if (error) throw error
      return (data?.length ?? 0) > 0
    },
  })

  const { data: creatineTakenToday } = useQuery({
    queryKey: ["creatine-today", todayStr],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("creatine_logs")
        .select("id")
        .eq("user_id", user.id)
        .eq("taken_on", todayStr)
        .limit(1)
      if (error) throw error
      return (data?.length ?? 0) > 0
    },
  })

  const { data: lastWeighInAt } = useQuery({
    queryKey: ["last-weigh-in"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("weight_logs")
        .select("logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(1)
      if (error) throw error
      return (data?.[0]?.logged_at ?? null) as string | null
    },
  })

  const reminders = useMemo(() => {
    const now = new Date()
    const startOfDayMs = (d: Date) => {
      const x = new Date(d)
      x.setHours(0, 0, 0, 0)
      return x.getTime()
    }
    const today0 = startOfDayMs(now)
    const dayDiff = (iso: string) =>
      Math.round((today0 - startOfDayMs(new Date(iso))) / 86_400_000)

    // While a query is still loading, feed a value that suppresses its nudge
    // so nothing flashes before the data lands.
    const daysSinceLastWorkout =
      allWorkoutLogs === undefined
        ? 0
        : allWorkoutLogs.length === 0
          ? null
          : dayDiff(allWorkoutLogs[allWorkoutLogs.length - 1].started_at)

    const daysSinceLastWeighIn =
      lastWeighInAt === undefined
        ? 0
        : lastWeighInAt === null
          ? null
          : dayDiff(lastWeighInAt)

    return computeReminders(
      {
        hour: now.getHours(),
        mealsLoggedToday: todaysFuelLogs === undefined ? 99 : todaysFuelLogs.length,
        workedOutToday: trainedToday,
        daysSinceLastWorkout,
        energyCheckedInToday: energyCheckedInToday ?? true,
        daysSinceLastWeighIn,
        // Suppress the creatine nudge until the query resolves.
        creatineTakenToday: creatineTakenToday ?? true,
      },
      normalizeReminderSettings(profile?.reminder_settings)
    )
  }, [
    allWorkoutLogs,
    lastWeighInAt,
    todaysFuelLogs,
    trainedToday,
    energyCheckedInToday,
    creatineTakenToday,
    profile?.reminder_settings,
  ])

  const greeting = profile?.display_name
    ? `Welcome, ${profile.display_name}!`
    : "Welcome back!"

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        {profileLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        )}
      </div>

      {/* Smart nudges for anything not yet logged today */}
      <ErrorBoundary>
        <RemindersCard reminders={reminders} startWorkoutHref={startWorkoutHref} />
      </ErrorBoundary>

      {/* Weekly coach digest: all three goals + this week's focus */}
      <ErrorBoundary>
        <WeeklyDigestCard />
      </ErrorBoundary>

      {/* Time-boxed "I have N minutes" workout generator */}
      <ErrorBoundary>
        <ExpressWorkoutCard />
      </ErrorBoundary>

      {/* Quick Actions */}
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

      {/* Today's prescribed session from the 12-week training plan,
          readiness-gated when Oura data is available */}
      <ErrorBoundary>
        <TrainingPlanTodayCard
          readinessScore={ouraSummary?.readiness?.score}
          suggestion={planCatchup}
        />
      </ErrorBoundary>

      {/* Subjective energy check-in reconciled against the day's signals */}
      <ErrorBoundary>
        <EnergyCheckInCard
          sleepScore={ouraSummary?.sleep?.score}
          sleepMinutes={sleepMinutesLastNight}
          readinessScore={ouraSummary?.readiness?.score}
          trainedHardToday={trainedToday}
          fuel={fuelState}
          caffeine={caffeineLevel}
          caffeineWarning={caffeineWarning}
        />
      </ErrorBoundary>

      {/* Sleep-anchored bedtime target: wind-down + caffeine cutoff from wake time */}
      <ErrorBoundary>
        <BedtimeCard />
      </ErrorBoundary>

      {/* Photo-logged meals: calories in, macros, net vs Oura calories out */}
      <ErrorBoundary>
        <NutritionCard
          caloriesBurnedToday={ouraSummary?.activity?.total_calories}
          targets={nutritionTargets}
        />
      </ErrorBoundary>

      {/* Today's caffeine: total vs guideline, still-active, drinks */}
      <ErrorBoundary>
        <CaffeineCard />
      </ErrorBoundary>

      {/* Daily creatine: one-tap log + streak */}
      <ErrorBoundary>
        <CreatineCard />
      </ErrorBoundary>

      {/* This Week: workout progress, calories burned, streak */}
      <ErrorBoundary>
        <ThisWeekCard />
      </ErrorBoundary>

      {/* Oura Ring Summary */}
      {/* Today's Oura snapshot (self-fetches the shared oura-summary query) */}
      <ErrorBoundary>
        <OuraSummaryCard />
      </ErrorBoundary>

      {/* Oura Insights */}
      {ouraInsights.length > 0 && (
        <ErrorBoundary>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-5 w-5 text-amber-500" />
                Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ouraInsights.map((insight, i) => (
                  <OuraInsightRow key={i} insight={insight} />
                ))}
              </div>
            </CardContent>
          </Card>
        </ErrorBoundary>
      )}

      {/* The multi-week analytical reads live on their own page, so the
          dashboard stays about what's actionable today. */}
      <Link
        href="/insights"
        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
      >
        <span>
          More insights
          <span className="ml-1 font-normal text-gray-500">
            — trends, balance, and energy patterns
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
      </Link>
    </div>
  )
}
