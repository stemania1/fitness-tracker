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
│   │   │   ├── workouts/     # Workout builder & history
│   │   │   ├── activity/     # Activity logging
│   │   │   ├── goals/        # Goal setting & progress
│   │   │   └── profile/      # User profile & settings
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # shadcn/ui primitives
│   │   ├── workouts/         # Workout-specific components
│   │   ├── activity/         # Activity-specific components
│   │   └── goals/            # Goal-specific components
│   ├── lib/                  # Utilities and config
│   │   ├── supabase/         # Supabase client & helpers
│   │   ├── utils.ts
│   │   └── constants.ts      # PF machines, muscle groups, etc.
│   ├── hooks/                # Custom React hooks
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
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking
npx supabase start   # Start local Supabase
npx supabase db push # Push migrations to remote
```

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
- Unit tests with Vitest for utility functions and hooks
- Component tests with Testing Library
- Test files live next to source files: `foo.test.ts` beside `foo.ts`
