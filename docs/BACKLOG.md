# Product Backlog — PF Fitness Tracker

Shipped features are documented in the PRD. This backlog tracks what's
still open.

## Resolved on-device issues
Both are closed, and both are kept here rather than deleted because what made
them hard is worth remembering. **Profile → Diagnostics** answers this whole
class of question from inside the app — push state, device state and the
viewport readout — so neither needed server logs or a dashboard in the end.

- [x] **Push notifications arrive.** RESOLVED — the cause was iOS Do Not
      Disturb, not the app. DND suppresses banners for a push that was
      delivered perfectly well, so the server reported success and the device
      showed nothing. Turning Focus off, notifications appeared immediately.
      Two supporting signals that were misread for a long time: the crescent
      moon visible in the status bar of every screenshot, and the absence of a
      CraigFitness entry in Settings → Notifications (the Home Screen app was
      added from Brave, so iOS files its notifications under Brave — which was
      itself set to "Deliver Quietly").
      Real bugs were found and fixed on the way, and are worth keeping even
      though none of them was the cause:
      - The scheduled sender skipped any user with no `user_profiles.timezone`,
        silently and permanently. `refreshPushSubscription()` now re-sends the
        subscription and timezone on every app load, and the cron reports skip
        reasons instead of a bare `ok: true`.
      - `/api/push/subscribe` discarded the error from the timezone update.
      - Profile → Diagnostics now reports push status and device state, so this
        class of question is answerable in the app rather than from server logs.
      Lesson for next time: an environmental cause (OS settings, Focus modes,
      which browser installed the PWA) deserves ruling out BEFORE a code hunt,
      not after.
