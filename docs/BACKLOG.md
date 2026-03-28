# Product Backlog — PF Fitness Tracker

## Epic 1: Project Setup & Infrastructure
- [x] Initialize Next.js 14 project with TypeScript
- [ ] Configure Tailwind CSS + shadcn/ui
- [ ] Set up Supabase project (local + remote)
- [ ] Configure Supabase Auth (email/password)
- [ ] Create database schema migrations
- [ ] Seed Planet Fitness equipment catalog
- [ ] Set up RLS policies on all tables
- [ ] Configure TanStack Query provider
- [ ] Set up ESLint + Prettier
- [ ] Set up Vitest + Testing Library

## Epic 2: Authentication & Onboarding
- [ ] Login page (email + password)
- [ ] Sign-up page
- [ ] Auth middleware (protect dashboard routes)
- [ ] Onboarding flow — step 1: basic info (weight, height, age, sex)
- [ ] Onboarding flow — step 2: fitness level selection
- [ ] Onboarding flow — step 3: goal selection
- [ ] Onboarding flow — step 4: schedule (days per week)
- [ ] Onboarding flow — step 5: limitations (optional)
- [ ] Save onboarding data to user_profiles table
- [ ] Redirect logic (new users → onboarding, returning → dashboard)

## Epic 3: Equipment & Exercise Data
- [ ] Define PF equipment catalog (static data + DB seed)
- [ ] Define exercise library (name, equipment, muscle groups, instructions)
- [ ] Map exercises to goals and difficulty levels
- [ ] Create exercise detail component (name, muscles, demo description)
- [ ] Exercise search/filter by muscle group and equipment

## Epic 4: Workout Builder
- [ ] Auto-generate workout based on user profile + goal
- [ ] Split recommendation logic (full body / upper-lower / PPL)
- [ ] Workout template creation UI
- [ ] Exercise picker (search, filter, add to workout)
- [ ] Set/rep/weight configuration per exercise
- [ ] Reorder exercises via drag-and-drop
- [ ] Swap exercise functionality
- [ ] Save workout as template
- [ ] List saved workout templates
- [ ] Edit existing template
- [ ] Delete template
- [ ] Express 30-minute circuit template generator

## Epic 5: Activity Logging
- [ ] "Start Workout" flow from template
- [ ] Freestyle workout logging (no template)
- [ ] Log sets: reps + weight per set
- [ ] Log cardio: duration, distance, heart rate
- [ ] RPE input per set (optional)
- [ ] Notes per exercise (optional)
- [ ] Rest timer between sets
- [ ] Auto-track workout duration
- [ ] Complete workout → save workout log
- [ ] Discard in-progress workout
- [ ] Body weight log entry
- [ ] Workout history list (recent first)
- [ ] Workout detail view (past workout)
- [ ] Calendar view of workout history

## Epic 6: Goals & Progress
- [ ] Set weight goal (target weight + timeline)
- [ ] Set strength goals (target weight on specific exercises)
- [ ] Set endurance goals (cardio targets)
- [ ] Weight trend chart
- [ ] Volume trend chart (weekly total)
- [ ] Personal records detection and display
- [ ] 1RM estimate calculation
- [ ] Workouts-per-week streak tracker
- [ ] Goal progress dashboard cards
- [ ] Milestone detection and display
- [ ] Progressive overload suggestions
- [ ] Deload week suggestion logic

## Epic 7: Dashboard
- [ ] Dashboard layout (mobile-first)
- [ ] Today's workout card (next scheduled or quick-start)
- [ ] Weekly summary card (workouts completed vs. target)
- [ ] Weight progress card
- [ ] Recent PRs card
- [ ] Streak display
- [ ] Quick-log body weight from dashboard

## Epic 8: Profile & Settings
- [ ] Profile page (view/edit all onboarding fields)
- [ ] Change fitness level
- [ ] Update goals
- [ ] Update schedule
- [ ] Account settings (email, password)
- [ ] Sign out
- [ ] Delete account

## Epic 9: Polish & Quality
- [ ] Loading skeletons for all async pages
- [ ] Error boundaries with user-friendly messages
- [ ] Empty states for all list views
- [ ] Responsive design audit (phone, tablet, desktop)
- [ ] Accessibility audit (keyboard nav, screen reader)
- [ ] Performance audit (Core Web Vitals)
- [ ] Unit tests for workout generation logic
- [ ] Unit tests for 1RM and volume calculations
- [ ] Component tests for key flows (onboarding, logging)

## Priority Order (suggested)
1. Epic 1 — Setup (must be first)
2. Epic 2 — Auth & Onboarding (gate everything behind auth)
3. Epic 3 — Equipment & Exercises (data foundation)
4. Epic 4 — Workout Builder (core feature)
5. Epic 5 — Activity Logging (core feature)
6. Epic 7 — Dashboard (ties it together)
7. Epic 6 — Goals & Progress (motivation layer)
8. Epic 8 — Profile & Settings
9. Epic 9 — Polish
