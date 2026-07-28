"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { ChevronLeft } from "lucide-react"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { WeeklyScheduleCard } from "@/components/activity/WeeklyScheduleCard"
import { WeightTrendCard } from "@/components/activity/WeightTrendCard"
import { MuscleBalanceCard } from "@/components/activity/MuscleBalanceCard"
import { EnergyBalanceCard } from "@/components/activity/EnergyBalanceCard"
import { EnergyDriversCard } from "@/components/activity/EnergyDriversCard"
import { SleepTrendCard } from "@/components/activity/SleepTrendCard"
import { RemInsightsCard } from "@/components/activity/RemInsightsCard"
import { RecoveryWatchCard } from "@/components/activity/RecoveryWatchCard"
import { Vo2MaxTrendCard } from "@/components/activity/Vo2MaxTrendCard"
import { WeeklyTrainingCard } from "@/components/activity/WeeklyTrainingCard"
import { RecentPRsCard } from "@/components/activity/RecentPRsCard"
import { VolumeTrendCard } from "@/components/activity/VolumeTrendCard"

const supabase = createClient()

/** A labelled group of cards, so the page reads as sections not a wall. */
function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </h2>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

/**
 * The analytical half of the app. The dashboard is for what's actionable
 * *today*; these are the multi-week reads you check occasionally rather than
 * scroll past every morning. Each card fetches its own data, so this page is
 * just layout.
 */
export default function InsightsPage() {
  // Only needed for the VO2 max percentile bands.
  const { data: profile } = useQuery({
    queryKey: ["insights-profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data } = await supabase
        .from("user_profiles")
        .select("age, sex")
        .eq("id", user.id)
        .single()
      return data
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
        <p className="mt-1 text-sm text-gray-500">
          The longer view — trends and patterns across weeks, rather than
          today&apos;s to-dos.
        </p>
      </div>

      <Section
        title="Weight"
        subtitle="What your intake and weight trend say about each other"
      >
        <ErrorBoundary>
          <WeightTrendCard />
        </ErrorBoundary>
        <ErrorBoundary>
          <EnergyBalanceCard />
        </ErrorBoundary>
      </Section>

      <Section
        title="Energy & sleep"
        subtitle="What actually moves your energy, and how you've been sleeping"
      >
        <ErrorBoundary>
          <EnergyDriversCard />
        </ErrorBoundary>
        <ErrorBoundary>
          <SleepTrendCard />
        </ErrorBoundary>
        <ErrorBoundary>
          <RemInsightsCard />
        </ErrorBoundary>
        <ErrorBoundary>
          <RecoveryWatchCard />
        </ErrorBoundary>
      </Section>

      <Section
        title="Training"
        subtitle="Balance, weekly load, and conditioning over time"
      >
        <ErrorBoundary>
          <MuscleBalanceCard />
        </ErrorBoundary>
        <ErrorBoundary>
          <RecentPRsCard />
        </ErrorBoundary>
        <ErrorBoundary>
          <VolumeTrendCard />
        </ErrorBoundary>
        <ErrorBoundary>
          <WeeklyTrainingCard />
        </ErrorBoundary>
        <ErrorBoundary>
          <Vo2MaxTrendCard age={profile?.age} sex={profile?.sex} />
        </ErrorBoundary>
      </Section>

      <Section
        title="Planning"
        subtitle="A realistic week built from the time you actually have"
      >
        <ErrorBoundary>
          <WeeklyScheduleCard />
        </ErrorBoundary>
      </Section>
    </div>
  )
}
