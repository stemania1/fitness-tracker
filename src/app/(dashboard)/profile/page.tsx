"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  User,
  LogOut,
  Trash2,
  Save,
  Dumbbell,
  Target,
  Calendar,
  Link2,
  Unlink,
  AlertTriangle,
} from "lucide-react"
import type { UserProfileUpdate } from "@/types/database"

const supabase = createClient()

type FeedbackMessage = {
  type: "success" | "error"
  text: string
} | null

type OuraErrorReason =
  | "user_denied"
  | "missing_code"
  | "missing_env"
  | "token_exchange"
  | "not_authenticated"
  | "db_write"

const ouraErrorInfo: Record<OuraErrorReason, { title: string; steps: string[] }> = {
  user_denied: {
    title: "Authorization was denied on Oura's site.",
    steps: [
      "Click \"Connect\" again and make sure to tap \"Allow\" when Oura asks for permission.",
      "If you didn't intend to deny access, your browser may have blocked the pop-up — check your pop-up blocker settings.",
    ],
  },
  missing_code: {
    title: "No authorization code was received from Oura.",
    steps: [
      "Try connecting again — the previous request may have expired or been interrupted.",
      "Make sure you're not using a browser extension that strips URL parameters.",
      "Clear your browser cookies for cloud.ouraring.com and try again.",
    ],
  },
  missing_env: {
    title: "The Oura integration is not configured on the server.",
    steps: [
      "This is a server configuration issue — please contact support.",
      "If you are the site admin, verify that OURA_CLIENT_ID and OURA_CLIENT_SECRET are set in your environment variables.",
    ],
  },
  token_exchange: {
    title: "Failed to exchange your authorization for an access token.",
    steps: [
      "This is usually a temporary issue — wait a minute and try connecting again.",
      "Make sure your Oura account is in good standing at cloud.ouraring.com.",
      "Check that your internet connection is stable.",
      "If the problem persists, the Oura API may be experiencing downtime — try again later.",
    ],
  },
  not_authenticated: {
    title: "Your session expired during the Oura connection flow.",
    steps: [
      "Log in again, then go to Profile and click \"Connect\" to retry.",
      "Avoid leaving the Oura authorization page open for too long before approving.",
    ],
  },
  db_write: {
    title: "Your Oura tokens were received but couldn't be saved.",
    steps: [
      "Try connecting again — this is usually a transient database issue.",
      "If the problem persists, contact support and mention error code \"db_write\".",
    ],
  },
}

function isOuraErrorReason(value: string): value is OuraErrorReason {
  return value in ouraErrorInfo
}