- [x] **Bottom nav sits flush with the bottom** in the installed PWA. Closed
      2026-07-31, verified on device: `shell h 956`, `nav bot 956`, and the
      geometry closes exactly (`main top 123` + `h 736` = `nav top 859`,
      + `97` = 956 = screen). Took two things — a reinstall and a CSS fix —
      because there were two faults stacked on top of each other.
      - `a6416a5` stopped the document scrolling the whole shell out of place
        (`overflow: hidden` on the root, scoped to `[data-app-shell]`). That
        restored the TopBar, which had been missing from every collapsed
        screenshot and was the part that never fitted the height theories.
      - What remains is a gap of ~91pt below the nav — almost exactly the
        status bar (~62) plus the home indicator (~34). That is iOS insetting
        the web view, i.e. `viewport-fit=cover` NOT applying, even though it is
        in the deployed HTML. iOS caches the launch configuration when the app
        is added to the Home Screen, and this install predates that meta.
      - The reinstall from Safari was done and did its job: `insets` now read
        t/b 62/34 where they were 0, so `viewport-fit: cover` is applying.
        The shell also no longer scrolls out of place — `shell top 0`, and
        `nav bot` equals the viewport bottom.
      - What the readout then showed is a different, smaller fault: the
        viewport itself is short. screen 956, but window.inner / doc.clientH /
        100% / 100svh / 100dvh all 894, against 100lvh / 100vh of 956. iOS
        reports the initial containing block as the SMALL viewport, excluding
        the status-bar strip, so a `height: 100%` chain builds a shell 62pt
        shorter than the screen — the band under the nav. (This also rules
        out `dvh` as the fix that never was: it measures 894 here too.)
      - Fixed in `00ffc09`: `height: 100lvh` on the root chain, scoped to
        `display-mode: standalone` so browser tabs keep the percentage chain.
      - A side effect worth remembering: `window.inner` and `visualViewport`
        themselves went 894 → 956. A CSS height rule cannot move the viewport,
        so what actually happened is that filling the root to the large
        viewport let `black-translucent` take effect and iOS handed over the
        whole screen. The meta tags had been asking for that all along and
        never got it while the root measured short.
      - Lesson, alongside the Do-Not-Disturb one above: when a symptom
        survives a correct fix, suspect a SECOND fault rather than assuming
        the first fix was wrong. Three of the five attempts below were spent
        re-treating an already-solved containing-block problem.
      - One earlier readout, taken in a browser tab, established a useful
        fact: `100dvh`, `100svh`, `100lvh`, `100vh` and `100%` all resolved
        identically (727), ruling out the viewport-unit theory there.
      - History: #131 removed html/body overflow; #135 switched `<main>` to
        `overflow-x-clip`; both treated it as a containing-block problem, and
        the containing-block chain was never at fault. #144 took the nav out of
        `position: fixed` — right — but sized the shell with `h-dvh`, which
        collapsed it on device; reverted. #145 reapplied it with a percentage
        chain and added the diagnostic.

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
- [x] Dashboard split finished (`dashboard/page.tsx` 1,565 → 570 lines, PRs
      #136–#141). The six analytical cards are now self-fetching components,
      each with its own test: Recent PRs, Volume Trend, Weight Trend, and
      Recent Workouts moved to `/insights`; This Week and Today's Oura Summary
      were extracted but kept on the dashboard (daily-glance cards). Shared
      query lives in a new `useStrengthSets` hook; the weekly-progress math
      moved to `lib/weekly-progress.ts`. Both tested.
- [x] `activity/log/page.tsx` split (1,563 → 1,196 lines). Seven slices, each
      pure logic to `lib/*` with tests: `active-workout` (model + cardio
      maths), `workout-edits` (the nine state transforms), `useElapsedSeconds`,
      `ExerciseDrawer` + `UncheckedExercisesDialog`, and `finish-workout`
      (payload, offline heuristic). Four real bugs fell out: the rest timer was
      armed from inside a `setWorkout` updater (mistimed, could double-fire),
      out-of-range indices spread `undefined` into the workout, the cursor
      landed wrong after deleting an exercise, and `instanceof Error` missed
      Supabase's plain error objects so a network failure would have been
      reported instead of queued — losing the workout.
      Then `workout-init` (the three launch paths — plan, template, append —
      which each carried their own copy of the same catalog-definition-to-
      ActiveExercise mapping) and `workout-calories` (reducing a set list to
      the totals and averages the MET maths wants). Both faithful refactors,
      no behaviour change; the existing page tests passing unchanged is the
      evidence. Two things they pinned down rather than fixed, since each is a
      behaviour change deserving its own commit: a template exercise whose
      name isn't in the static catalog is dropped silently (name is the only
      key the DB and the catalog share), and `rest_seconds || 60` turns a
      prescribed 0s rest into 60s.
      Then `session-pr` (1,196 → 1,180): the in-workout trophy check, which
      had been ~25 lines of logic inline in a JSX map. It has to beat both the
      all-time best AND every earlier completed set this session — without the
      second half, three sets at one new weight each light up — and the whole
      comparison inverts for assisted exercises. 19 tests. The set-row grid
      template, previously two copies that would silently misalign the header
      from the rows, is now one constant.
- [x] `profile/page.tsx` (~200 lines, from 1,019) — done. Extractions along
      the way: `profile-stats` (streak + volume; fixed a DST bug that
      truncated the workout streak to 1 twice a year), `profile-form` (the
      ~90-line parse-and-compare on save, which could write NaN),
      `oura-connect-errors` (shared with the OAuth callback; the guard
      accepted prototype keys and crashed the page), and `OuraConnectionCard`
      (self-fetching, owns the whole connect/disconnect flow). Finished with
      `ProfileSettingsCard` (the form: fifteen field states + the update
      mutation) and `AccountCard` (email, password, sign-out, delete flow),
      both self-fetching with component tests; the page keeps the header,
      stats row, and the single feedback banner the cards report into
      (`ProfileFeedback`, one shared type).
