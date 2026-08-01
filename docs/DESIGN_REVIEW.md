# Design Review — Code & UX

Reviewed at `db2f488`. Baseline is healthy: `npm run typecheck` and `npm test`
both pass, `src/lib/` is genuinely well-factored (pure, tested, one concern per
file), and the recent extractions (`workout-edits`, `finish-workout`,
`session-pr`) show the right instinct.

The problems are not in `lib/`. They are in the **seam between components and
Supabase**, and in the **UI layer**, where the same five shapes have been
retyped 20–50 times each. Nothing here is a crisis; all of it is the kind of
drift that compounds.

Findings are ordered by payoff. Each is independently shippable.

---

## 1. Data layer

### 1.1 The auth preamble is written 52 times

Every query in the app opens with the same six lines:

```ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) throw new Error("Not authenticated")
```

- 52 call sites across non-test files
- 63 occurrences of the `"Not authenticated"` string

`getUser()` is not free — it round-trips `/auth/v1/user` to validate the JWT on
every call. On a single dashboard mount roughly **24 read queries fire, each
preceded by its own `getUser()`**. That's ~40+ requests to paint the home
screen, on gym wifi.

The fix already exists in the codebase but was never promoted:
`src/app/(dashboard)/goals/page.tsx:103` defines `getAuthUserId()`, private to
that one file.

**Do:** promote it to `src/lib/supabase/auth.ts`, back it with a cached
`["auth-user"]` query (the key is already in use at one site), and add a
`userQuery(key, fn)` helper that threads the id in:

```ts
// src/lib/supabase/user-query.ts
export function useUserQuery<T>(
  key: QueryKey,
  fn: (userId: string, sb: SupabaseClient<Database>) => Promise<T>,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">
) { ... }
```

Call sites collapse from ~12 lines to ~5, and the auth round-trip happens once
per session instead of 24 times per page.

### 1.2 `user_profiles` is fetched 8 different ways

Eight distinct cache keys, all reading the same single row:

| Key | Selects | Site |
|---|---|---|
| `["profile"]` | `*` | dashboard, goals, profile, workouts/generate |
| `["profile-stats"]` | count | `profile/page.tsx:105` |
| `["weight-target-profile"]` | `target_weight, current_weight` | `WeightTrendCard.tsx:47` |
| `["this-week-profile"]` | `workout_days` | `ThisWeekCard.tsx:30` |
| `["weekly-calories", …]` | `current_weight, age, sex, height_inches` | `ThisWeekCard.tsx:81` |
| `["insights-profile"]` | `age, sex` | `insights/page.tsx:56` |
| `["express-profile"]` | `primary_goal, fitness_level, limitations, age` | `ExpressWorkoutCard.tsx:31` |
| `["bedtime-profile"]` | `wake_time, sleep_goal_hours` | `useBedtimePlan.ts:27` |
| `["oura-card-age"]` | `age` | `OuraSummaryCard.tsx` |

`ThisWeekCard` fetches the profile **twice, in the same component**, under two
keys. Seven of these are reachable on one dashboard mount.

The column-narrowing buys nothing — it's one row, and the wire saving is
dwarfed by the extra round-trip and the extra `getUser()`.

Worse, they don't invalidate together. `QuickLogWeight` writes
`current_weight` and invalidates `["profile"]` and `["weight-logs-recent"]`
(`QuickLogWeight.tsx:54-56`) — so `["weekly-calories"]`, which uses
`current_weight` for the MET calorie maths, keeps serving a stale weight until
its own key happens to invalidate.

**Do:** one `useProfile()` hook in `src/hooks/useProfile.ts`, one
`["profile"]` key, `select("*")`, consumers pick fields off the result. Delete
the other eight. The `(dashboard)/layout.tsx` server component already fetches
the profile row for the `onboarding_done` gate — seed it into the query cache
there via hydration and the client fetch disappears entirely on first paint.

### 1.3 Query-key collisions: same key, different shape

This is the one actual correctness hazard.

`["workout-logs-all"]` is defined three times with two different projections:

- `dashboard/page.tsx:118` → `.select("id, started_at")`
- `ThisWeekCard.tsx:64` → `.select("id, started_at")`
- `goals/page.tsx:161` → `.select("id, started_at, finished_at")`

Whichever mounts first wins the cache. Navigate dashboard → goals and the goals
page gets rows with no `finished_at`. Today nothing breaks, because
`finished_at` is selected and never read (it appears exactly once in
`goals/page.tsx`, on the select line itself) — so this is latent, not live. But
it's a trap: the next person to use `finished_at` there gets a bug that only
reproduces after a specific navigation.

