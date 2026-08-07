"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { currentWeekStreak, totalWeightLifted } from "@/lib/profile-stats"
import { Badge } from "@/components/ui/badge"
import { Dumbbell, Target, Calendar } from "lucide-react"
import { ReminderSettingsCard } from "@/components/activity/ReminderSettingsCard"
import { DiagnosticsCard } from "@/components/pwa/DiagnosticsCard"
import { PlanAuditCard } from "@/components/activity/PlanAuditCard"
import { OuraConnectionCard } from "@/components/profile/OuraConnectionCard"
import { ProfileSettingsCard } from "@/components/profile/ProfileSettingsCard"
import { AccountCard } from "@/components/profile/AccountCard"
import type { ProfileFeedback } from "@/components/profile/feedback"
import { normalizeReminderSettings } from "@/lib/reminder-settings"
import { useUserQuery } from "@/lib/supabase/user-query"
import { useProfile } from "@/hooks/useProfile"

const supabase = createClient()

/**
 * The profile page proper: header, stats row, and the shared feedback banner.
 * Everything below the stats row is a self-contained card — the settings form,
 * Oura connection, reminders, diagnostics and account each own their state and
 * queries, and report through `onFeedback` so the page shows one banner.
 */
export default function ProfilePage() {
  const [feedback, setFeedback] = useState<ProfileFeedback | null>(null)

  const { data: profile, isLoading: profileLoading } = useProfile()

  // Fetch stats
  const { data: stats } = useUserQuery(
    ["profile-stats"],
    async (userId: string) => {

      // Total workouts
      const { count: totalWorkouts } = await supabase
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)

      // Total weight lifted
      const { data: setData } = await supabase
        .from("set_logs")
        .select(
          "weight, reps, exercise_log:exercise_logs!inner(workout_log:workout_logs!inner(user_id))"
        )
        .eq("exercise_log.workout_log.user_id", userId)
        .not("weight", "is", null)

      const totalWeight = totalWeightLifted(
        (setData ?? []) as { weight: number | null; reps: number | null }[]
      )

      // Current streak (consecutive weeks with at least one workout)
      const { data: workoutDates } = await supabase
        .from("workout_logs")
        .select("started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })

      const streakWeeks = currentWeekStreak(workoutDates ?? [])

      return {
        totalWorkouts: totalWorkouts ?? 0,
        streakWeeks,
        totalWeight,
      }
    }
  )

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  const initial = profile?.display_name?.charAt(0)?.toUpperCase() ?? "U"
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : ""

  const fitnessLevelLabel: Record<string, string> = {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  }

  function formatWeight(value: number): string {
    return value.toLocaleString("en-US")
  }

  if (profileLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Profile Header */}
      <div className="flex flex-col items-center space-y-3 pt-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 text-3xl font-bold text-purple-600">
          {initial}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">
            {profile?.display_name || "User"}
          </h1>
          {memberSince && (
            <p className="mt-1 flex items-center justify-center gap-1 text-sm text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              Member since {memberSince}
            </p>
          )}
          {profile?.fitness_level && (
            <Badge className="mt-2">
              {fitnessLevelLabel[profile.fitness_level] ?? profile.fitness_level}
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <Dumbbell className="mx-auto mb-1 h-5 w-5 text-purple-500" />
          <p className="text-xl font-bold text-gray-900">
            {stats?.totalWorkouts ?? 0}
          </p>
          <p className="text-xs text-gray-500">Workouts</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <Target className="mx-auto mb-1 h-5 w-5 text-purple-500" />
          <p className="text-xl font-bold text-gray-900">
            {stats?.streakWeeks ?? 0}
          </p>
          <p className="text-xs text-gray-500">Week Streak</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <Dumbbell className="mx-auto mb-1 h-5 w-5 text-purple-500" />
          <p className="text-xl font-bold text-gray-900">
            {stats ? formatWeight(stats.totalWeight) : "0"}
          </p>
          <p className="text-xs text-gray-500">Lbs Lifted</p>
        </div>
      </div>

      {/* Profile Settings Form */}
      <ProfileSettingsCard onFeedback={setFeedback} />

      {/* Oura Ring Integration */}
      <OuraConnectionCard onFeedback={setFeedback} />

      {/* Reminder preferences */}
      <ReminderSettingsCard
        initial={normalizeReminderSettings(profile?.reminder_settings)}
      />

      {/* Diagnostics — off by default; the only way to reach the viewport
          readout in an installed PWA, which has no address bar. */}
      <PlanAuditCard />
      <DiagnosticsCard />

      {/* Account Section */}
      <AccountCard onFeedback={setFeedback} />
    </div>
  )
}
