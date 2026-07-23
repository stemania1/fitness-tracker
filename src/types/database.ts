export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          display_name: string | null
          age: number | null
          sex: "male" | "female" | "other" | null
          height_inches: number | null
          current_weight: number | null
          fitness_level: "beginner" | "intermediate" | "advanced" | null
          primary_goal: "lose_weight" | "build_muscle" | "improve_endurance" | "general_fitness" | null
          target_weight: number | null
          workout_days: number | null
          limitations: string | null
          onboarding_done: boolean
          reminder_settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          age?: number | null
          sex?: "male" | "female" | "other" | null
          height_inches?: number | null
          current_weight?: number | null
          fitness_level?: "beginner" | "intermediate" | "advanced" | null
          primary_goal?: "lose_weight" | "build_muscle" | "improve_endurance" | "general_fitness" | null
          target_weight?: number | null
          workout_days?: number | null
          limitations?: string | null
          onboarding_done?: boolean
          reminder_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          age?: number | null
          sex?: "male" | "female" | "other" | null
          height_inches?: number | null
          current_weight?: number | null
          fitness_level?: "beginner" | "intermediate" | "advanced" | null
          primary_goal?: "lose_weight" | "build_muscle" | "improve_endurance" | "general_fitness" | null
          target_weight?: number | null
          workout_days?: number | null
          limitations?: string | null
          onboarding_done?: boolean
          reminder_settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipment: {
        Row: {
          id: string
          name: string
          category: "cardio" | "strength_machine" | "free_weight" | "cable" | "other"
          muscle_groups: string[]
          available_at_pf: boolean
          max_weight: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          name: string
          category: "cardio" | "strength_machine" | "free_weight" | "cable" | "other"
          muscle_groups: string[]
          available_at_pf?: boolean
          max_weight?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          name?: string
          category?: "cardio" | "strength_machine" | "free_weight" | "cable" | "other"
          muscle_groups?: string[]
          available_at_pf?: boolean
          max_weight?: number | null
          notes?: string | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          id: string
          name: string
          equipment_id: string | null
          muscle_groups: string[]
          exercise_type: "strength" | "cardio" | "flexibility"
          difficulty: "beginner" | "intermediate" | "advanced"
          instructions: string | null
          default_sets: number | null
          default_reps: string | null
          pf_friendly: boolean
        }
        Insert: {
          id?: string
          name: string
          equipment_id?: string | null
          muscle_groups: string[]
          exercise_type: "strength" | "cardio" | "flexibility"
          difficulty: "beginner" | "intermediate" | "advanced"
          instructions?: string | null
          default_sets?: number | null
          default_reps?: string | null
          pf_friendly?: boolean
        }
        Update: {
          id?: string
          name?: string
          equipment_id?: string | null
          muscle_groups?: string[]
          exercise_type?: "strength" | "cardio" | "flexibility"
          difficulty?: "beginner" | "intermediate" | "advanced"
          instructions?: string | null
          default_sets?: number | null
          default_reps?: string | null
          pf_friendly?: boolean
        }
        Relationships: []
      }
      workout_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          split_type: "full_body" | "upper" | "lower" | "push" | "pull" | "legs" | "cardio" | "express"
          estimated_mins: number | null
          is_generated: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          split_type: "full_body" | "upper" | "lower" | "push" | "pull" | "legs" | "cardio" | "express"
          estimated_mins?: number | null
          is_generated?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          split_type?: "full_body" | "upper" | "lower" | "push" | "pull" | "legs" | "cardio" | "express"
          estimated_mins?: number | null
          is_generated?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      template_exercises: {
        Row: {
          id: string
          template_id: string
          exercise_id: string
          order_index: number
          sets: number
          reps: string
          rest_seconds: number
          notes: string | null
        }
        Insert: {
          id?: string
          template_id: string
          exercise_id: string
          order_index: number
          sets?: number
          reps?: string
          rest_seconds?: number
          notes?: string | null
        }
        Update: {
          id?: string
          template_id?: string
          exercise_id?: string
          order_index?: number
          sets?: number
          reps?: string
          rest_seconds?: number
          notes?: string | null
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          id: string
          user_id: string
          template_id: string | null
          name: string
          started_at: string
          finished_at: string | null
          duration_mins: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id?: string | null
          name: string
          started_at: string
          finished_at?: string | null
          duration_mins?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string | null
          name?: string
          started_at?: string
          finished_at?: string | null
          duration_mins?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      exercise_logs: {
        Row: {
          id: string
          workout_log_id: string
          exercise_id: string
          order_index: number
          notes: string | null
        }
        Insert: {
          id?: string
          workout_log_id: string
          exercise_id: string
          order_index: number
          notes?: string | null
        }
        Update: {
          id?: string
          workout_log_id?: string
          exercise_id?: string
          order_index?: number
          notes?: string | null
        }
        Relationships: []
      }
      set_logs: {
        Row: {
          id: string
          exercise_log_id: string
          set_number: number
          reps: number | null
          weight: number | null
          duration_mins: number | null
          distance_miles: number | null
          incline_percent: number | null
          heart_rate: number | null
          rpe: number | null
        }
        Insert: {
          id?: string
          exercise_log_id: string
          set_number: number
          reps?: number | null
          weight?: number | null
          duration_mins?: number | null
          distance_miles?: number | null
          incline_percent?: number | null
          heart_rate?: number | null
          rpe?: number | null
        }
        Update: {
          id?: string
          exercise_log_id?: string
          set_number?: number
          reps?: number | null
          weight?: number | null
          duration_mins?: number | null
          distance_miles?: number | null
          incline_percent?: number | null
          heart_rate?: number | null
          rpe?: number | null
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          id: string
          user_id: string
          weight: number
          logged_at: string
          notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          weight: number
          logged_at?: string
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          weight?: number
          logged_at?: string
          notes?: string | null
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          id: string
          user_id: string
          goal_type: "weight" | "strength" | "endurance" | "consistency"
          exercise_id: string | null
          target_value: number
          current_value: number | null
          unit: string
          deadline: string | null
          achieved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          goal_type: "weight" | "strength" | "endurance" | "consistency"
          exercise_id?: string | null
          target_value: number
          current_value?: number | null
          unit: string
          deadline?: string | null
          achieved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          goal_type?: "weight" | "strength" | "endurance" | "consistency"
          exercise_id?: string | null
          target_value?: number
          current_value?: number | null
          unit?: string
          deadline?: string | null
          achieved_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      oura_tokens: {
        Row: {
          id: string
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          access_token: string
          refresh_token: string
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          access_token?: string
          refresh_token?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fitness_tests: {
        Row: {
          id: string
          user_id: string
          test_type: "cooper_run" | "pullup_max"
          result: number
          tested_at: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          test_type: "cooper_run" | "pullup_max"
          result: number
          tested_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          test_type?: "cooper_run" | "pullup_max"
          result?: number
          tested_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      food_logs: {
        Row: {
          id: string
          user_id: string
          description: string
          meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "meal"
          calories: number
          protein_g: number
          carbs_g: number
          fat_g: number
          sugar_g: number
          glycemic_load: number
          image_path: string | null
          confidence: "low" | "medium" | "high" | null
          edited: boolean
          logged_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          meal_type?: "breakfast" | "lunch" | "dinner" | "snack" | "meal"
          calories: number
          protein_g?: number
          carbs_g?: number
          fat_g?: number
          sugar_g?: number
          glycemic_load?: number
          image_path?: string | null
          confidence?: "low" | "medium" | "high" | null
          edited?: boolean
          logged_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          meal_type?: "breakfast" | "lunch" | "dinner" | "snack" | "meal"
          calories?: number
          protein_g?: number
          carbs_g?: number
          fat_g?: number
          sugar_g?: number
          glycemic_load?: number
          image_path?: string | null
          confidence?: "low" | "medium" | "high" | null
          edited?: boolean
          logged_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      energy_checkins: {
        Row: {
          id: string
          user_id: string
          level: number
          logged_hour: number
          part_of_day: "morning" | "afternoon" | "evening"
          logged_on: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          level: number
          logged_hour: number
          part_of_day: "morning" | "afternoon" | "evening"
          logged_on?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          level?: number
          logged_hour?: number
          part_of_day?: "morning" | "afternoon" | "evening"
          logged_on?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      caffeine_logs: {
        Row: {
          id: string
          user_id: string
          mg: number
          source: string | null
          logged_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          mg: number
          source?: string | null
          logged_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          mg?: number
          source?: string | null
          logged_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"]
export type UserProfileUpdate = Database["public"]["Tables"]["user_profiles"]["Update"]
export type Equipment = Database["public"]["Tables"]["equipment"]["Row"]
export type Exercise = Database["public"]["Tables"]["exercises"]["Row"]
export type WorkoutTemplate = Database["public"]["Tables"]["workout_templates"]["Row"]
export type TemplateExercise = Database["public"]["Tables"]["template_exercises"]["Row"]
export type WorkoutLog = Database["public"]["Tables"]["workout_logs"]["Row"]
export type ExerciseLog = Database["public"]["Tables"]["exercise_logs"]["Row"]
export type SetLog = Database["public"]["Tables"]["set_logs"]["Row"]
export type WeightLog = Database["public"]["Tables"]["weight_logs"]["Row"]
export type UserGoal = Database["public"]["Tables"]["user_goals"]["Row"]
export type OuraToken = Database["public"]["Tables"]["oura_tokens"]["Row"]
export type EnergyCheckin = Database["public"]["Tables"]["energy_checkins"]["Row"]
export type CaffeineLog = Database["public"]["Tables"]["caffeine_logs"]["Row"]
