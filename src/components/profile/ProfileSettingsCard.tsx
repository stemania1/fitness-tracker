"use client"

import { useState, useEffect, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { User, Save } from "lucide-react"
import type { UserProfileUpdate } from "@/types/database"
import { buildProfileUpdates } from "@/lib/profile-form"
import { DEFAULT_SLEEP_GOAL_HOURS } from "@/lib/bedtime"
import { DEFAULT_CREATINE_TARGET_G } from "@/lib/creatine-streak"
import { DEFAULT_STEP_GOAL } from "@/lib/daily-movement"
import { getAuthUserId } from "@/lib/supabase/user-query"
import { useProfile } from "@/hooks/useProfile"
import type { ProfileFeedback } from "./feedback"

const supabase = createClient()

interface ProfileSettingsCardProps {
  /** Surfaced in the profile page's shared banner. */
  onFeedback: (feedback: ProfileFeedback) => void
}

/**
 * The Profile Settings form: every editable `user_profiles` column, from
 * display name down to limitations.
 *
 * Self-fetching, like the other cards extracted from the profile page — it
 * reads the profile through `useProfile()` (shared cache key, so the page's
 * header reads the same row) and owns the fifteen field states plus the
 * update mutation. The parse-and-compare on save stays in
 * `lib/profile-form.ts`; only changed columns are sent.
 */
export function ProfileSettingsCard({ onFeedback }: ProfileSettingsCardProps) {
  const queryClient = useQueryClient()
  const { data: profile } = useProfile()

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
  const [dailyStepGoal, setDailyStepGoal] = useState("")

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
    setDailyStepGoal(profile.daily_step_goal?.toString() ?? "")
  }, [profile])

  useEffect(() => {
    populateForm()
  }, [populateForm])

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
      onFeedback({ type: "success", text: "Profile updated successfully." })
    },
    onError: (err: Error) => {
      onFeedback({
        type: "error",
        text: err.message || "Failed to update profile.",
      })
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
        dailyStepGoal,
      },
      profile
    )

    if (Object.keys(updates).length === 0) {
      onFeedback({ type: "success", text: "No changes to save." })
      return
    }

    updateMutation.mutate(updates)
  }

  return (
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

          {/* Daily step goal */}
          <div className="space-y-1.5">
            <Label htmlFor="dailyStepGoal">Daily step goal</Label>
            <Input
              id="dailyStepGoal"
              type="number"
              min="1000"
              max="30000"
              step="500"
              placeholder={DEFAULT_STEP_GOAL.toString()}
              value={dailyStepGoal}
              onChange={(e) => setDailyStepGoal(e.target.value)}
            />
            <p className="text-xs text-gray-400">
              What Daily Movement paces you against. 10,000 is a 1960s
              pedometer slogan, not a finding — the health curve flattens
              nearer 8,000, which is also a target you can hit on a workday.
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
  )
}