**Do:** drop the unused `finished_at`, and centralize the definition. A
`src/lib/queries/` module exporting one `queryOptions()` per key makes the
collision structurally impossible rather than a review-time catch.

### 1.4 A 20-line `queryFn` is duplicated verbatim

The `["oura-summary"]` fetcher — tz-offset arithmetic, three status-code
branches, and all — exists twice, character for character:

- `dashboard/page.tsx:163-186`
- `OuraSummaryCard.tsx:47-68`

`OuraSummaryCard`'s docstring explains that sharing the key means the fetch
happens once. True, and the intent is sound — but the *implementation* is
copied, so an edit to one silently does nothing depending on mount order.

**Do:** extract `ouraSummaryQuery()` to `src/lib/queries/oura.ts`. The
timezone-offset formatting (`sign`/`absMin`/`padStart`) belongs in
`lib/dates.ts` next to the other local-day helpers.

### 1.5 Near-duplicate keys for the same rows

Several pairs read the same table for the same day under different keys, so
each pays a full round-trip and they can disagree on screen:

- `["caffeine-today"]` (dashboard) vs `["caffeine-today-list", dayStart]` (CaffeineCard)
- `["creatine-today", todayStr]` (dashboard) vs `["creatine-logs", today]` (CreatineCard)
- `["energy-fuel-today"]` (dashboard) vs `["food-logs-today", startIso]` (NutritionCard)
- `["energy-checkin-exists", todayStr]` (dashboard) vs `["energy-checkins", today]` (EnergyCheckInCard)

In each pair the dashboard fetches a thin "did this happen today?" boolean while
the card fetches the rows. The boolean is derivable from the rows.

**Do:** keep the row query, derive the boolean. Four queries and four
`getUser()` calls come off the dashboard mount.

### 1.6 Three pages bypass TanStack Query entirely

`activity/page.tsx`, `activity/[id]/page.tsx`, and `activity/log/page.tsx` fetch
with `useState` + `useEffect` + `createClient()`, against the CLAUDE.md rule
that "all API calls use TanStack Query for caching and invalidation."

The practical cost: `activity/page.tsx` refetches the full workout history on
every mount, and nothing invalidates it after a workout is saved — so a
just-finished workout doesn't appear until a hard reload.

---

## 2. Component layer

### 2.1 The card shell is retyped 26 times

```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2 text-base">
      <Icon className="h-5 w-5 text-{hue}-500" />
      Title
    </CardTitle>
  </CardHeader>
  <CardContent>
    {isLoading ? <Skeleton … /> : data.length ? … : <EmptyState />}
  </CardContent>
</Card>
```

- 26 files repeat that exact `CardTitle` className
- 27 repeat `CardHeader className="pb-3"`
- 24 hand-roll their own `<Skeleton>` loading branch, at inconsistent heights
  (`h-40`, `h-[180px]`, `h-12` × 2, …)

**Do:** an `<InsightCard>` wrapper taking `icon`, `iconClass`, `title`, `action`
(the right-hand slot several cards already use), `isLoading`, `isEmpty`, and
`empty`. That is ~26 files × ~15 lines of shell removed, and it makes the
loading and empty states consistent by construction rather than by discipline.

### 2.2 The six QuickLog dialogs are one component

`QuickLogWeight`, `QuickLogCaffeine`, `QuickLogExercise`, `QuickLogFood`,
`QuickLogStrength`, `QuickLogFitnessTest` all share, byte-identical:

- the `DialogTrigger` className (`flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 …`)
- `DialogContent className="mx-4 max-w-sm"`
- the `<form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="mt-4 space-y-4">` wrapper
- the `{mutation.isError && <p className="text-sm text-red-600">…}` block
- the entire `DialogFooter` with hand-rolled Cancel + Save buttons

Only the fields in the middle and the mutation differ.

**Do:** a `<QuickLogDialog trigger={{icon, label}} title description mutation onSubmit>`
that renders the shell and takes fields as children. Roughly 250 lines of
duplication for ~60 lines of shared component.

### 2.3 `ui/button.tsx` exists and is routinely bypassed

`Button` has exactly the right variants (`default`, `secondary`, `destructive`,
`ghost`, `link`) and is imported in 22 files. Meanwhile:

- 27 sites hand-write `bg-purple-600 … hover:bg-purple-700` instead of `variant="default"`
- all 6 QuickLog dialogs hand-write the identical secondary Cancel button

The hand-rolled versions also drop the focus ring that `buttonVariants` provides
(`focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2`),
so keyboard focus is invisible on those controls.

