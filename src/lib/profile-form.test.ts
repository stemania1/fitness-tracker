import { describe, it, expect } from "vitest"
import { DEFAULT_SLEEP_GOAL_HOURS } from "./bedtime"
import { DEFAULT_CREATINE_TARGET_G } from "./creatine-streak"
import {
  buildProfileUpdates,
  totalHeightInches,
  type ProfileFormValues,
  type StoredProfile,
} from "./profile-form"

const stored: StoredProfile = {
  display_name: "Curtis",
  age: 44,
  sex: "male",
  height_inches: 70,
  current_weight: 230,
  fitness_level: "intermediate",
  primary_goal: "build_muscle",
  target_weight: 200,
  workout_days: 3,
  limitations: null,
  wake_time: "05:30",
  sleep_goal_hours: DEFAULT_SLEEP_GOAL_HOURS,
  weekday_workout_minutes: 25,
  weekend_workout_minutes: 60,
  creatine_target_g: DEFAULT_CREATINE_TARGET_G,
}

/** A form that exactly matches `stored` — the "nothing changed" baseline. */
function form(over: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return {
    displayName: "Curtis",
    age: "44",
    sex: "male",
    heightFeet: "5",
    heightInches: "10",
    currentWeight: "230",
    fitnessLevel: "intermediate",
    primaryGoal: "build_muscle",
    targetWeight: "200",
    workoutDays: "3",
    limitations: "",
    wakeTime: "05:30",
    sleepGoalHours: String(DEFAULT_SLEEP_GOAL_HOURS),
    weekdayMinutes: "25",
    weekendMinutes: "60",
    creatineTargetG: String(DEFAULT_CREATINE_TARGET_G),
    ...over,
  }
}

describe("totalHeightInches", () => {
  it("combines feet and inches", () => {
    expect(totalHeightInches("5", "10")).toBe(70)
    expect(totalHeightInches("6", "0")).toBe(72)
  })

  it("is null when both are empty", () => {
    expect(totalHeightInches("", "")).toBeNull()
  })

  it("treats a zero total as unset rather than 0 inches", () => {
    expect(totalHeightInches("0", "0")).toBeNull()
  })

  it("accepts inches alone", () => {
    expect(totalHeightInches("", "9")).toBe(9)
  })
})

describe("buildProfileUpdates", () => {
  it("returns nothing when the form matches what's stored", () => {
    expect(buildProfileUpdates(form(), stored)).toEqual({})
  })

  it("includes only the field that changed", () => {
    expect(buildProfileUpdates(form({ age: "45" }), stored)).toEqual({ age: 45 })
  })

  it("trims the name and treats blank as null", () => {
    expect(buildProfileUpdates(form({ displayName: "  Curtis  " }), stored)).toEqual({})
    expect(buildProfileUpdates(form({ displayName: "   " }), stored)).toEqual({
      display_name: null,
    })
  })

  it("clears a numeric field when emptied", () => {
    expect(buildProfileUpdates(form({ targetWeight: "" }), stored)).toEqual({
      target_weight: null,
    })
  })

  it("converts height back to total inches", () => {
    expect(buildProfileUpdates(form({ heightFeet: "6", heightInches: "1" }), stored))
      .toEqual({ height_inches: 73 })
  })

  it("falls back to defaults for the fields that have them", () => {
    expect(
      buildProfileUpdates(
        form({ sleepGoalHours: "", weekdayMinutes: "", weekendMinutes: "", creatineTargetG: "" }),
        { ...stored, sleep_goal_hours: 9, weekday_workout_minutes: 40, weekend_workout_minutes: 90, creatine_target_g: 10 }
      )
    ).toEqual({
      sleep_goal_hours: DEFAULT_SLEEP_GOAL_HOURS,
      weekday_workout_minutes: 25,
      weekend_workout_minutes: 60,
      creatine_target_g: DEFAULT_CREATINE_TARGET_G,
    })
  })

  // NaN never equals the stored value, so an unparseable field would look
  // "changed" and write NaN to the column on every single save.
  it("never emits NaN from an unparseable value", () => {
    const updates = buildProfileUpdates(
      form({ age: "abc", currentWeight: "??", targetWeight: "n/a" }),
      stored
    )
    for (const value of Object.values(updates)) {
      expect(Number.isNaN(value as number)).toBe(false)
    }
    expect(updates).toEqual({ age: null, current_weight: null, target_weight: null })
  })

  it("collects several changes at once", () => {
    expect(
      buildProfileUpdates(form({ age: "45", limitations: "bad knee" }), stored)
    ).toEqual({ age: 45, limitations: "bad knee" })
  })
})
