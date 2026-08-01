"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { currentWeekStreak, totalWeightLifted } from "@/lib/profile-stats"
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
  KeyRound,
} from "lucide-react"
import type { UserProfileUpdate } from "@/types/database"
import { buildProfileUpdates } from "@/lib/profile-form"
import { ReminderSettingsCard } from "@/components/activity/ReminderSettingsCard"
import { DiagnosticsCard } from "@/components/pwa/DiagnosticsCard"
import { OuraConnectionCard } from "@/components/profile/OuraConnectionCard"
import { normalizeReminderSettings } from "@/lib/reminder-settings"
import { DEFAULT_SLEEP_GOAL_HOURS } from "@/lib/bedtime"
import { DEFAULT_CREATINE_TARGET_G } from "@/lib/creatine-streak"
import { useUserQuery, getAuthUser, getAuthUserId } from "@/lib/supabase/user-query"
import { useProfile } from "@/hooks/useProfile"

const supabase = createClient()

type FeedbackMessage = {
  type: "success" | "error"
  text: string
} | null

export default function ProfilePage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [feedback, setFeedback] = useState<FeedbackMessage>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

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
  const [wakeTime, setWakeTime] = useState("")
  const [sleepGoalHours, setSleepGoalHours] = useState("")
  const [weekdayMinutes, setWeekdayMinutes] = useState("")
  const [weekendMinutes, setWeekendMinutes] = useState("")
  const [creatineTargetG, setCreatineTargetG] = useState("")

  // Fetch auth user (shares the session-cached lookup)
  const { data: authUser } = useQuery({
    queryKey: ["auth-user"],
    queryFn: getAuthUser,
  })

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
    setWakeTime(profile.wake_time ?? "")
    setSleepGoalHours(profile.sleep_goal_hours?.toString() ?? "")
    setWeekdayMinutes(profile.weekday_workout_minutes?.toString() ?? "")
    setWeekendMinutes(profile.weekend_workout_minutes?.toString() ?? "")
    setCreatineTargetG(profile.creatine_target_g?.toString() ?? "")
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
      const userId = await getAuthUserId()
      const { error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", userId)
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
      const userId = await getAuthUserId()
      // Delete profile (cascade should handle related data)
      const { error } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", userId)
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

    // The parse-and-compare lives in lib/profile-form.ts (pure + tested);
    // only changed columns are sent.
    const updates = buildProfileUpdates(
      {
        displayName,
        age,
        sex,
        heightFeet,
        heightInches,
        currentWeight,
        fitnessLevel,
        primaryGoal,
        targetWeight,
        workoutDays,
        limitations,
        wakeTime,
        sleepGoalHours,
        weekdayMinutes,
        weekendMinutes,
        creatineTargetG,
      },
      profile
    )

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

            {/* Wake time + sleep goal, for the bedtime target */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wakeTime">Usual wake time</Label>
                <Input
                  id="wakeTime"
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sleepGoalHours">Sleep goal (hrs)</Label>
                <Input
                  id="sleepGoalHours"
                  type="number"
                  min="4"
                  max="12"
                  step="0.5"
                  placeholder={DEFAULT_SLEEP_GOAL_HOURS.toString()}
                  value={sleepGoalHours}
                  onChange={(e) => setSleepGoalHours(e.target.value)}
                />
              </div>
            </div>
            <p className="-mt-3 text-xs text-gray-400">
              Set your usual wake time and the dashboard will work backward to
              a target bedtime and caffeine cutoff.
            </p>

            {/* Realistic time budget, for the weekly schedule */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="weekdayMinutes">Weekday minutes</Label>
                <Input
                  id="weekdayMinutes"
                  type="number"
                  min="10"
                  max="180"
                  step="5"
                  placeholder="25"
                  value={weekdayMinutes}
                  onChange={(e) => setWeekdayMinutes(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weekendMinutes">Weekend minutes</Label>
                <Input
                  id="weekendMinutes"
                  type="number"
                  min="10"
                  max="240"
                  step="5"
                  placeholder="60"
                  value={weekendMinutes}
                  onChange={(e) => setWeekendMinutes(e.target.value)}
                />
              </div>
            </div>
            <p className="-mt-3 text-xs text-gray-400">
              How much time you realistically have to train. The weekly plan
              puts short sessions on weekdays and the longer work on weekends.
            </p>

            {/* Daily creatine target */}
            <div className="space-y-1.5">
              <Label htmlFor="creatineTargetG">
                Daily creatine target (g)
              </Label>
              <Input
                id="creatineTargetG"
                type="number"
                min="1"
                max="30"
                step="0.5"
                placeholder={DEFAULT_CREATINE_TARGET_G.toString()}
                value={creatineTargetG}
                onChange={(e) => setCreatineTargetG(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                5 g is the classic maintenance dose; some protocols use ~10 g,
                often split across the day. Doses add up toward this target.
              </p>
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
      <OuraConnectionCard onFeedback={setFeedback} />

      {/* Reminder preferences */}
      <ReminderSettingsCard
        initial={normalizeReminderSettings(profile?.reminder_settings)}
      />

      {/* Diagnostics — off by default; the only way to reach the viewport
          readout in an installed PWA, which has no address bar. */}
      <DiagnosticsCard />

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

          {/* Change Password */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => router.push("/update-password")}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Change Password
          </Button>

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
