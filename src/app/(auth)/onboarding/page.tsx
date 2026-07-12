"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectOption } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Scale,
  Dumbbell,
  Heart,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

const TOTAL_STEPS = 4

const FITNESS_LEVELS = [
  {
    value: "beginner",
    label: "Beginner",
    description: "New to working out or returning after a long break",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    description: "Working out regularly for 3-12 months",
  },
  {
    value: "advanced",
    label: "Advanced",
    description: "Consistent training for over a year",
  },
]

const GOALS = [
  {
    value: "lose_weight",
    label: "Lose Weight",
    description: "Burn fat and slim down",
    icon: Scale,
  },
  {
    value: "build_muscle",
    label: "Build Muscle",
    description: "Get stronger and build size",
    icon: Dumbbell,
  },
  {
    value: "improve_endurance",
    label: "Improve Endurance",
    description: "Better cardio and stamina",
    icon: Heart,
  },
  {
    value: "general_fitness",
    label: "General Fitness",
    description: "Overall health and wellness",
    icon: Activity,
  },
]

const DAYS_OPTIONS = [2, 3, 4, 5, 6]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Basic Info
  const [displayName, setDisplayName] = useState("")
  const [age, setAge] = useState("")
  const [sex, setSex] = useState("")
  const [heightFeet, setHeightFeet] = useState("")
  const [heightInches, setHeightInches] = useState("0")
  const [currentWeight, setCurrentWeight] = useState("")

  // Step 2: Fitness Level
  const [fitnessLevel, setFitnessLevel] = useState("")

  // Step 3: Goal
  const [goal, setGoal] = useState("")

  // Step 4: Schedule & Target
  const [daysPerWeek, setDaysPerWeek] = useState<number>(3)
  const [targetWeight, setTargetWeight] = useState("")
  const [injuries, setInjuries] = useState("")

  const progressValue = (step / TOTAL_STEPS) * 100

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return (
          displayName.trim() !== "" &&
          age !== "" &&
          sex !== "" &&
          heightFeet !== "" &&
          currentWeight !== ""
        )
      case 2:
        return fitnessLevel !== ""
      case 3:
        return goal !== ""
      case 4:
        return true
      default:
        return false
    }
  }

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep(step + 1)
      setError(null)
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1)
      setError(null)
    }
  }

  async function handleComplete() {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("You must be logged in to complete onboarding.")
        setLoading(false)
        return
      }

      const totalHeightInches =
        parseInt(heightFeet) * 12 + parseInt(heightInches)

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({
          display_name: displayName.trim(),
          age: parseInt(age),
          sex: sex as "male" | "female" | "other",
          height_inches: totalHeightInches,
          current_weight: parseFloat(currentWeight),
          fitness_level: fitnessLevel as "beginner" | "intermediate" | "advanced",
          primary_goal: goal as "lose_weight" | "build_muscle" | "improve_endurance" | "general_fitness",
          workout_days: daysPerWeek,
          target_weight: targetWeight ? parseFloat(targetWeight) : null,
          limitations: injuries.trim() || null,
          onboarding_done: true,
        })
        .eq("id", user.id)

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      router.push("/dashboard")
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="w-full max-w-2xl mx-auto px-4 pt-8 pb-4">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
          <span>Step {step} of {TOTAL_STEPS}</span>
          <span>{Math.round(progressValue)}%</span>
        </div>
        <Progress value={progressValue} />
      </div>

      {/* Content */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 pb-8">
        <div className="mb-8">
          {step === 1 && (
            <h1 className="text-2xl font-bold text-gray-900">
              Tell us about yourself
            </h1>
          )}
          {step === 2 && (
            <h1 className="text-2xl font-bold text-gray-900">
              What&apos;s your fitness level?
            </h1>
          )}
          {step === 3 && (
            <h1 className="text-2xl font-bold text-gray-900">
              What&apos;s your main goal?
            </h1>
          )}
          {step === 4 && (
            <h1 className="text-2xl font-bold text-gray-900">
              Set your schedule & targets
            </h1>
          )}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="How should we call you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="25"
                  min={13}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <Select
                  id="sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                >
                  <SelectOption value="" disabled>
                    Select
                  </SelectOption>
                  <SelectOption value="male">Male</SelectOption>
                  <SelectOption value="female">Female</SelectOption>
                  <SelectOption value="other">Other</SelectOption>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Height</Label>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  value={heightFeet}
                  onChange={(e) => setHeightFeet(e.target.value)}
                >
                  <SelectOption value="" disabled>
                    Feet
                  </SelectOption>
                  {[4, 5, 6, 7].map((ft) => (
                    <SelectOption key={ft} value={String(ft)}>
                      {ft} ft
                    </SelectOption>
                  ))}
                </Select>
                <Select
                  value={heightInches}
                  onChange={(e) => setHeightInches(e.target.value)}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectOption key={i} value={String(i)}>
                      {i} in
                    </SelectOption>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentWeight">Current Weight (lbs)</Label>
              <Input
                id="currentWeight"
                type="number"
                placeholder="160"
                min={50}
                max={800}
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 2: Fitness Level */}
        {step === 2 && (
          <div className="space-y-4">
            {FITNESS_LEVELS.map((level) => (
              <Card
                key={level.value}
                className={`p-5 cursor-pointer transition-all ${
                  fitnessLevel === level.value
                    ? "border-2 border-purple-600 ring-1 ring-purple-600"
                    : "hover:border-gray-300"
                }`}
                onClick={() => setFitnessLevel(level.value)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {level.label}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {level.description}
                    </p>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      fitnessLevel === level.value
                        ? "border-purple-600"
                        : "border-gray-300"
                    }`}
                  >
                    {fitnessLevel === level.value && (
                      <div className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Step 3: Goal */}
        {step === 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {GOALS.map((g) => {
              const Icon = g.icon
              return (
                <Card
                  key={g.value}
                  className={`p-5 cursor-pointer transition-all ${
                    goal === g.value
                      ? "border-2 border-purple-600 ring-1 ring-purple-600"
                      : "hover:border-gray-300"
                  }`}
                  onClick={() => setGoal(g.value)}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        goal === g.value
                          ? "bg-purple-100 text-purple-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {g.label}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {g.description}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Step 4: Schedule & Target */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>How many days per week can you work out?</Label>
              <div className="flex gap-2">
                {DAYS_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysPerWeek(d)}
                    className={`flex-1 h-12 rounded-lg text-sm font-medium transition-colors ${
                      daysPerWeek === d
                        ? "bg-purple-600 text-white"
                        : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetWeight">Target Weight (lbs, optional)</Label>
              <Input
                id="targetWeight"
                type="number"
                placeholder="150"
                min={50}
                max={800}
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="injuries">
                Any injuries or limitations? (optional)
              </Label>
              <Textarea
                id="injuries"
                placeholder="E.g., bad knees, lower back pain..."
                rows={3}
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {step > 1 ? (
            <Button variant="secondary" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={loading}
            >
              {loading ? "Saving..." : "Complete Setup"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
