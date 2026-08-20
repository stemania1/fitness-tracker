"use client"

import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { WeeklyScheduleCard } from "@/components/activity/WeeklyScheduleCard"
import { MuscleBalanceCard } from "@/components/activity/MuscleBalanceCard"
import { EnergyBalanceCard } from "@/components/activity/EnergyBalanceCard"
import { EnergyDriversCard } from "@/components/activity/EnergyDriversCard"
import { RecoveryWatchCard } from "@/components/activity/RecoveryWatchCard"
import { ReadinessPerformanceCard } from "@/components/activity/ReadinessPerformanceCard"
import { WeeklyTrainingCard } from "@/components/activity/WeeklyTrainingCard"
import { RecentPRsCard } from "@/components/activity/RecentPRsCard"
import { RecentWorkoutsCard } from "@/components/activity/RecentWorkoutsCard"
import { useProfile } from "@/hooks/useProfile"
import { Section } from "@/components/layout/section"
import { Skeleton } from "@/components/ui/skeleton"

const supabase = createClient()

// The five Recharts consumers, loaded after first paint so the chart library
// stays out of the page's first-load bundle. Every card fetches its own data
// behind a skeleton already, so deferring them changes nothing visible.
// (Options are spelled out per call — next/dynamic requires a literal.)
const WeightTrendCard = dynamic(
  () => import("@/components/activity/WeightTrendCard").then((m) => m.WeightTrendCard),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)
const SleepTrendCard = dynamic(
  () => import("@/components/activity/SleepTrendCard").then((m) => m.SleepTrendCard),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)
const RemInsightsCard = dynamic(
  () => import("@/components/activity/RemInsightsCard").then((m) => m.RemInsightsCard),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)
const VolumeTrendCard = dynamic(
  () => import("@/components/activity/VolumeTrendCard").then((m) => m.VolumeTrendCard),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)
const EnergyTrendCard = dynamic(
  () => import("@/components/activity/EnergyTrendCard").then((m) => m.EnergyTrendCard),
  { ssr: false }
)
const Vo2MaxTrendCard = dynamic(
  () => import("@/components/activity/Vo2MaxTrendCard").then((m) => m.Vo2MaxTrendCard),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)

/**
 * The analytical half of the app. The dashboard is for what's actionable
 * *today*; these are the multi-week reads you check occasionally rather than
 * scroll past every morning. Each card fetches its own data, so this page is
 * just layout.
 */
export default function InsightsPage() {
  // Only needed for the VO2 max percentile bands.
  const { data: profile } = useProfile()

  return (
    <div className="space-y-8">
      <div>
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
        <WeightTrendCard />
        <EnergyBalanceCard />
      </Section>

      <Section
        title="Energy & sleep"
        subtitle="What actually moves your energy, and how you've been sleeping"
      >
        <EnergyTrendCard />
        <EnergyDriversCard />
        <SleepTrendCard />
        <RemInsightsCard />
        <RecoveryWatchCard />
        <ReadinessPerformanceCard />
      </Section>

      <Section
        title="Training"
        subtitle="Balance, weekly load, and conditioning over time"
      >
        <RecentWorkoutsCard />
        <MuscleBalanceCard />
        <RecentPRsCard />
        <VolumeTrendCard />
        <WeeklyTrainingCard />
        <Vo2MaxTrendCard age={profile?.age} sex={profile?.sex} />
      </Section>

      <Section
        title="Planning"
        subtitle="A realistic week built from the time you actually have"
      >
        <WeeklyScheduleCard />
      </Section>
    </div>
  )
}