export default function ProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const [feedback, setFeedback] = useState<FeedbackMessage>(null)
  const [ouraErrorReason, setOuraErrorReason] = useState<OuraErrorReason | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [disconnectingOura, setDisconnectingOura] = useState(false)

  // Form state
  const [displayName, setDisplayName] = useState("")
  const [age, setAge] = useState("")
  const [sex, setSex] = useState("")
  const [heightFeet, setHeightFeet] = useState("")
  const [heightInches, setHeightInches] = useState("")
  const [currentWeight, setCurrentWeight] = useState("")
  const [fitnessLevel, setFitnessLevel] = useState("")
  const [primaryGoal, setPrimaryGoal] = useState("")
  const [targetWeight, setTargetWeight] = useState("")
  const [workoutDays, setWorkoutDays] = useState("")
  const [limitations, setLimitations] = useState("")

  // Fetch auth user
  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      return user
    },
  })

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["profile-stats"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Total workouts
      const { count: totalWorkouts } = await supabase
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)

      // Total weight lifted
      const { data: setData } = await supabase
        .from("set_logs")
        .select(
          "weight, reps, exercise_log:exercise_logs!inner(workout_log:workout_logs!inner(user_id))"
        )
        .eq("exercise_log.workout_log.user_id", user.id)
        .not("weight", "is", null)

      let totalWeight = 0
      if (setData) {
        for (const s of setData as any[]) {
          totalWeight += (s.weight ?? 0) * (s.reps ?? 1)
        }
      }

      // Current streak (consecutive weeks with at least one workout)
      const { data: workoutDates } = await supabase
        .from("workout_logs")
        .select("started_at")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })

      let streakWeeks = 0
      if (workoutDates && workoutDates.length > 0) {
        const now = new Date()
        const getWeekStart = (d: Date) => {
          const date = new Date(d)
          const day = date.getDay()
          const diff = date.getDate() - day + (day === 0 ? -6 : 1)
          date.setDate(diff)
          date.setHours(0, 0, 0, 0)
          return date.getTime()
        }

        const workoutWeeks = new Set(
          workoutDates.map((w) => getWeekStart(new Date(w.started_at)))
        )

        let currentWeekStart = getWeekStart(now)
        // Check if current week has a workout; if not, start from last week
        if (!workoutWeeks.has(currentWeekStart)) {
          currentWeekStart -= 7 * 24 * 60 * 60 * 1000
        }

        while (workoutWeeks.has(currentWeekStart)) {
          streakWeeks++
          currentWeekStart -= 7 * 24 * 60 * 60 * 1000
        }
      }

      return {
        totalWorkouts: totalWorkouts ?? 0,
        streakWeeks,
        totalWeight,
      }
    },
  })

  // Check if Oura is connected
  const { data: ouraConnected, isLoading: ouraLoading } = useQuery({
    queryKey: ["oura-connected"],
    queryFn: async () => {
      const res = await fetch("/api/oura")
      if (res.status === 404) return false
      if (res.ok) return true
      return false
    },
  })

  // Handle ?oura= query param feedback
  useEffect(() => {
    const ouraParam = searchParams.get("oura")
    if (ouraParam === "connected") {
      setFeedback({ type: "success", text: "Oura Ring connected successfully!" })
      setOuraErrorReason(null)
      queryClient.invalidateQueries({ queryKey: ["oura-connected"] })
      router.replace("/profile")
    } else if (ouraParam === "error") {
      const reason = searchParams.get("oura_reason") ?? ""
      if (isOuraErrorReason(reason)) {
        setOuraErrorReason(reason)
      } else {
        setOuraErrorReason(null)
      }
      setFeedback({ type: "error", text: "Failed to connect Oura Ring." })
      router.replace("/profile")
    }
  }, [searchParams, queryClient, router])

  function connectOura() {
    const clientId = process.env.NEXT_PUBLIC_OURA_CLIENT_ID
    const redirectUri = `${window.location.origin}/api/auth/oura/callback`
    // `ring_configuration` gates ring/device data, including the
    // ring_battery_level endpoint that powers the dashboard battery pill.
    const scope =
      "daily sleep heartrate personal spo2 stress ring_configuration"
    const url = `https://cloud.ouraring.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`
    window.location.href = url
  }

  async function disconnectOura() {
    setDisconnectingOura(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      // Delete the oura token row
      await (supabase as unknown as {
        from: (table: string) => {
          delete: () => { eq: (col: string, val: string) => Promise<unknown> }
        }
      })
        .from("oura_tokens")
        .delete()
        .eq("user_id", user.id)
      queryClient.invalidateQueries({ queryKey: ["oura-connected"] })
      queryClient.invalidateQueries({ queryKey: ["oura-summary"] })
      setFeedback({ type: "success", text: "Oura Ring disconnected." })
    } catch {
      setFeedback({ type: "error", text: "Failed to disconnect Oura Ring." })
    } finally {
      setDisconnectingOura(false)
    }
  }

  // Populate form when profile loads
  const populateForm = useCallback(() => {
    if (!profile) return
    setDisplayName(profile.display_name ?? "")
    setAge(profile.age?.toString() ?? "")
    setSex(profile.sex ?? "")
    setHeightFeet(
      profile.height_inches
        ? Math.floor(profile.height_inches / 12).toString()
        : ""
    )
    setHeightInches(
      profile.height_inches ? (profile.height_inches % 12).toString() : ""
    )
    setCurrentWeight(profile.current_weight?.toString() ?? "")
    setFitnessLevel(profile.fitness_level ?? "")
    setPrimaryGoal(profile.primary_goal ?? "")
    setTargetWeight(profile.target_weight?.toString() ?? "")
    setWorkoutDays(profile.workout_days?.toString() ?? "")
    setLimitations(profile.limitations ?? "")
  }, [profile])

  useEffect(() => {
    populateForm()
  }, [populateForm])

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: UserProfileUpdate) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      setFeedback({ type: "success", text: "Profile updated successfully." })
    },
    onError: (err: Error) => {
      setFeedback({
        type: "error",
        text: err.message || "Failed to update profile.",
      })
    },
  })

  // Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      // Delete profile (cascade should handle related data)
      const { error } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", user.id)
      if (error) throw error
      await supabase.auth.signOut()
    },
    onSuccess: () => {
      router.push("/")
    },
    onError: (err: Error) => {
      setFeedback({
        type: "error",
        text: err.message || "Failed to delete account.",
      })
      setDeleteDialogOpen(false)
    },
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return

    const updates: UserProfileUpdate = {}

    const newName = displayName.trim() || null
    if (newName !== profile.display_name) updates.display_name = newName

    const newAge = age ? parseInt(age, 10) : null
    if (newAge !== profile.age) updates.age = newAge

    const newSex = (sex || null) as typeof profile.sex
    if (newSex !== profile.sex) updates.sex = newSex

    const newHeightInches =
      heightFeet || heightInches
        ? (parseInt(heightFeet || "0", 10) * 12 +
            parseInt(heightInches || "0", 10)) ||
          null
        : null
    if (newHeightInches !== profile.height_inches)
      updates.height_inches = newHeightInches

    const newCurrentWeight = currentWeight ? parseFloat(currentWeight) : null
    if (newCurrentWeight !== profile.current_weight)
      updates.current_weight = newCurrentWeight

    const newFitnessLevel = (fitnessLevel || null) as typeof profile.fitness_level
    if (newFitnessLevel !== profile.fitness_level)
      updates.fitness_level = newFitnessLevel

    const newPrimaryGoal = (primaryGoal || null) as typeof profile.primary_goal
    if (newPrimaryGoal !== profile.primary_goal)
      updates.primary_goal = newPrimaryGoal

    const newTargetWeight = targetWeight ? parseFloat(targetWeight) : null
    if (newTargetWeight !== profile.target_weight)
      updates.target_weight = newTargetWeight

    const newWorkoutDays = workoutDays ? parseInt(workoutDays, 10) : null
    if (newWorkoutDays !== profile.workout_days)
      updates.workout_days = newWorkoutDays

    const newLimitations = limitations.trim() || null
    if (newLimitations !== profile.limitations)
      updates.limitations = newLimitations

    if (Object.keys(updates).length === 0) {
      setFeedback({ type: "success", text: "No changes to save." })
      return
    }

    updateMutation.mutate(updates)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
  }

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

  const goalLabel: Record<string, string> = {
    lose_weight: "Lose Weight",
    build_muscle: "Build Muscle",
    improve_endurance: "Improve Endurance",
    general_fitness: "General Fitness",
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-500" />
            Profile Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            {/* Display Name */}
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            {/* Age & Sex */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  min={13}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Age"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sex">Sex</Label>
                <Select
                  id="sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </div>
            </div>

            {/* Height */}
            <div className="space-y-1.5">
              <Label>Height</Label>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  value={heightFeet}
                  onChange={(e) => setHeightFeet(e.target.value)}
                >
                  <option value="">Feet</option>
                  {[3, 4, 5, 6, 7].map((ft) => (
                    <option key={ft} value={ft.toString()}>
                      {ft} ft
                    </option>
                  ))}
                </Select>
                <Select
                  value={heightInches}
                  onChange={(e) => setHeightInches(e.target.value)}
                >
                  <option value="">Inches</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i.toString()}>
                      {i} in
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Current Weight */}
            <div className="space-y-1.5">
              <Label htmlFor="currentWeight">Current Weight (lbs)</Label>
              <Input
                id="currentWeight"
                type="number"
                min={50}
                max={800}
                step="0.1"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                placeholder="Current weight"
              />
            </div>

            {/* Fitness Level */}
            <div className="space-y-1.5">
              <Label htmlFor="fitnessLevel">Fitness Level</Label>
              <Select
                id="fitnessLevel"
                value={fitnessLevel}
                onChange={(e) => setFitnessLevel(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </div>

            {/* Primary Goal */}
            <div className="space-y-1.5">
              <Label htmlFor="primaryGoal">Primary Goal</Label>
              <Select
                id="primaryGoal"
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="lose_weight">Lose Weight</option>
                <option value="build_muscle">Build Muscle</option>
                <option value="improve_endurance">Improve Endurance</option>
                <option value="general_fitness">General Fitness</option>
              </Select>
            </div>

            {/* Target Weight */}
            <div className="space-y-1.5">
              <Label htmlFor="targetWeight">Target Weight (lbs, optional)</Label>
              <Input
                id="targetWeight"
                type="number"
                min={50}
                max={800}
                step="0.1"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                placeholder="Target weight"
              />
            </div>

            {/* Workout Days */}
            <div className="space-y-1.5">
              <Label htmlFor="workoutDays">Workout Days per Week</Label>
              <Select
                id="workoutDays"
                value={workoutDays}
                onChange={(e) => setWorkoutDays(e.target.value)}
              >
                <option value="">Select...</option>
                {[2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d.toString()}>
                    {d} days
                  </option>
                ))}
              </Select>
            </div>

            {/* Limitations */}
            <div className="space-y-1.5">
              <Label htmlFor="limitations">Limitations / Injuries</Label>
              <Textarea
                id="limitations"
                value={limitations}
                onChange={(e) => setLimitations(e.target.value)}
                placeholder="E.g., bad knees, lower back pain..."
                rows={3}
              />
            </div>

            {/* Save Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={updateMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Oura Ring Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-500" />
            Connected Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-gray-600"
                  fill="currentColor"
                >
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Oura Ring</p>
                <p className="text-xs text-gray-500">
                  {ouraLoading
                    ? "Checking..."
                    : ouraConnected
                      ? "Connected — syncing sleep, activity & readiness"
                      : "Connect to sync sleep, activity & heart rate data"}
                </p>
              </div>
            </div>
            {ouraConnected ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={disconnectOura}
                disabled={disconnectingOura}
                className="shrink-0 gap-1.5"
              >
                <Unlink className="h-3.5 w-3.5" />
                {disconnectingOura ? "..." : "Disconnect"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setOuraErrorReason(null)
                  connectOura()
                }}
                className="shrink-0 gap-1.5"
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect
              </Button>
            )}
          </div>

          {/* Oura troubleshooting panel */}
          {ouraErrorReason && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-amber-800">
                    {ouraErrorInfo[ouraErrorReason].title}
                  </p>
                  <p className="text-xs font-medium text-amber-700">
                    Troubleshooting steps:
                  </p>
                  <ol className="list-decimal space-y-1 pl-4 text-xs text-amber-700">
                    {ouraErrorInfo[ouraErrorReason].steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  <button
                    type="button"
                    onClick={() => setOuraErrorReason(null)}
                    className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 underline hover:text-amber-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-500" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Email */}
          <div className="space-y-1.5">
            <Label>Email</Label>
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {authUser?.email ?? "..."}
            </p>
          </div>

          {/* Sign Out */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>

          {/* Delete Account */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Account</DialogTitle>
              </DialogHeader>
              <p className="py-4 text-sm text-gray-600">
                Are you sure you want to delete your account? This action cannot
                be undone. All your workout data, progress, and settings will be
                permanently removed.
              </p>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending
                    ? "Deleting..."
                    : "Yes, Delete My Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}
