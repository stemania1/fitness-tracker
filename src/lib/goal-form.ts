/**
 * The Add Goal form's business rules, extracted from the goals page so they
 * can be unit-tested: which unit a goal type tracks (the unit is load-bearing
 * — it tells goal progress which logged best to read) and turning the form
 * into a typed `user_goals` insert. The insert was previously built inline
 * with an `as any` cast.
 */

import type { Database } from "@/types/database"
import { ENDURANCE_DISTANCE_UNIT } from "./goal-progress"

export type UserGoalInsert =
  Database["public"]["Tables"]["user_goals"]["Insert"]

export type GoalType = "weight" | "strength" | "endurance" | "consistency"

/** Endurance only: chase a longer session or a further one. */
export type EnduranceMetric = "duration" | "distance"

export interface AddGoalFormState {
  goalType: GoalType
  exerciseId: string
  targetValue: string
  deadline: string
  enduranceMetric: EnduranceMetric
}

export const initialGoalFormState: AddGoalFormState = {
  goalType: "weight",
  exerciseId: "",
  targetValue: "",
  deadline: "",
  enduranceMetric: "duration",
}

export function unitForGoalType(
  goalType: GoalType,
  enduranceMetric: EnduranceMetric = "duration"
): string {
  switch (goalType) {
    case "weight":
      return "lbs"
    case "strength":
      return "lbs"
    case "endurance":
      // The unit is what tells progress which best to read — see
      // isDistanceGoal in lib/goal-progress.
      return enduranceMetric === "distance" ? ENDURANCE_DISTANCE_UNIT : "mins"
    case "consistency":
      return "workouts/week"
  }
}

/**
 * The typed insert row for a new goal. Throws on a non-positive target;
 * exercise_id only applies to strength/endurance goals, deadline only when
 * one was picked.
 */
export function buildGoalInsert(
  form: AddGoalFormState,
  userId: string
): UserGoalInsert {
  const targetValue = parseFloat(form.targetValue)
  if (isNaN(targetValue) || targetValue <= 0) {
    throw new Error("Target value must be a positive number")
  }

  const insert: UserGoalInsert = {
    user_id: userId,
    goal_type: form.goalType,
    target_value: targetValue,
    current_value: 0,
    unit: unitForGoalType(form.goalType, form.enduranceMetric),
  }

  if (
    (form.goalType === "strength" || form.goalType === "endurance") &&
    form.exerciseId
  ) {
    insert.exercise_id = form.exerciseId
  }

  if (form.deadline) {
    insert.deadline = form.deadline
  }

  return insert
}