**Do:** mechanical sweep. `DialogTrigger` should accept `asChild` or take
`className={buttonVariants({variant:"secondary"})}`.

### 2.4 `formatDate` is defined four times

`activity/[id]/page.tsx:68`, `activity/page.tsx:34`, `goals/milestones.tsx:64`,
`goals/page.tsx:86` — plus inline `toLocaleDateString("en-US", {month:"short",
day:"numeric"})` in `WeightTrendCard`, `RecentPRsCard` and others.

`activity/page.tsx` is the sharpest case: it declares module-level `DAY_NAMES`
and `MONTH_NAMES` at lines 28-32, then `formatDate` at line 34 redeclares both
arrays inline as locals.

`lib/dates.ts` is already the documented single source for day handling and its
header comment explicitly says these "were being reimplemented per file under
four different names." The same thing has happened again, one layer up, for
*display* formatting.

**Do:** add `formatShortDate`, `formatLongDate`, `formatWeekday` to
`lib/dates.ts`; delete the four locals.

### 2.5 `localToday()` exists; five files still hand-roll it

`lib/dates.ts` exports `localToday()`. These call `new
Date().toLocaleDateString("en-CA")` instead:

`EnergyCheckInCard.tsx:24`, `RemindersCard.tsx:17`,
`QuickLogFitnessTest.tsx:24`, `OuraSummaryCard.tsx:51`,
`TodaysWorkoutSession.tsx:23`, and `dashboard/page.tsx` at lines 174, 220, 222
and 315.

Pure mechanical dedup — the helper is already imported elsewhere in several of
these files.

### 2.6 `dashboard/page.tsx` is a 577-line client component

It runs 11 queries, derives 6 memoized values, and renders 12 cards each wrapped
in its own `<ErrorBoundary>`. Several of its queries exist only to feed props
into cards that also self-fetch — the "self-fetching card" convention in
CLAUDE.md and the prop-drilling are both in play at once, and the coupling
between them is invisible (it lives in matching query-key strings).

**Do:** pick one convention. Given the cards are already self-fetching, push the
remaining derivations down: `fuelState`, `caffeineLevel`/`caffeineWarning`,
`trainedToday` and `reminders` all belong in hooks
(`useFuelState`, `useCaffeineToday`, `useTodaysReminders`) that the cards call
directly. That takes the page under 200 lines and removes 6 of its 11 queries.
The repeated `<ErrorBoundary>` wrapper should move inside `<InsightCard>` (2.1)
so it can't be forgotten.

---

## 3. Design system drift

`docs/STYLE_GUIDE.md` and the code have diverged far enough that the guide is
now misleading rather than useful.

| Guide says | Code does |
|---|---|
| Neutrals are `slate-*` | **741** `gray-*` utilities vs **5** `slate-*` (82 files vs 8) |
| Purple 600 is the brand accent | 15 distinct accent hues in `components/activity` alone |
| Max content width `max-w-lg`, centered | no `max-w-*` anywhere in the layout or shell |
| Min tap target 44px | nav items are `py-1` + `text-xs`; metric chips are `px-2.5 py-1` |
| Body 14px, caption 12px | 20 uses of `text-[10px]` |

The accent spread is the visible one. Across the activity cards: purple (49),
amber (37), red (35), emerald (30), indigo (14), orange (8), blue (8), teal (7),
sky (5), rose (4), cyan (4), violet (2), lime (2), fuchsia (2), yellow (1).
Cards read as fifteen unrelated widgets rather than one product.

**The missing max-width is a real visual defect, not just drift.** There are 10
responsive utilities in the entire codebase (7 `sm:`, 2 `lg:`, 1 `md:`), and
`(dashboard)/layout.tsx` applies only `px-4 py-6`. On a desktop browser every
card stretches the full viewport width — a 1600px-wide chart of eight data
points. The app is mobile-only in practice but ships to the web.

**Do:**
1. Add `mx-auto w-full max-w-lg` to `<main>` in `(dashboard)/layout.tsx`. One
   line; fixes desktop everywhere at once.
2. Pick a rule for accents — suggestion: purple = brand/action, emerald =
   progress/success, amber = attention, red = error, and one neutral for
   everything else. Encode it as `CARD_ACCENTS` in `lib/constants.ts` and have
   `<InsightCard>` take an accent token rather than a raw Tailwind hue.
3. Decide `gray` vs `slate` and update whichever loses. Given 741 vs 5, update
   the guide to say `gray` and normalize the 5 stragglers — not the reverse.
4. Regenerate the guide from what's shipped, then treat it as binding.

---

## 4. UX / IA

