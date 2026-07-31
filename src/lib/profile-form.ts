/**
 * Turn the profile form's string fields into the set of columns that actually
 * changed.
 *
 * This was ~90 lines inline in the profile page: sixteen parse-and-compare
 * blocks, each easy to get subtly wrong and none of them testable without
 * mounting a 1,000-line page. Only changed columns are sent, so an unchanged
 * field is never written.
 */

import type { UserProfileUpdate } from "@/types/database"
import { DEFAULT_SLEEP_GOAL_HOURS } from "./bedtime"
import { DEFAULT_CREATINE_TARGET_G } from "./creatine-streak"

/** Raw form values, all strings as they come out of the inputs. */
export interface ProfileFormValues {
  displayName: string
  age: string
  sex: string
  heightFeet: string
  heightInches: string
  currentWeight: string
  fitnessLevel: string
  primaryGoal: string
  targetWeight: string
  workoutDays: string
  limitations: string
  wakeTime: string
  sleepGoalHours: string
  weekdayMinutes: string
  weekendMinutes: string
  creatineTargetG: string
}

/** The stored values the form is compared against. */
export interface StoredProfile {
  display_name: string | null
  age: number | null
  sex: string | null
  height_inches: number | null
  current_weight: number | null
  fitness_level: string | null
  primary_goal: string | null
  target_weight: number | null
  workout_days: number | null
  limitations: string | null
  wake_time: string | null
  sleep_goal_hours: number | null
  weekday_workout_minutes: number | null
  weekend_workout_minutes: number | null
  creatine_target_g: number | null
}

/**
 * Parse to a number, treating anything unparseable as absent.
 *
 * The guard matters: `parseInt("abc")` is NaN, and NaN never equals the stored
 * value, so a junk field would be seen as "changed" and NaN written to the
 * column on every save. Number inputs make that unlikely by hand, but a paste
 * or an autofill can produce it.
 */
function num(value: string, parse: (s: string) => number): number | null {
  if (!value) return null
  const n = parse(value)
  return Number.isFinite(n) ? n : null
}

/** Total inches from separate feet and inches fields; null when both empty. */
export function totalHeightInches(feet: string, inches: string): number | null {
  if (!feet && !inches) return null
  const f = num(feet, (s) => parseInt(s, 10)) ?? 0
  const i = num(inches, (s) => parseInt(s, 10)) ?? 0
  const total = f * 12 + i
  return total || null
}

/**
 * The columns whose form value differs from what's stored. An empty object
 * means there is nothing to save.
 */
export function buildProfileUpdates(
  form: ProfileFormValues,
  profile: StoredProfile
): UserProfileUpdate {
  const updates: UserProfileUpdate = {}
  const set = <K extends keyof UserProfileUpdate>(
    key: K,
    next: UserProfileUpdate[K],
    current: unknown
  ) => {
    if (next !== current) updates[key] = next
  }

  set("display_name", form.displayName.trim() || null, profile.display_name)
  set("age", num(form.age, (s) => parseInt(s, 10)), profile.age)
  set("sex", (form.sex || null) as UserProfileUpdate["sex"], profile.sex)
  set(
    "height_inches",
    totalHeightInches(form.heightFeet, form.heightInches),
    profile.height_inches
  )
  set(
    "current_weight",
    num(form.currentWeight, parseFloat),
    profile.current_weight
  )
  set(
    "fitness_level",
    (form.fitnessLevel || null) as UserProfileUpdate["fitness_level"],
    profile.fitness_level
  )
  set(
    "primary_goal",
    (form.primaryGoal || null) as UserProfileUpdate["primary_goal"],
    profile.primary_goal
  )
  set("target_weight", num(form.targetWeight, parseFloat), profile.target_weight)
  set(
    "workout_days",
    num(form.workoutDays, (s) => parseInt(s, 10)),
    profile.workout_days
  )
  set("limitations", form.limitations.trim() || null, profile.limitations)
  set("wake_time", form.wakeTime || null, profile.wake_time)
  set(
    "sleep_goal_hours",
    num(form.sleepGoalHours, parseFloat) ?? DEFAULT_SLEEP_GOAL_HOURS,
    profile.sleep_goal_hours
  )
  set(
    "weekday_workout_minutes",
    num(form.weekdayMinutes, (s) => parseInt(s, 10)) ?? 25,
    profile.weekday_workout_minutes
  )
  set(
    "weekend_workout_minutes",
    num(form.weekendMinutes, (s) => parseInt(s, 10)) ?? 60,
    profile.weekend_workout_minutes
  )
  set(
    "creatine_target_g",
    num(form.creatineTargetG, parseFloat) ?? DEFAULT_CREATINE_TARGET_G,
    profile.creatine_target_g
  )

  return updates
}
