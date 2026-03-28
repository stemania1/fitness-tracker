"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dumbbell, Plus, Clock, ChevronRight, Sparkles } from "lucide-react"
import { SPLIT_TYPES } from "@/lib/constants"

const supabase = createClient()

function splitLabel(splitType: string): string {
  return (
    SPLIT_TYPES.find((s) => s.value === splitType)?.label ?? splitType
  )
}

export default function WorkoutsPage() {
  const { data: templates, isLoading } = useQuery({
    queryKey: ["workout-templates"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("workout_templates")
        .select(
          "id, name, split_type, estimated_mins, is_generated, created_at, template_exercises(id)"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data as any[]
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Workouts</h1>
      </div>

      <Link href="/workouts/generate">
        <Button size="lg" className="w-full gap-2">
          <Sparkles className="h-5 w-5" />
          Generate Workout Plan
        </Button>
      </Link>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="space-y-4">
          {templates.map((template) => (
            <Link key={template.id} href={`/workouts/${template.id}`}>
              <Card className="transition-colors hover:border-purple-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {template.name}
                    </CardTitle>
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">
                      {splitLabel(template.split_type)}
                    </Badge>
                    {template.estimated_mins && (
                      <Badge variant="secondary">
                        <Clock className="mr-1 h-3 w-3" />
                        {template.estimated_mins} min
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      <Dumbbell className="mr-1 h-3 w-3" />
                      {(template.template_exercises as { id: string }[])
                        ?.length ?? 0}{" "}
                      exercises
                    </Badge>
                    {template.is_generated && (
                      <Badge variant="success">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Generated
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Dumbbell className="mb-4 h-12 w-12 text-gray-300" />
            <p className="mb-2 text-lg font-medium text-gray-900">
              No workouts yet
            </p>
            <p className="mb-6 text-sm text-gray-500">
              Generate your first workout plan!
            </p>
            <Link href="/workouts/generate">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Generate Workout Plan
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
