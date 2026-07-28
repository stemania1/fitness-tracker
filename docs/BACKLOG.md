# Product Backlog — PF Fitness Tracker

Shipped features are documented in the PRD. This backlog tracks what's
still open.

## Motivation layer
- [x] Personal-record detection during active workout (heaviest weight)
- [x] Epley 1RM estimate on workout detail
- [x] Progressive overload nudge ("Try +5 lbs") when last session cleared
      the top of the rep range on all sets
- [x] Adaptive per-exercise targets (`src/lib/adaptive-target.ts`): last
      session's logged sets → a recommended next weight (progress / repeat /
      hold / new). The logger pre-fills that target weight and an
      AdaptiveTargetBanner shows the reason, so the prescribed session moves
      with recorded performance instead of using static preset weights.
- [x] Assisted-exercise inversion: exercises flagged `assisted` (machine
      counterweight, e.g. Assisted Pull-Up) treat weight as help — progression
      DROPS assistance and the in-workout PR trophy fires on LESS assistance
      (`isNewAssistedRecord`, `allTimeMinWeight`).
- [x] Assisted inversion for the dashboard "Recent PRs" card: `findRecentPRs`
      now tracks the running *best* per exercise (lightest for assisted,
      heaviest otherwise), so less counterweight registers as a weight PR and
      more assistance no longer does. The set feed threads the catalog
      `assisted` flag through, the card labels the weight as "assist" and
      drops the meaningless Epley 1RM estimate for assisted lifts.
- [x] Dashboard "Recent PRs" card showing the last 5 weight PRs (30-day window)
- [x] Rep PR detection (most reps ever at a given weight, dashboard card)
- [x] Workouts-per-week streak tracker
- [x] Volume trend chart (weekly total lifted, last 8 weeks)
- [x] Deload week suggestion when 4 consecutive weeks of 5%+ volume climb

## Code & UI hygiene
- [x] Shared local-date helpers (`lib/dates.ts`): the local YYYY-MM-DD
      formatter had been reimplemented in eight files under four names, plus
      two copies each of `epochDay` and the date-string shift. All callers now
      use one module (net -55 lines).
- [x] Prioritized dashboard: the multi-week analytical cards moved to a new
      `/insights` page grouped into sections (Weight · Energy & sleep ·
      Training · Planning), reached via a "More insights" link. The dashboard
      keeps only what's actionable today — 25 cards down to 16, and its bundle
      from 55.5 kB to 43.2 kB.
- [ ] Dashboard still holds ~800 lines of inline analytical JSX (This Week,
      Oura summary, weight/volume trends, recent workouts, recent PRs) that
      depend on page-local queries. Extracting those into components + hooks
      is the remaining half of the split.
- [ ] `activity/log/page.tsx` (1,563 lines) and `profile/page.tsx` (1,019)
      are the next files worth breaking up.

## Training quality
- [x] Muscle-group balance monitor (`muscle-balance.ts` +
      `MuscleBalanceCard`): volume share per muscle group over the last 4
      weeks (compound sets split evenly so shares sum to 100), the push:pull
      and upper:lower ratios with a skew verdict, and under-trained groups
      called out. Quiet until there's enough logged work.

## Goal tracking
- [x] Weekly coach digest (`weekly-digest.ts` + `WeeklyDigestCard`): one
      readout across all three goals — workouts this week vs last (fitness),
      adaptive-TDEE weight trend vs target (weight), avg energy + sleep
      (energy) — plus the 1–2 highest-impact actions for the week ahead,
      prioritized (zero-workouts > intake-off-target > low-sleep > energy
      driver). In-app on the dashboard; weekly push delivery is a follow-up.
- [x] Adaptive TDEE / energy-balance engine (`adaptive-tdee.ts`): learns
      maintenance calories empirically from the weight trend vs logged intake
      (TDEE = avg intake − weight-change × 3500), then recommends a daily
      calorie target to reach the weight goal at a safe rate. Dashboard
      `EnergyBalanceCard` shows maintenance, trend, target, and a confidence
      level, with a "still learning" state until ~2–3 weeks of data. No new
      tables — uses weigh-ins + food logs already collected.
