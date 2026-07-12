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

### 6. Oura Ring Integration
**Goal**: Surface recovery and readiness signals from the user's wearable so workout intensity can adapt day to day.

- OAuth2 connect/disconnect from the profile page; tokens stored per-user with RLS
- Daily Oura summary on the dashboard: sleep score, readiness, resting heart rate, SpO2, stress, resilience, VO2 max
- Threshold-driven insights (e.g. "Great day for a hard workout" at readiness ≥ 85 + restored stress; "Consider a light day" when readiness < 70)
- Server-side token refresh when the stored access token expires
- Ring battery indicator; readiness-gated "today's session" guidance;
  HRV overreaching "Recovery Watch"; REM-sleep insights with correlations

### 7. VO2 Max & Pull-Up Training Plan
**Goal**: Drive a concrete 12-week program to raise VO2 max and pull-up count, and measure progress against it.

- Structured 12-week plan (`src/data/training-plan.ts`) rendered on the Plan page: weekly schedule, phases, and scheduled tests
- Dashboard "today's session" card and one-tap **Start Workout** that opens the day's prescribed session in the logger pre-loaded with its exercises (strength lifts + Zone 2 finisher), so sets record weight × reps with previous-performance and progressive-overload built in
- Fitness-test logging (Cooper 12-min, pull-up max, assisted 8RM) and a VO2 max trend chart with percentile context
- "Training This Week" summary (strength volume + Zone 2 minutes) and a post-workout **Session Recap** comparing each lift to previous sessions
- Add-exercises-to-a-saved-workout, swap-exercise (broken/occupied machine), and an "unchecked sets" confirmation on finish
- Calendar (.ics) export of the plan's sessions with reminders (native-calendar based; no push infrastructure)

### 8. Photo Calorie & Macro Logging
**Goal**: Log meals by photo instead of manual entry.

- "Snap Meal": photograph a meal; Claude vision (`claude-sonnet-5`) estimates calories + macros, which the user reviews/adjusts before saving
- Portion-size assumption with a one-tap multiplier to scale the estimate
- One-tap "log another serving" to re-add an identical meal
- Today's Nutrition card with calories-in, macros, and net vs. Oura calories-out
- Resilient to slow/dropped requests (raised function timeout, retry-same-photo)

## Non-Functional Requirements
- Mobile-first responsive design (most users will log at the gym on phone)
- Works offline for logging (sync when back online) — stretch goal
- Page load < 2 seconds
- All user data private by default (RLS enforced)

## Out of Scope (v1)
- Social features (sharing, leaderboards)
- Wearable integration beyond Oura (Apple Watch, Garmin, Fitbit, etc.)
- In-app web-push notifications (session reminders are handled via calendar
  export instead — more reliable on iOS PWAs)
- Trainer marketplace
- In-app payments

_Note: nutrition/diet tracking was originally out of scope but is now shipped
as photo calorie & macro logging (feature 8)._
