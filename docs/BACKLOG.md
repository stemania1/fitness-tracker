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
- [x] Backdating chips (Today / Yesterday / Earlier…) on the strength,
      exercise, meal (Snap Meal), and caffeine quick logs — for anything you
      forgot to log in the moment
- [x] Treadmill: time + distance → computed Avg mph + optional incline
- [x] Outdoor Run: time + distance → computed pace (min/mi)
- [x] Incline contributes to calorie estimate at walking speeds
- [x] Edit a saved workout log (sets and notes)
- [x] Add exercises to a saved workout log (append mode in the logger),
      pre-loading the plan's remaining exercises when it's a plan session
- [x] "Save without these?" confirmation when finishing with unchecked exercises
- [x] Pre-fill new set weights from previous performance
- [x] Rest-timer auto-advances to the next exercise when sets are complete

## Workout builder
- [x] Add Exercise button in template edit mode
- [x] Reorder template exercises (up / down)
- [x] Drag-and-drop reorder of template exercises (grip handle; up/down
      chevrons kept as the touch fallback since HTML5 DnD is unreliable
      on touch)
- [x] Swap one exercise for another within a template
- [x] Swap one exercise for another during a live logged workout
      (broken/occupied machine — sets carry over)

## VO2 max & pull-up training plan
- [x] 12-week structured plan (data + Plan page: schedule, phases, tests)
- [x] Dashboard "today's session" card + one-tap Start Workout that
      pre-loads the day's prescribed session (lifts + Zone 2 finisher) in
      the logger
- [x] Readiness-gated session guidance; HRV overreaching "Recovery Watch"
- [x] Fitness-test logging (Cooper, pull-up max, assisted 8RM) + VO2 max
      trend chart with percentile context
- [x] "Training This Week" card (strength volume + Zone 2 minutes)
- [x] Post-workout Session Recap (each lift vs. previous sessions)
- [x] Calendar (.ics) export of plan sessions with reminders
- [ ] In-app web-push reminders (deferred — calendar export covers this
      more reliably on iOS; revisit if in-app notifications are wanted)

## Nutrition — photo calorie & macro logging
- [x] "Snap Meal" photo → Claude vision (claude-sonnet-5) calorie + macro
      estimate, reviewed/adjusted before saving
- [x] Portion-size assumption + one-tap multiplier
- [x] One-tap "log another serving"
- [x] Today's Nutrition card (calories in, macros, net vs. Oura out)
- [x] Robustness: raised function timeout + retry-same-photo on a drop

## Energy & recovery
- [x] Energy Check-In (v1): subjective 1-5 log + a felt-vs-expected read.
      `src/lib/energy.ts` blends sleep, recovery/HRV, training load, and
      circadian time of day into an expected energy band, then reconciles
      it against how the user says they feel (validate a normal feeling vs.
      flag a surprise). Works on the manual input alone; sharper with Oura.
      Persisted via `energy_checkins`; surfaced on the dashboard.
- [x] Wire the fuel signal in: `deriveFuelState` reads the day's logged food
      (intake vs. target for the hour + recency of the last meal → under /
      adequate / over) and the dashboard feeds it to the card.
- [x] Caffeine: log intake (`caffeine_logs`, Quick Log Caffeine with drink
      presets). `src/lib/caffeine.ts` models on-board mg via a ~5.5h half-life
      → an alertness/crash driver on the energy read, plus a forward-looking
      "late caffeine may hurt tonight's sleep" warning surfaced on the card.
- [ ] Sharpen caffeine: personal half-life / sensitivity from the check-in
      history; tie the late-caffeine cutoff to the user's actual bedtime
      instead of the fixed 2pm default.
- [ ] Energy trend + personal drivers: once a few weeks of check-ins exist,
      correlate felt energy against its candidate drivers (mirrors the REM
      sleep-driver analysis in `sleep-insights.ts`) and surface each user's
      top levers.
- [ ] Morning vs. evening framing: tailor the prompt/target to the part of
      day (e.g. morning readiness vs. evening wind-down) rather than one
      generic "right now" read.

## Equipment & exercises
- [x] Free-weight exercise catalog expanded (16 added Apr–May 2026)
- [x] Unify muscle-group *display* labels via `formatMuscleGroup`
      (aliases like quadriceps→Quads, consistent casing across every
      badge/chip). Underlying stored-data reconciliation, if ever needed,
      is now a display-independent concern.
- [ ] BACKLOG: catalog new equipment we haven't modeled (functional
      trainer was added but unreferenced by any exercise yet)

## Polish & quality
- [ ] Accessibility audit (keyboard nav, screen reader, focus states)
- [ ] Performance audit (Core Web Vitals)
- [x] Component tests for the live active-workout flow
      (`activity/log/page.tsx`): freestyle add→log→save, the
      unchecked-sets confirmation, and the empty state. Heavy deps
      (Supabase, picker, rest timer, history hook) are mocked.
- [x] Offline-capable workout logging: a finished workout that fails to
      save because the device is offline is queued locally and auto-synced
      on reconnect (write-path only; not a full offline app shell)

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
- [~] Move the 20-odd `const supabase = createClient()` calls from
      module top level into components/hooks. *Reversed:*
      `createBrowserClient` is reentrant and cheap; module-level
      singletons match Supabase's own recommended pattern. The
      test-side awkwardness is fully handled by `vi.hoisted`.
      Leaving as-is unless we hit a concrete problem.
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
- [x] Component tests for `QuickLogExercise` and `exercise-picker`
- [ ] Set up ESLint (`next lint` is currently interactive); add a
      lint step to the CI workflow.
- [x] Ratchet up coverage thresholds in `vitest.config.ts` — now
      80 / 78 / 68 / 81 (was 72 / 72 / 55 / 74).

## Out of scope (v1, per PRD)
- Social features (sharing, leaderboards)
- Wearable integration beyond the existing Oura dashboard
- Trainer marketplace
- In-app payments

_(Nutrition / diet tracking was formerly out of scope; now shipped as photo
calorie & macro logging — see the section above.)_