- [x] Weight goal: target + projected timeline based on actual rate
- [x] Milestone celebrations (first workout, 10 workouts, first PR, four-week streak, goal achieved)
- [x] Strength goals: target 1RM per exercise, progress chart. Current
      progress is the best **estimated 1-rep max** (Epley) from logged sets —
      heavier weight and more reps both move it, so sub-max work counts —
      falling back to heaviest weight when reps weren't logged. Per-goal trend
      chart plots daily best e1RM toward the target.
- [ ] Endurance goals: cardio duration / distance targets

## Logging UX
- [x] Quick Log Strength (set-by-set entry of a session you just finished)
- [x] Backdating chips (Today / Yesterday / Earlier…) on the strength,
      exercise, meal (Snap Meal), and caffeine quick logs — for anything you
      forgot to log in the moment. An always-visible time input sits under the
      chips so the time-of-day is editable on any day (not just Earlier…),
      which matters for meal/caffeine timing in the energy read.
- [x] Treadmill: time + distance → computed Avg mph + optional incline
- [x] Outdoor Run: time + distance → computed pace (min/mi)
- [x] Incline contributes to calorie estimate at walking speeds
- [x] Edit a saved workout log (sets and notes)
- [x] Add exercises to a saved workout log (append mode in the logger),
      pre-loading the plan's remaining exercises when it's a plan session
- [x] "Save without these?" confirmation when finishing with unchecked exercises
- [x] Pre-fill new set weights from previous performance
- [x] Rest-timer auto-advances to the next exercise when sets are complete
- [x] Bodyweight exercises (no loadable equipment) show "Bodyweight" instead
      of an empty lbs input
- [x] Hold timer (count-up stopwatch) for timed holds (e.g. plank) — records
      the elapsed seconds into the set instead of manual entry
- [x] Adjust a logged meal's portion (`meal-portion.ts`): ¼ / ½ / ¾ / 1½ / 2×
      chips rescale every nutrient — including glycemic load, which tracks the
      carbs actually eaten — and relabel the description ("½ of …", replacing
      any existing prefix rather than stacking). For when the photo estimate
      sized the plate, not what you ate.
- [x] Edit a logged meal's time in place: the expanded meal card shows
      "Logged at …" with an inline Edit → time input (keeps the date, so the
      meal stays on today's list). Meal timing feeds the energy read. Same
      inline time-edit on the caffeine card's drink list (`meal-time.ts`
      helpers are shared) — timing drives the "still active" + late-caffeine
      sleep signals.
- [x] Daily creatine tracker: dashboard card (by the caffeine card) with a
      consecutive-day streak (`creatine-streak.ts`). Backed by a
      `creatine_logs` table (migration `00016`, applied manually). An evening
      in-app + push reminder nudges if it's not logged (new `log_creatine`
      reminder category, on by default).
- [x] Multi-dose creatine + configurable target: doses accumulate across the
      day (+2.5/+5/+10 g) toward a per-user daily target on the profile
      (migration `00020`, default 5 g — some protocols use ~10 g split up),
      with a progress bar and "target hit" state (`creatineProgress`).
