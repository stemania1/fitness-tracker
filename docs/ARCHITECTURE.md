# Architecture — PF Fitness Tracker

## System Overview

```
┌─────────────────────────────────────────────────┐
│                   Client (Browser)                │
│  Next.js App Router — React Server + Client      │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Pages   │  │Components│  │ TanStack Query │  │
│  │ (RSC)   │  │ (Client) │  │  (Cache Layer) │  │
│  └────┬────┘  └────┬─────┘  └───────┬────────┘  │
│       │            │                │            │
│       └────────────┴────────┬───────┘            │
│                             │                    │
│                    Supabase JS Client            │
└─────────────────────────────┬───────────────────┘
                              │ HTTPS
┌─────────────────────────────┴───────────────────┐
│                  Supabase Platform                │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │   Auth   │  │ PostgREST│  │   Storage     │  │
│  │ (GoTrue) │  │  (API)   │  │  (if needed)  │  │
│  └────┬─────┘  └────┬─────┘  └───────────────┘  │
│       │              │                           │
│       └──────┬───────┘                           │
│              │                                   │
│     ┌────────┴────────┐                          │
│     │   PostgreSQL    │                          │
│     │  + RLS Policies │                          │
│     └─────────────────┘                          │
└──────────────────────────────────────────────────┘
```

## Database Schema

### Tables

#### `user_profiles`
Extends Supabase auth.users with fitness-specific data.
```sql
id              uuid PRIMARY KEY REFERENCES auth.users(id)
display_name    text
age             integer
sex             text CHECK (sex IN ('male', 'female', 'other'))
height_inches   integer
current_weight  decimal(5,1)
fitness_level   text CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced'))
primary_goal    text CHECK (primary_goal IN ('lose_weight', 'build_muscle', 'improve_endurance', 'general_fitness'))
target_weight   decimal(5,1)
workout_days    integer CHECK (workout_days BETWEEN 2 AND 6)
limitations     text
onboarding_done boolean DEFAULT false
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

#### `equipment`
Planet Fitness equipment catalog.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text NOT NULL
category        text CHECK (category IN ('cardio', 'strength_machine', 'free_weight', 'cable', 'other'))
muscle_groups   text[] -- primary muscles targeted
available_at_pf boolean DEFAULT true
max_weight      decimal(5,1) -- NULL for cardio
notes           text
```

#### `exercises`
Individual exercises mapped to equipment.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text NOT NULL
equipment_id    uuid REFERENCES equipment(id)
muscle_groups   text[] NOT NULL
exercise_type   text CHECK (exercise_type IN ('strength', 'cardio', 'flexibility'))
difficulty      text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'))
instructions    text
default_sets    integer
default_reps    text -- e.g., '8-12' or '30 min'
pf_friendly     boolean DEFAULT true
```

#### `workout_templates`
Saved workout plans.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES auth.users(id) NOT NULL
name            text NOT NULL
description     text
split_type      text CHECK (split_type IN ('full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'cardio', 'express'))
estimated_mins  integer
is_generated    boolean DEFAULT false -- true if auto-generated
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

#### `template_exercises`
Exercises within a template (ordered).
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
template_id     uuid REFERENCES workout_templates(id) ON DELETE CASCADE
exercise_id     uuid REFERENCES exercises(id)
order_index     integer NOT NULL
sets            integer DEFAULT 3
reps            text DEFAULT '10'
rest_seconds    integer DEFAULT 60
notes           text
```

#### `workout_logs`
A completed workout session.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES auth.users(id) NOT NULL
template_id     uuid REFERENCES workout_templates(id) -- NULL if freestyle
name            text NOT NULL
started_at      timestamptz NOT NULL
finished_at     timestamptz
duration_mins   integer
notes           text
created_at      timestamptz DEFAULT now()
```

#### `exercise_logs`
Individual exercise performance within a workout log.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
workout_log_id  uuid REFERENCES workout_logs(id) ON DELETE CASCADE
exercise_id     uuid REFERENCES exercises(id)
order_index     integer NOT NULL
notes           text
```

