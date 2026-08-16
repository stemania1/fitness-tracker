# CLAUDE.md — Fitness Tracker

## Project Overview
A fitness tracking web app for Planet Fitness members. Users create workouts from PF machines, log activity, set goals based on current weight/fitness level, and track progress over time.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes + Supabase
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security + Auth)
- **State Management**: React Context + TanStack Query for server state
- **Charts**: Recharts for progress visualization
- **Deployment**: Vercel

## Project Structure
```
fitness-tracker/
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── (auth)/           # Auth pages (login, signup)
│   │   ├── (dashboard)/      # Authenticated pages
│   │   │   ├── dashboard/    # Home: today's actionable cards
│   │   │   ├── insights/     # Multi-week analytical cards (trends, balance)
│   │   │   ├── plan/         # 12-week training plan view
│   │   │   ├── workouts/     # Workout builder & history
│   │   │   ├── activity/     # Activity logging
│   │   │   ├── goals/        # Goal setting & progress
│   │   │   └── profile/      # User profile & settings
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # shadcn/ui primitives
│   │   ├── workouts/         # Workout-specific components
│   │   ├── activity/         # Activity/dashboard cards (self-fetching)
│   │   ├── goals/            # Goal-specific components
│   │   ├── layout/           # TopBar, BottomNav
│   │   └── pwa/              # ServiceWorkerManager (SW register + update)
│   ├── lib/                  # Utilities and config (all with unit tests)
│   │   ├── supabase/         # Supabase client & helpers
│   │   ├── push/             # Web-push "due" logic
│   │   ├── utils.ts                 # cn() + misc UI utilities
│   │   ├── constants.ts             # PF machines, muscle groups, etc.
│   │   ├── dates.ts                 # Local-day date helpers (single source)
│   │   ├── calories.ts              # MET-based calorie estimation
│   │   ├── personal-records.ts      # PR detection + Epley 1RM
│   │   ├── progressive-overload.ts  # +5 lbs suggestion logic
│   │   ├── adaptive-target.ts       # Per-exercise next-weight from last session
│   │   ├── reps-target.ts           # Display helpers for prescribed rep targets
│   │   ├── save-workout.ts          # Persist a finished workout to Supabase
│   │   ├── pending-workouts.ts      # Offline queue for failed workout saves
│   │   ├── workout-prefill.ts       # Adaptive weight prefill: decision + apply
│   │   ├── exercise-display.ts      # Logger per-exercise render-mode flags
│   │   ├── session-recap.ts         # Previous-vs-today per-lift comparison
│   │   ├── volume-trend.ts          # Weekly volume + deload heuristic
│   │   ├── weekly-summary.ts        # Weekly strength volume + Zone 2 minutes
│   │   ├── weekly-progress.ts       # "This Week" card: week label, streak, week start
│   │   ├── daily-movement.ts        # Steps + active-minutes goals, pace, movement buckets,
│   │   │                            #   MET parsing, ring/manual resolution
│   │   ├── muscle-balance.ts        # Push:pull / upper:lower balance + neglected
│   │   ├── muscle-groups.ts         # Canonical muscle-group display labels
│   │   ├── workout-generator.ts     # Auto-generate workouts from profile
│   │   ├── weekly-schedule.ts       # Schedule-aware weekly plan builder
│   │   ├── training-plan.ts         # 12-week plan week/session lookups
│   │   ├── plan-adaptation.ts       # Missed-session detection for the plan
│   │   ├── todays-workout.ts        # Today's session → checklist / logger preload
│   │   ├── training-calendar.ts     # 12-week plan → .ics export
│   │   ├── reorder.ts               # Move an item within a list (pure)
│   │   ├── fitness-tests.ts         # Fitness-test parsing + VO2 trend
│   │   ├── vo2max.ts                # VO2 max classification
│   │   ├── vo2max-percentile.ts     # Age/sex VO2 max percentiles
│   │   ├── recovery.ts              # HRV overreaching / Recovery Watch
│   │   ├── sleep-insights.ts        # REM-sleep insights + correlations
│   │   ├── heart-rate.ts            # HR zones from age
│   │   ├── chart-ticks.ts           # Clock-aligned time ticks for chart axes
│   │   ├── bedtime.ts               # Sleep-anchored bedtime + caffeine cutoff
│   │   ├── limitations.ts           # Non-diagnostic "when to seek care" data
│   │   ├── weight-projection.ts     # Goal-date linear regression
│   │   ├── goal-progress.ts         # Live strength/endurance goal progress
│   │   ├── goal-stats.ts            # Pure stats helpers for the Goals page
│   │   ├── goal-trend.ts            # Time series for a goal's progress chart
│   │   ├── goal-form.ts             # Add-Goal form rules → typed goal insert
│   │   ├── goal-exercise-rows.ts    # Joined workout rows → goal-matchable rows
│   │   ├── milestone-data.ts        # Milestones input assembled from raw logs
│   │   ├── macro-targets.ts         # Daily calorie/macro targets from profile
│   │   ├── adaptive-tdee.ts         # Learns maintenance calories from the trend
│   │   ├── food-estimate.ts         # Photo calorie/macro estimate schema + helpers
│   │   ├── glycemic-load.ts         # Glycemic-load classification for meals
│   │   ├── meal-portion.ts          # Rescale a logged meal to the portion eaten
│   │   ├── meal-time.ts             # In-place time edit for meal/caffeine entries
│   │   ├── meal-type.ts             # Meal type (breakfast/lunch/…) from the clock
│   │   ├── image-resize.ts          # Browser image downscale for vision upload
│   │   ├── caffeine.ts              # Caffeine alertness/crash + late-dose flag
│   │   ├── alcohol.ts               # Alcohol clearance + pre-bed sleep flag
│   │   ├── alcohol-drinks.ts        # Ethanol per drink, by name and volume
│   │   ├── drink-text.ts            # Shared drink-description parsing (volume, asides)
│   │   ├── caffeine-personal.ts     # Personal half-life learned from check-ins
│   │   ├── creatine-streak.ts       # Daily creatine streak + multi-dose progress
│   │   ├── energy.ts                # Fuse sleep/HRV/fuel/caffeine into an energy read
│   │   ├── energy-correlations.ts   # Personal energy-driver correlation analysis
│   │   ├── energy-history.ts        # Felt-vs-expected energy series + pattern
│   │   ├── weekly-digest.ts         # Weekly coach digest across the three goals
│   │   ├── reminders.ts             # Smart in-app reminder nudges from the day
│   │   ├── reminder-settings.ts     # In-app reminder preferences
│   │   ├── day-nav.ts               # Day-navigation (swipe/arrows) for cards
│   │   ├── swipe.ts                 # Pure swipe-gesture direction helper
│   │   ├── oura.ts                  # Oura Ring API HTTP client
│   │   ├── oura-token.ts            # Oura OAuth token refresh
│   │   ├── oura-insights.ts         # Threshold-driven readiness insights
│   │   ├── oura-trends.ts           # Trend series + deltas from Oura history
│   │   ├── push-client.ts           # Browser web-push subscribe/unsubscribe
│   │   └── service-worker.ts        # Register + auto-update the web-push SW
│   ├── hooks/                # Custom React hooks (useExerciseHistory,
│   │                         #   useStrengthSets, useSwipe, useGoalsData,
│   │                         #   useWorkoutInit, useFinishWorkout, ...)
│   ├── types/                # TypeScript type definitions
│   └── data/                 # Static data (PF equipment catalog)
├── supabase/
│   ├── migrations/           # SQL migration files
│   └── seed.sql              # Seed data (machines, exercises)
├── docs/
│   ├── PRD.md
│   ├── BACKLOG.md
│   ├── ARCHITECTURE.md
│   └── STYLE_GUIDE.md
├── public/
├── CLAUDE.md
└── package.json
```

