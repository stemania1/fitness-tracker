# Product Backlog — PF Fitness Tracker

Shipped features are documented in the PRD. This backlog tracks what's
still open.

## Motivation layer
- [x] Personal-record detection during active workout (heaviest weight)
- [x] Epley 1RM estimate on workout detail
- [x] Progressive overload nudge ("Try +5 lbs") when last session cleared
      the top of the rep range on all sets at the same weight
- [x] Dashboard "Recent PRs" card showing the last 5 weight PRs (30-day window)
- [x] Rep PR detection (most reps ever at a given weight, dashboard card)
- [x] Workouts-per-week streak tracker
- [x] Volume trend chart (weekly total lifted, last 8 weeks)
- [x] Deload week suggestion when 4 consecutive weeks of 5%+ volume climb

## Goal tracking
- [x] Weight goal: target + projected timeline based on actual rate
- [x] Milestone celebrations (first workout, 10 workouts, first PR, four-week streak, goal achieved)
- [ ] Strength goals: target 1RM per exercise, progress chart
- [ ] Endurance goals: cardio duration / distance targets

## Logging UX
- [x] Quick Log Strength (set-by-set entry of a session you just finished)
- [x] Backdating chips (Today / Yesterday / Earlier…) on both Quick Logs
- [x] Treadmill: time + distance → computed Avg mph + optional incline
- [x] Outdoor Run: time + distance → computed pace (min/mi)
- [x] Incline contributes to calorie estimate at walking speeds
- [x] Edit a saved workout log (sets and notes — not exercise selection)
- [x] Pre-fill new set weights from previous performance
- [x] Rest-timer auto-advances to the next exercise when sets are complete

## Workout builder
- [x] Add Exercise button in template edit mode
- [x] Reorder template exercises (up / down)
- [ ] Drag-and-drop reorder (replace up/down chevrons)
- [x] Swap one exercise for another within a template

## Equipment & exercises
- [x] Free-weight exercise catalog expanded (16 added Apr–May 2026)
- [ ] Reconcile remaining static-vs-DB muscle-group naming
      ("quads" vs "quadriceps", "obliques", etc.)
- [ ] BACKLOG: catalog new equipment we haven't modeled (functional
      trainer was added but unreferenced by any exercise yet)

## Polish & quality
- [ ] Accessibility audit (keyboard nav, screen reader, focus states)
- [ ] Performance audit (Core Web Vitals)
- [ ] Component tests for active-workout flow and Quick Log dialogs
- [ ] Offline-capable logging with sync when reconnected (stretch)

## Refactor & cleanup
Surfaced while building out the test suite (#37, #38, #39). Listed
roughly easiest → hardest; pick off in order.

- [x] Delete dead code in `src/lib/utils.ts` (`calculateOneRepMax`,
      `formatWeight`) — shipped in #39
- [x] Extract `formatStrengthSets` / `formatCardioSets` from
      `PreviousPerformance.tsx` into a tested sibling helper —
      shipped in #39
- [x] Reconcile `useExerciseHistory`'s inline all-time-max loop with
      `findHeaviestWeight` in `personal-records.ts` — aligned to
      `findHeaviestWeight` (stricter: ignores `reps==null` and
      `weight<=0`).
- [x] Replace the `as unknown as { from: ... }` Supabase casts in
      the Oura route handlers — added `oura_tokens` to the
      `Database` types, casts dropped.
- [ ] Move the 20-odd `const supabase = createClient()` calls from
      module top level into components/hooks. Couples imports to
      runtime state and forces awkward `vi.mock` patterns in tests.
- [ ] Extract business logic from the 1000+ line page files
      (`activity/log/page.tsx`, `dashboard/page.tsx`,
      `goals/page.tsx`) into hooks under `src/hooks/` and pure
      helpers under `src/lib/`. Refactor first, then test what
      comes out.
- [ ] Consider swapping the custom Dialog component for
      `@radix-ui/react-dialog`. The current implementation lacks
      focus trap and scroll restoration that Radix gives for free.
      Real but architectural — weigh against the testing churn.

## Testing follow-ups
- [ ] Component tests for `QuickLogStrength`, `QuickLogExercise`,
      `exercise-picker` (patterns established in #37–#38)
- [ ] Set up ESLint (`next lint` is currently interactive); add a
      lint step to the CI workflow.
- [ ] Ratchet up coverage thresholds in `vitest.config.ts` as
      coverage grows.

## Out of scope (v1, per PRD)
- Social features (sharing, leaderboards)
- Nutrition / diet tracking
- Wearable integration beyond the existing Oura dashboard
- Trainer marketplace
- In-app payments