#### `set_logs`
Individual set data within an exercise log.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
exercise_log_id uuid REFERENCES exercise_logs(id) ON DELETE CASCADE
set_number      integer NOT NULL
reps            integer
weight          decimal(5,1)
duration_mins   decimal(5,1) -- for cardio
distance_miles  decimal(5,2) -- for cardio
heart_rate      integer
rpe             integer CHECK (rpe BETWEEN 1 AND 10)
```

#### `weight_logs`
Body weight tracking entries.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES auth.users(id) NOT NULL
weight          decimal(5,1) NOT NULL
logged_at       timestamptz DEFAULT now()
notes           text
```

#### `user_goals`
Specific trackable goals.
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id         uuid REFERENCES auth.users(id) NOT NULL
goal_type       text CHECK (goal_type IN ('weight', 'strength', 'endurance', 'consistency'))
exercise_id     uuid REFERENCES exercises(id) -- for strength goals
target_value    decimal(7,1) NOT NULL
current_value   decimal(7,1)
unit            text NOT NULL -- 'lbs', 'mins', 'miles', 'workouts_per_week'
deadline        date
achieved_at     timestamptz
created_at      timestamptz DEFAULT now()
```

### Row Level Security

Every user-owned table enforces:
```sql
-- Users can only see their own data
CREATE POLICY "Users read own data" ON table_name
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own data
CREATE POLICY "Users insert own data" ON table_name
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own data
CREATE POLICY "Users update own data" ON table_name
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own data
CREATE POLICY "Users delete own data" ON table_name
  FOR DELETE USING (auth.uid() = user_id);
```

Equipment and exercises tables are readable by all authenticated users, writable by none (admin-seeded).

## Key Architectural Decisions

### 1. Server Components by Default
Pages use React Server Components for initial data loading. Client components only where interactivity is needed (forms, timers, drag-and-drop).

### 2. Supabase Client Strategy
- **Server**: `createServerClient` from `@supabase/ssr` in Server Components and Route Handlers
- **Client**: `createBrowserClient` from `@supabase/ssr` in Client Components
- Auth session managed via Supabase middleware (cookie-based)

### 3. Workout Generation Algorithm
```
Input: user profile (goal, fitness_level, workout_days, limitations)

1. Determine split type from workout_days:
   - 2-3 days → full body
   - 4 days → upper/lower
   - 5-6 days → push/pull/legs

2. For each workout day, select exercises:
   - Filter by pf_friendly = true
   - Filter by difficulty <= user fitness_level
   - Prioritize compound movements
   - Fill with isolation exercises
   - Exclude exercises conflicting with limitations

3. Set rep/set scheme from goal:
   - lose_weight: 3×12-15, 30-45s rest
   - build_muscle: 4×8-12, 60-90s rest
   - improve_endurance: 2×15-20 + 20-30 min cardio
   - general_fitness: 3×10-12, 60s rest

4. Return workout template(s)
```

### 4. Progressive Overload Logic
When a user consistently logs reps at the top of their target range for 2+ consecutive sessions on an exercise, the system suggests increasing weight by:
- 5 lbs for upper body movements
- 10 lbs for lower body movements
- Or increasing reps if at PF dumbbell max (75 lbs)

### 5. Data Flow for Workout Logging
```
Start Workout → Load template exercises
  → For each exercise:
       → Log set (reps, weight, RPE)
       → Start rest timer
       → Next set or next exercise
  → Finish Workout → Calculate stats → Save workout_log + exercise_logs + set_logs
  → Update PRs if applicable
  → Check goal progress
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/callback` | GET | Supabase auth callback |
| No custom API routes needed — use Supabase client directly | | |

Direct Supabase client queries replace traditional API routes. TanStack Query manages caching, deduplication, and background refetching.

## File Naming Conventions
- Pages: `src/app/(group)/route/page.tsx`
- Components: `PascalCase.tsx` (e.g., `WorkoutCard.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useWorkoutLog.ts`)
- Utils: `camelCase.ts` (e.g., `calculateOneRepMax.ts`)
- Types: `camelCase.ts` in `src/types/` (e.g., `workout.ts`)
- Tests: `*.test.ts` or `*.test.tsx` beside source file