## Key Commands
```bash
npm run dev            # Start dev server
npm run build          # Production build
npm run typecheck      # TypeScript type checking
npm test               # Run the Vitest suite once
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # Vitest + v8 coverage (enforces thresholds)
npm run lint           # next lint (ESLint configured via .eslintrc.json)
npx supabase start     # Start local Supabase
npx supabase db push   # Push migrations to remote (see supabase/README.md)
```

> Migrations are applied to the remote database **manually** (SQL Editor or a
> linked `db push`) — they are not pushed automatically on deploy. See
> `supabase/README.md`.

## Development Guidelines
- Always use TypeScript strict mode — no `any` types
- All database queries go through Supabase client helpers in `src/lib/supabase/`
- Use Row Level Security (RLS) on every table — users only see their own data
- Planet Fitness equipment is defined as static data in `src/data/` and seeded into Supabase
- Workout templates are reusable; individual workout logs reference them
- Weight/fitness data is always stored in imperial units (lbs) internally; display conversion is a UI concern
- All API calls use TanStack Query for caching and invalidation
- Components use shadcn/ui primitives — do not install additional UI libraries
- Pages are server components by default; add `"use client"` only when needed
- Keep business logic out of components — extract to hooks or lib functions

## Database Conventions
- Table names: snake_case, plural (e.g., `workout_logs`, `user_goals`)
- All tables have `id` (uuid), `created_at`, `updated_at`
- All user-owned tables have `user_id` referencing `auth.users`
- Use Supabase enums for fixed sets (muscle groups, equipment types)
- Soft delete where appropriate (`deleted_at` timestamp)

## Testing
- Unit tests with Vitest for utility functions and hooks.
- Component tests with `@testing-library/react`. The vitest default
  environment is `node` for speed; component tests opt into jsdom
  per file with `// @vitest-environment jsdom` on the first line.
- Test files live next to source files: `foo.test.ts` beside `foo.ts`
  (or `foo.test.tsx` for component tests).
- Coverage is enforced via `vitest.config.ts` thresholds (statements
  80 / branches 78 / functions 68 / lines 81). Ratchet them up as
  coverage grows.
- CI (`.github/workflows/ci.yml`) runs typecheck + `test:coverage`
  on every PR and on main.

## Working with the user
- It's OK to grill me. If a request is ambiguous, has trade-offs, conflicts with the PRD/existing code, or would benefit from clarification before you write code, ask. Push back on bad ideas and propose alternatives instead of silently implementing around them. Better to spend a minute asking than to ship the wrong thing.
