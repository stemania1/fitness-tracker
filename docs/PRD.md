# Product Requirements Document — PF Fitness Tracker

## Vision
A simple, focused fitness app for Planet Fitness members that builds personalized workouts from PF equipment, tracks every session, and guides users toward their weight and fitness goals.

## Target User
- Planet Fitness members (beginner to intermediate)
- Want structured workouts without hiring a trainer
- Have specific goals: lose weight, gain muscle, improve endurance
- Prefer simplicity over feature overload

## Core Features

### 1. User Onboarding & Profile
**Goal**: Capture enough info to personalize workouts and set realistic goals.

- Sign up / log in via email (Supabase Auth)
- Onboarding flow collects:
  - Current weight
  - Height
  - Age, sex
  - Fitness level (beginner / intermediate / advanced)
  - Primary goal (lose weight / build muscle / improve endurance / general fitness)
  - Target weight (optional)
  - How many days per week they can work out (2–6)
  - Any injuries or limitations (free text)
- Profile page to update these at any time

### 2. Workout Builder
**Goal**: Generate and customize workouts using only Planet Fitness equipment.

- **Equipment catalog**: Full list of machines/equipment available at Planet Fitness:
  - Cardio: treadmill, elliptical, stairmaster, stationary bike, arc trainer
  - Strength machines: chest press, shoulder press, lat pulldown, seated row, leg press, leg curl, leg extension, cable crossover, smith machine, pec fly, hip abductor/adductor
  - Free weights: dumbbells (up to 75 lbs), EZ curl bar, fixed barbells
  - Other: ab crunch machine, assisted pull-up/dip, cable machine, functional trainer
- **Auto-generate workouts** based on user's goal, fitness level, and available days:
  - Lose weight → higher rep ranges, shorter rest, circuit-style, more cardio
  - Build muscle → moderate-to-heavy weight, compound movements first, progressive overload cues
  - Improve endurance → cardio-focused with bodyweight/light resistance circuits
  - General fitness → balanced mix
- **Split options**: push/pull/legs, upper/lower, full body — recommended based on days/week
- Users can customize: swap exercises, adjust sets/reps/weight, reorder
- Save workouts as named templates for reuse

### 3. Activity Tracking & Logging
**Goal**: Make it fast and frictionless to log what you did.

- Start a workout from a template or log freestyle
- For each exercise, log:
  - Sets completed
  - Reps per set
  - Weight per set
  - RPE (rate of perceived exertion, 1–10) — optional
  - Notes — optional
- For cardio, log:
  - Duration
  - Distance (optional)
  - Avg heart rate (optional)
- For treadmill exercises specifically:
  - Required: Duration and Distance
  - Average speed is computed automatically from distance ÷ duration (not entered manually)
  - Optional: Incline (%) — collapsible field, hidden by default
- Rest timer between sets (configurable, default based on goal)
- Workout duration tracked automatically (start → finish)
- Weekly/monthly calendar view of completed workouts
- Body weight log (manual entry, as often as user wants)

### 4. Goal Tracking & Progress
**Goal**: Show clear progress and adjust recommendations.

- Dashboard showing:
  - Weight trend chart (if weight goal set)
  - Workouts completed this week vs. target
  - Streak (consecutive weeks hitting target)
  - Volume trend (total weight lifted per week)
  - Personal records (PRs) per exercise
- Goal progress:
  - Weight goal: current vs. target with projected timeline
  - Strength goal: track 1RM estimates per exercise over time
  - Endurance goal: cardio duration/distance trends
- Milestone celebrations (first workout, 10 workouts, new PR, etc.)
- Workout recommendations adapt as user progresses:
  - Suggest weight increases when reps exceed target range consistently
  - Suggest deload weeks after sustained high volume
  - Adjust cardio recommendations based on logged performance

### 5. Planet Fitness-Specific Features
- "Lunk Alarm friendly" — no exercise suggestions that would trigger it (no grunting-required maximal lifts, no dropping weights)
- All suggested weights respect PF dumbbell max (75 lbs)
- Equipment availability notes (e.g., "Smith machine — PF has this" vs. standard barbell — PF does not)
- Express workout option (30-min circuit using PF 30-minute express circuit area)

## Non-Functional Requirements
- Mobile-first responsive design (most users will log at the gym on phone)
- Works offline for logging (sync when back online) — stretch goal
- Page load < 2 seconds
- All user data private by default (RLS enforced)

## Out of Scope (v1)
- Social features (sharing, leaderboards)
- Nutrition/diet tracking
- Wearable device integration
- Trainer marketplace
- In-app payments