- [x] `lib/load-type.ts` — one derivation of how an exercise carries load
      (loaded / bodyweight / assisted). Two bugs came from each call site
      inferring it separately from `equipmentId === null`: Pull-Up got weight
      advice it couldn't act on, and a farmer hold lost its weight input
      entirely. PR #146.

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
- [x] Weekly digest push delivery (Sunday nudge): `/api/cron/weekly-digest`
      mirrors `WeeklyDigestCard`'s query server-side (same windows, same pure
      helpers, but bucketing days in the *user's* timezone rather than the
      server's UTC) and sends at Sunday 18:00 local. Quieter than the card by
      design: a week whose only action is the "you're on track" filler sends
      nothing. `last_digest_sent_on` de-dupes the DST fall-back hour. Cron is
      scoped to Sun+Mon UTC — the only days Sunday 18:00 can land on anywhere
      between UTC+14 and UTC-12.
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
- [x] Endurance goals: duration AND distance targets. Duration (longest
      session in minutes) already existed; distance was the missing half,
      despite `set_logs.distance_miles` being logged all along. The goal's
      stored `unit` discriminates — "mins" or "mi" — so every pre-existing
      endurance goal keeps reading minutes with no migration. Progress reads
      the matching best, and the trend chart plots the matching series.

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
- [x] Caffeine from a logged drink reaches the caffeine tracker. A 32 oz Dr
      Pepper is ~110mg — about a cup of coffee — and used to contribute
      nothing to the energy read or the late-caffeine sleep warning unless
      the same drink was logged twice. Snap Meal now offers the dose,
      pre-checked and editable, and writes it as a `caffeine_logs` row
      linked by `source_food_log_id` so a delete cascades and a portion
      rescale follows. Known drinks resolve from a name/volume table
      (`src/lib/caffeine-foods.ts`) rather than the model, which can't tell
      Coke from Diet Coke in a photo. Log Caffeine takes a typed drink name
      too, since its presets are fixed servings.
- [x] **Caffeine backfill run against the live database.** Applied 2026-08-06:
      131 meals scanned, 6 rows written (458mg) — two coffees, iced tea, a
      cola, green tea, and the 32oz Dr Pepper. The script stays in `scripts/`
      and is idempotent (meals with a linked dose are skipped), so it's safe
      to re-run if history is ever imported from elsewhere. See
      `supabase/README.md → One-off data scripts`.

      Three real bugs were caught by the dry run before anything was
      written, which is the argument for that script printing its plan
      rather than just doing the work:
      - A glass of milk scored as 128mg of espresso, because the model's
        hedge — "(or milky beverage like chai latte)" — was matched instead
        of the food. Parenthetical asides are now stripped before matching.
      - A cola scored as caffeine-free: the table knew Coca-Cola but not a
        generic "cola", so the only match in "iced cola soft drink, root
        beer" was the root beer.
      - One cola counted twice, from a plate row mentioning it in passing
        and the drink row logged at the same second. Same-drink doses inside
        the duplicate window now collapse.

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
- [x] Late-caffeine cutoff follows the user's actual bedtime rather than a
      fixed 2pm. `buildBedtimePlan` already derived a personal
      `caffeineCutoff` (8h before a bedtime worked back from wake time and
      sleep goal) and `lateCaffeineFlag` ignored it, so a 5am riser was told
      2pm was fine when their own cutoff was 1:30pm. The cutoff is a
      `ClockTime` now, compared at minute precision — a bedtime-derived one
      is usually off the hour — and `useBedtimePlan` shares the plan across
      the three cards that need it so they can't disagree.
- [x] Sharpen caffeine further: personal half-life / sensitivity learned
      from the check-in history (`caffeine-personal.ts` + `useCaffeineModel`).
      Grid-search over candidate half-lives (3–9h), scoring each by how well
      its on-board estimate correlates with felt energy — computed WITHIN
      time-of-day bands so the morning-coffee/morning-energy circadian
      confound can't fake a signal — plus a sensitivity slope (energy per
      100 mg). Falls back to the 5.5h population average, saying why, until
      there are 12+ check-ins with real caffeinated/clear contrast. The
      caffeine card's "still active" math uses the personal value and states
      the finding in one line.
- [x] Energy trend + personal drivers (`energy-correlations.ts` +
      `EnergyDriversCard` on /insights): correlates felt energy against its
      candidate drivers and surfaces each user's top levers. Was shipped but
      left unchecked here.
- [x] Morning vs. evening framing: the check-in prompt and the
      felt-vs-expected copy are now phrased per part of day
      (`checkinPrompt` + a part-aware `reconcileEnergy`). The fix that
      motivated it: a strong morning used to get the evening's "don't
      let it turn into a late night" advice — it now reads as a base to
      train on; a drained morning gets get-going advice, a drained
      evening gets wind-down advice. `assessEnergy` threads the hour's
      part of day through automatically.