### 4.1 The dashboard is a 12-card scroll with no hierarchy

Twelve full-width cards in a flat `space-y-6` list: Reminders, Weekly Digest,
Express Workout, Quick Actions, Today's Plan, Energy Check-In, Bedtime,
Nutrition, Caffeine, Creatine, This Week, Oura Summary, Oura Insights.

The style guide's own principle — "the most important action is always obvious"
— isn't met. "Start Workout", the primary action of a fitness tracker, is the
4th block down, below three cards that are all advisory.

Notably, `insights/page.tsx` already has the right pattern: a `<Section
title subtitle>` component grouping cards into "Weight", "Recovery", "Training".
The dashboard doesn't use it.

**Do:** hoist Quick Actions + Today's Plan to the top as a "Today" block, then
group the rest under the existing `<Section>` — "Fuel" (Nutrition, Caffeine,
Creatine), "Recovery" (Energy, Bedtime, Oura), "Progress" (This Week, Digest).
Consider collapsing the Fuel group by default; it's three cards deep for
something most users check once a day.

### 4.2 `/insights` is unreachable from the nav

`bottom-nav.tsx` has five tabs: Dashboard, Plan, Workouts, Log, Goals. Neither
`/insights` nor `/profile` is among them. `/insights` — which holds 12 analytical
cards, a substantial chunk of the app — is reachable only via a text link at the
very bottom of the dashboard, after all 12 cards.

That's a lot of built surface behind a link most users will never scroll to.

**Do:** either promote Insights into the nav (it's a peer of Plan and Goals, and
five tabs is already at the practical limit — Plan is the weakest of the five),
or move the entry point above the fold on the dashboard.

### 4.3 `ui/dialog.tsx` has three real accessibility defects

The custom Dialog (`src/components/ui/dialog.tsx`) handles Escape and
scroll-lock correctly, but:

1. **No focus management.** Focus is never moved into the dialog on open, never
   trapped, and never restored to the trigger on close. Tab from an open dialog
   walks into the page behind the overlay. WCAG 2.4.3 / 2.1.2.
2. **A hardcoded, shared element id.** `DIALOG_TITLE_ID = "dialog-title"` is a
   module constant applied as the `id` of every `DialogTitle` and referenced by
   every `DialogContent`'s `aria-labelledby`. Any two dialogs mounted at once
   produce duplicate ids and an ambiguous accessible name. Should be `useId()`.
3. **`DialogDescription` isn't wired up.** Every dialog renders one, and none is
   referenced by `aria-describedby`, so screen-reader users don't hear it.

Also: background content isn't `inert`/`aria-hidden`, so the whole page stays in
the screen-reader tree behind the modal.

This is 6 dialogs' worth of impact, including the primary logging flows.
Worth fixing in the primitive — roughly 40 lines.

---

## Suggested order

| # | Change | Payoff | Risk |
|---|---|---|---|
| 1 | `max-w-lg` on the layout `<main>` | Fixes desktop app-wide | ~zero |
| 2 | `localToday()` sweep (2.5) + `formatDate` consolidation (2.4) | Mechanical, tests cover it | ~zero |
| 3 | `useProfile()` — collapse 8 keys to 1 (1.2) | −7 queries per dashboard mount, fixes stale-weight | low |
| 4 | `useUserQuery` helper (1.1) | −50 copies of the auth preamble, −24 auth round-trips | low |
| 5 | Dialog focus trap + `useId` (4.3) | Real a11y fix, 6 flows | low |
| 6 | `<InsightCard>` shell (2.1) | −26 × 15 lines, consistent states | medium |
| 7 | `<QuickLogDialog>` shell (2.2) | −250 lines | medium |
| 8 | Centralize query keys in `lib/queries/` (1.3, 1.4, 1.5) | Kills the collision class | medium |
| 9 | Thin `dashboard/page.tsx` to composition (2.6) | 577 → ~200 lines | medium |
| 10 | Dashboard grouping + Insights in nav (4.1, 4.2) | Surfaces built-and-buried features | needs your call |
| 11 | Accent-token palette + regenerate style guide (§3) | Coherent product | medium |

1–5 are safe and independently mergeable. 10 and 11 are product decisions rather
than refactors and shouldn't be done without a call from you — particularly
which of the five nav tabs gives way to Insights.

### Explicitly not flagged

`src/lib/` is in good shape and needs no consolidation — the one-concern-per-file
split is working, coverage is real, and the pure/IO boundary is respected. The
recent `workout-edits` / `finish-workout` / `session-pr` extractions are the
pattern the component layer should follow. Every finding above is in
`components/`, `app/`, or the seam to Supabase.