- [x] Day navigation on the dashboard's Today's Plan and Nutrition cards:
      swipe left/right (or ‹ › arrows) to step through days. The plan card
      looks ahead (today → future, stopping at the plan's end); the meal card
      looks back (today → past). Shared helpers: `day-nav.ts` (offset →
      label/window), `swipe.ts` + `useSwipe` (gesture), `DayNav` (arrows).
- [x] "About this exercise" panel in the logger: a plain-language description
      (`src/data/exercise-descriptions.ts`), a generated front/back muscle-map
      diagram driven by the exercise's muscle groups (`MuscleMap`), and the
      recommended rest between sets — so an unfamiliar machine name isn't a
      mystery mid-workout

## Time-efficient training
- [x] Express (time-boxed) workout: "I have N minutes" (15/20/30) → a
      full-body compound circuit sized to fit (`expressPlanShape` in
      `workout-generator.ts`: fewer/lighter sets and no cardio finisher for
      short windows). Dashboard `ExpressWorkoutCard` generates, previews, and
      saves it as a template to start/log. Built for a time-scarce schedule.
- [x] Schedule-aware weekly plan (`weekly-schedule.ts` + `WeeklyScheduleCard`):
      lays out a realistic week from the time actually available — longer
      sessions on weekend days, short ones spread across weekdays (Tue/Thu
      first, so there's recovery between), with a post-wake AM slot suggested
      when a wake time is set. Weekday/weekend minute budgets live on the
      profile (migration `00019`). Complements the fixed 12-week plan.
- [x] Sleep-anchored bedtime target (`bedtime.ts` + `BedtimeCard`): from the
      profile's usual wake time + sleep goal, works backward to a target
      bedtime, a wind-down time (30 min before bed), and a last-safe-caffeine
      cutoff (8h before bed). Profile page gained wake-time + sleep-goal
      fields (migration `00018`); dashboard card prompts to set it if unset.

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
- [x] Smart in-app reminders: `src/lib/reminders.ts` turns the day's state
      (workout gap, meals not logged, evening energy check-in, weekly
      weigh-in) into time-gated, prioritized nudges shown on the dashboard
      (`RemindersCard`), dismissible per day. No infra/migration — computed
      from data already loaded.
- [x] Reminder preferences (server-side): master switch, per-category
      toggles, and quiet hours stored on `user_profiles.reminder_settings`
      (`src/lib/reminder-settings.ts`), surfaced as a Reminders card in the
      profile and honored by `computeReminders`. Syncs across devices (the
      per-day localStorage dismissal on the dashboard still handles "not now").
- [x] Web-push reminders: service worker + `push_subscriptions` + subscribe/
      unsubscribe API + an hourly Vercel-cron sender (`/api/cron/reminders`)
      that reasons in each user's stored timezone and respects their
      preferences, quiet hours, and a once-per-local-day guard. Push toggle
      lives in the Reminders settings card. Requires VAPID keys, a service-
      role key, and CRON_SECRET — see `docs/PUSH_NOTIFICATIONS.md`. Unreliable
      on iOS unless the app is installed to the Home Screen.

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
- [x] Daily caffeine tracker card on the dashboard: total vs. the 400 mg
      guideline, mg still active now, the late-caffeine warning, and the day's
      drinks (with delete).
- [x] Personal energy-driver correlations (`energy-correlations.ts`): mines
      the energy check-ins against what you log — training (same day + day
      after), caffeine, high-GL meals, total calories, creatine — via a robust
      high-vs-low group comparison, and surfaces the strongest signals in plain
      language ("energy runs ~15% higher on days you train"). Dashboard
      `EnergyDriversCard`, with a learning state until ~2 weeks of check-ins.
      Sleep not included yet (Oura history isn't stored — see below).
- [x] Store Oura daily history (sleep/readiness): `oura_daily` table
      (migration `00017`), backfilled ~90 days via `POST /api/oura/sync`
      (`mergeOuraDaily` merges the daily-sleep, sleep-period, and readiness
      docs; pure + tested). The dashboard fires the sync once a day. Sleep
      score, sleep hours, and readiness now feed the energy-driver
      correlations; opens the door to long-term sleep/readiness trends.
- [x] Sleep & recovery trend charts (`oura-trends.ts` + `SleepTrendCard`):
      daily sleep-hours / sleep-score / readiness lines over 8 weeks from the
      stored `oura_daily` history, with a 7-day-vs-prior-7 delta and a metric
      toggle.
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