## Equipment & exercises
- [x] Free-weight exercise catalog expanded (16 added Apr–May 2026)
- [x] Unify muscle-group *display* labels via `formatMuscleGroup`
      (aliases like quadriceps→Quads, consistent casing across every
      badge/chip). Underlying stored-data reconciliation, if ever needed,
      is now a display-independent concern.
- [x] Functional trainer modeled end to end: it existed in the static
      equipment catalog with no DB row and no exercises. Migration 00023
      adds the equipment row plus four dual-column staples the
      single-pulley Cable Machine doesn't cover — Cable Chest Press,
      Single-Arm Cable Row, Cable Glute Kickback, Cable Pallof Press —
      mirrored in the static catalog with logger descriptions.
      (Remember: migrations are applied to the remote manually.)

## Polish & quality
- [ ] Accessibility audit (keyboard nav, screen reader, focus states)
      - [x] Static pass across the app: every icon-only button now has an
            accessible name (month nav, template edit/save/cancel, picker
            close), the logger's set-row inputs carry per-set labels
            ("Set 2 weight (lbs)", "Set 1 seconds held", incline, RPE with
            aria-pressed), and the hand-rolled overlays (exercise picker,
            exercise drawer) gained dialog semantics + Escape-to-close via
            a shared `useEscapeKey`. Nav/TopBar/Dialog were already right.
      - [ ] On-device screen-reader pass (VoiceOver) and a real keyboard
            walk of the logger — the part a static sweep can't cover.
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
- [ ] Extract business logic from the remaining 1000+ line page files
      into hooks under `src/hooks/` and pure helpers under `src/lib/`.
      Refactor first, then test what comes out. (`dashboard/page.tsx` is
      done — see the Code & UI hygiene section.)
      - [x] `goals/page.tsx` (897 → ~350 lines): reads → `useGoalsData`,
            Add-Goal rules → `goal-form.ts` (typed insert, killed an
            `as any`), row shaping → `goal-exercise-rows.ts`, milestones
            → `milestone-data.ts`, projection pipeline →
            `projectFromRecentLogs`, weight percent → `weightGoalPercent`;
            AddGoalModal and GoalCard moved to `components/goals/`. All
            new lib code unit-tested.
      - [x] `activity/log/page.tsx` (1,206 → 916 lines): the init effect
            (append/template/plan/freestyle resolution) → `useWorkoutInit`,
            save + queue-parking IO → `useFinishWorkout`, the adaptive
            prefill → `useAdaptivePrefill` over pure `workout-prefill.ts`
            (decision + transform), and the per-exercise render modes
            (timed hold, bodyweight, grid columns, hold-timer parse) →
            `exercise-display.ts`. What remains is render + thin state
            wrappers over the already-tested `workout-edits` transforms;
            the existing page component tests passed unchanged through
            the refactor.
- [~] Consider swapping the custom Dialog component for
      `@radix-ui/react-dialog`. *Stale:* the gap that motivated this —
      no focus trap or scroll handling — has since been closed in place:
      the custom Dialog now traps Tab, moves focus in on open and
      restores it on close, closes on Escape, scroll-locks the app
      shell, and sets aria-modal/labelledby/describedby. No remaining
      reason to take the dependency + testing churn.

## Testing follow-ups
- [x] Component tests for `QuickLogExercise` and `exercise-picker`
- [x] Set up ESLint and add a lint step to CI: `.eslintrc.json` is
      configured, `npm run lint` runs non-interactively, and the CI
      workflow runs it before typecheck + coverage.
- [x] Ratchet up coverage thresholds in `vitest.config.ts` — now
      80 / 78 / 68 / 81 (was 72 / 72 / 55 / 74).

## Out of scope (v1, per PRD)
- Social features (sharing, leaderboards)
- Wearable integration beyond the existing Oura dashboard
- Trainer marketplace
- In-app payments

_(Nutrition / diet tracking was formerly out of scope; now shipped as photo
calorie & macro logging — see the section above.)_
