"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Dumbbell, ChevronRight } from "lucide-react"
import { formatShortDate } from "@/lib/dates"
import { useUserQuery } from "@/lib/supabase/user-query"
import { InsightCard } from "@/components/ui/insight-card"

const supabase = createClient()

/** The three most recent workouts, each linking to its full log. */
export function RecentWorkoutsCard() {
  const { data: recentWorkouts, isLoading: recentLoading } = useUserQuery(
    ["recent-workouts"],
    async (userId: string) => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, name, started_at, duration_mins")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(3)
      if (error) throw error
      return data
    }
  )

  return (
    <InsightCard
      icon={Dumbbell}
      title="Recent Workouts"
      action={
        <Link
          href="/workouts"
          className="flex items-center text-sm text-purple-600 hover:text-purple-700"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      }
    >
        {recentLoading ? (
          <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
          </div>
        ) : recentWorkouts && recentWorkouts.length > 0 ? (
          <div className="space-y-3">
        {recentWorkouts.map((workout) => (
          <Link
            key={workout.id}
            href={`/activity/${workout.id}`}
            className="flex items-center justify-between rounded-lg bg-gray-50 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <div>
              <p className="font-medium text-gray-900">{workout.name}</p>
              <p className="text-xs text-gray-500">
                {formatShortDate(workout.started_at)}
                {workout.duration_mins && (
                  <> &middot; {workout.duration_mins} min</>
                )}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
        ))}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-gray-500">
        No workouts yet. Start your first workout!
          </div>
        )}
    </InsightCard>
  )
}
