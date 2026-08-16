/**
 * Daily movement: steps and intraday activity, read as "how is the day
 * going" rather than "how did the day end".
 *
 * Two different questions live here, and they are answered from two
 * different pieces of Oura data:
 *
 *  - **Steps** come from the `daily_activity` document as a single running
 *    total for the day. Oura does not publish a per-hour step series, so
 *    nothing in this file breaks the total down by hour — pacing is derived
 *    from the total plus the clock, never from invented hourly steps.
 *  - **Intraday intensity** comes from `class_5_min`, a string with one digit
 *    per five-minute block of the activity day. That is real intraday data,
 *    so the hourly chart is built from it — but it measures *minutes at an
 *    intensity*, not steps.
 *
 * Everything is pure: the caller passes the current local hour/minute, so
 * "now" never leaks in here and the whole module is testable.
 */

/** Oura's five-minute activity classes, in `class_5_min` digit order. */
export type MovementLevel =
  | "nonwear"
  | "rest"
  | "inactive"
  | "low"
  | "medium"
  | "high"

const CLASS_LEVELS: Record<string, MovementLevel> = {
  "0": "nonwear",
  "1": "rest",
  "2": "inactive",
  "3": "low",
  "4": "medium",
  "5": "high",
}

/** Minutes covered by one `class_5_min` sample. */
export const SAMPLE_MINUTES = 5

/**
 * Default daily step target.
 *
 * 10,000 is a marketing number from a 1960s Japanese pedometer, not a
 * finding; the observed benefit curve rises steeply to roughly 7-8k and
 * flattens well before 10k. 8,000 is a target a member can actually hit on a
 * working day, which matters more than the round number — and it is
 * per-user editable anyway.
 */
export const DEFAULT_STEP_GOAL = 8000

/**
 * Default daily moderate-or-higher activity target, in minutes.
 *
 * The guideline everyone's is derived from is 150 minutes of moderate
 * activity a week, which is ~22/day — but it's near-universally restated as
 * "30 minutes a day", and a round, recognizable number is one people
 * actually aim at. 30 also leaves room for the rest days that 150/week
 * assumes.
 *
 * Counts Oura's *medium and high* activity only. Low activity — pottering,
 * standing, a slow amble to the kitchen — is movement worth charting but it
 * is not what the guideline means, and folding it in would let a sedentary
 * day clear a health target.
 */
export const DEFAULT_ACTIVE_MINUTES_GOAL = 30

/**
 * MET cut-points, from the standard physical-activity definitions: below 1.5
 * is sedentary, 1.5-3 light, 3-6 moderate, 6+ vigorous. "Moderate or higher"
 * — the thing the activity goal counts — is everything from 3 up.
 */
export const MET_LIGHT = 1.5
export const MET_MODERATE = 3
export const MET_VIGOROUS = 6

/**
 * One hour of the activity day, in minutes at each intensity.
 *
 * The three bands are light / moderate / vigorous. They come from per-minute
 * MET where Oura provides it and from `class_5_min`'s low/medium/high classes
 * otherwise — the two sources disagree at the margins, but they mean the same
 * three things, so the card renders either without knowing which it got.
 */
export interface HourlyMovement {
  /** Local hour, 0-23. */
  hour: number
  lowMinutes: number
  mediumMinutes: number
  highMinutes: number
  /** light + moderate + vigorous — "moving", not the goal metric. */
  activeMinutes: number
  /** Worn, but sedentary. */
  idleMinutes: number
}

/** Local clock minutes-since-midnight from an Oura timestamp. */
function localMinuteOfDay(timestamp: string): number | null {
  // Oura stamps its own offset onto the timestamp ("...T04:00:00-07:00"), so
  // the wall-clock time is already in the string. Parsing it with `Date`
  // would re-project it into the *runtime's* zone, which on a server is UTC
  // — the samples would land on the wrong hours. Read the clock fields
  // directly instead.
  const m = /T(\d{2}):(\d{2})/.exec(timestamp)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

/**
 * Bucket a `class_5_min` string into per-hour minutes at each intensity.
 *
 * Returns a contiguous run of hours from the first sample to the last, so a
 * chart drawn from it has no gaps in the middle and no empty hours tacked
 * onto the end — the series stops where the ring's data stops.
 *
 * Returns `[]` without a timestamp: the digits are meaningless unless we know
 * which minute the first one starts at, and guessing midnight would silently
 * shift the whole day (Oura's activity day usually starts at 04:00).
 */
export function parseMovementClasses(
  classes: string | null | undefined,
  timestamp: string | null | undefined
): HourlyMovement[] {
  if (!classes || !timestamp) return []
  const start = localMinuteOfDay(timestamp)
  if (start == null) return []

  const byHour = new Map<number, HourlyMovement>()

  for (let i = 0; i < classes.length; i++) {
    const level = CLASS_LEVELS[classes[i]]
    if (!level) continue
    const minuteOfDay = start + i * SAMPLE_MINUTES
    // The activity day can run past midnight into the next calendar day.
    // Those samples belong to tomorrow's chart, not this one.
    if (minuteOfDay >= 24 * 60) break
    const hour = Math.floor(minuteOfDay / 60)
    let bucket = byHour.get(hour)
    if (!bucket) {
      bucket = emptyHour(hour)
      byHour.set(hour, bucket)
    }

    // Oura's low/medium/high map onto light/moderate/vigorous.
    if (level === "low") bucket.lowMinutes += SAMPLE_MINUTES
    else if (level === "medium") bucket.mediumMinutes += SAMPLE_MINUTES
    else if (level === "high") bucket.highMinutes += SAMPLE_MINUTES
    else if (level === "rest" || level === "inactive") {
      bucket.idleMinutes += SAMPLE_MINUTES
    }
    // "nonwear" counts toward neither — the ring was off, so we know nothing.
  }

  return seriesFrom(byHour)
}

/** Per-minute MET samples, as Oura's `daily_activity.met` sub-document. */
export interface MetSamples {
  interval: number
  items: (number | null)[]
  timestamp: string
}

/** An empty hour bucket. */
function emptyHour(hour: number): HourlyMovement {
  return {
    hour,
    lowMinutes: 0,
    mediumMinutes: 0,
    highMinutes: 0,
    activeMinutes: 0,
    idleMinutes: 0,
  }
}

/** Fill `activeMinutes` and emit a contiguous, hour-sorted series. */
function seriesFrom(byHour: Map<number, HourlyMovement>): HourlyMovement[] {
  if (byHour.size === 0) return []
  const hours = [...byHour.keys()]
  const out: HourlyMovement[] = []
  for (let h = Math.min(...hours); h <= Math.max(...hours); h++) {
    const bucket = byHour.get(h) ?? emptyHour(h)
    bucket.activeMinutes =
      bucket.lowMinutes + bucket.mediumMinutes + bucket.highMinutes
    out.push(bucket)
  }
  return out
}

/**
 * Bucket per-minute MET samples into per-hour minutes at each intensity.
 *
 * The finer of the two sources: a continuous MET value each minute, cut at
 * the standard thresholds, rather than Oura's pre-binned five-minute classes.
 * Null items are non-wear and count toward nothing — the ring was off, so we
 * know neither that you moved nor that you sat.
 *
 * Returns `[]` for anything unusable (no samples, no timestamp, a
 * non-positive interval), which is the caller's signal to fall back to
 * `parseMovementClasses`.
 */
export function parseMetSamples(
  met: MetSamples | null | undefined
): HourlyMovement[] {
  if (!met || !met.items?.length || !met.timestamp) return []
  if (!(met.interval > 0)) return []
  const start = localMinuteOfDay(met.timestamp)
  if (start == null) return []

  const minutesPerSample = met.interval / 60
  const byHour = new Map<number, HourlyMovement>()

  for (let i = 0; i < met.items.length; i++) {
    const value = met.items[i]
    // Non-wear, or a malformed entry. Either way it asserts nothing.
    if (value == null || !Number.isFinite(value)) continue

    const minuteOfDay = start + i * minutesPerSample
    if (minuteOfDay >= 24 * 60) break
    const hour = Math.floor(minuteOfDay / 60)
    let bucket = byHour.get(hour)
    if (!bucket) {
      bucket = emptyHour(hour)
      byHour.set(hour, bucket)
    }

    if (value >= MET_VIGOROUS) bucket.highMinutes += minutesPerSample
    else if (value >= MET_MODERATE) bucket.mediumMinutes += minutesPerSample
    else if (value >= MET_LIGHT) bucket.lowMinutes += minutesPerSample
    else bucket.idleMinutes += minutesPerSample
  }

  return seriesFrom(byHour)
}

/**
 * The day's hourly movement, from the best source available.
 *
 * Per-minute MET when Oura sends it, five-minute classes when it doesn't.
 * The fallback matters: `met` is absent on days the ring didn't sync fully,
 * and losing the whole chart for a coarser-but-present signal would be a
 * poor trade.
 */
export function movementHours(
  activity: {
    met?: MetSamples | null
    class_5_min?: string | null
    timestamp?: string | null
  } | null
): HourlyMovement[] {
  if (!activity) return []
  const fromMet = parseMetSamples(activity.met)
  if (fromMet.length > 0) return fromMet
  return parseMovementClasses(activity.class_5_min, activity.timestamp)
}

/** Total minutes at any intensity across the day so far — "moving". */
export function totalActiveMinutes(hours: HourlyMovement[]): number {
  return hours.reduce((sum, h) => sum + h.activeMinutes, 0)
}

/**
 * Moderate-or-higher minutes — the goal metric — placed on the clock.
 *
 * The top two bands of the same series the chart draws, so the goal figure
 * and the picture above it can never disagree.
 */
export function moderatePlusMinutes(hours: HourlyMovement[]): number {
  return hours.reduce((sum, h) => sum + h.mediumMinutes + h.highMinutes, 0)
}

/**
 * Minutes of unbroken sitting at the end of the day's samples — the "you've
 * been at that desk a while" read.
 *
 * A non-wear sample ends the run rather than extending it: the ring off the
 * finger says nothing about whether you moved, and counting it as sitting
 * would nag hardest on exactly the stretches we know least about.
 */
export function trailingIdleMinutes(
  classes: string | null | undefined
): number {
  if (!classes) return 0
  let minutes = 0
  for (let i = classes.length - 1; i >= 0; i--) {
    const level = CLASS_LEVELS[classes[i]]
    if (level === "rest" || level === "inactive") minutes += SAMPLE_MINUTES
    else break
  }
  return minutes
}

/**
 * The same trailing-sitting run, measured from per-minute MET.
 *
 * Sustained sub-1.5 MET is a cleaner sedentary signal than the class digits:
 * Oura bins a fidget and a nap into the same "inactive", where MET separates
 * them. As with the class version, an unusable sample ends the run rather
 * than extending it.
 */
export function trailingIdleFromMet(
  met: MetSamples | null | undefined
): number {
  if (!met || !met.items?.length || !(met.interval > 0)) return 0
  const minutesPerSample = met.interval / 60
  let minutes = 0
  for (let i = met.items.length - 1; i >= 0; i--) {
    const value = met.items[i]
    if (value == null || !Number.isFinite(value)) break
    if (value >= MET_LIGHT) break
    minutes += minutesPerSample
  }
  return Math.round(minutes)
}

/**
 * Trailing sitting run, from the best source available, bounded to the
 * waking day.
 *
 * The bound is the whole point. Oura's activity day starts around 04:00, and
 * neither source can tell sleeping from sitting still: class `1` is "rest",
 * and sleeping MET sits below the 1.5 cut-point just as motionless sitting
 * does. Unbounded, the trailing run walks straight back into the night, so
 * opening the app at 07:00 after an ordinary eight hours produced
 * "Sitting 3h — time to move" — a nudge to get up, delivered to someone who
 * had just got up.
 *
 * Capping at minutes elapsed since the moving day began fixes it without
 * needing to know when the user actually woke: before 07:00 nothing can
 * accumulate, at 08:00 at most an hour can, and a genuine two-hour sit at
 * 15:00 is unaffected.
 */
export function sittingMinutes(
  activity: { met?: MetSamples | null; class_5_min?: string | null } | null,
  hour: number,
  minute = 0
): number {
  if (!activity) return 0

  const run = parseMetSamples(activity.met).length > 0
    ? trailingIdleFromMet(activity.met)
    : trailingIdleMinutes(activity.class_5_min)

  const sinceMovingDayStart = hour * 60 + minute - ACTIVE_DAY_START_HOUR * 60
  if (sinceMovingDayStart <= 0) return 0
  return Math.min(run, sinceMovingDayStart)
}

/** Where a day's running total sits against its goal and against the clock. */
export type PaceStatus = "goal-met" | "ahead" | "on-track" | "behind"

export interface DailyPace {
  /** The running total so far today — steps, or moderate+ minutes. */
  value: number
  goal: number
  /** Still to go; 0 once the goal is met. */
  remaining: number
  /** Progress toward the goal, 0-100 (capped, for a progress bar). */
  percent: number
  /** What you'd have by now to be exactly on schedule. */
  expected: number
  /** `value - expected`. Negative means behind. */
  delta: number
  status: PaceStatus
  /** End-of-day total if the current rate holds; null before the day starts. */
  projected: number | null
}

/**
 * The stretch of the clock across which steps actually accumulate.
 *
 * Spreading a step goal evenly over 24 hours would call you "behind" at 6am
 * for not having walked in your sleep, and "ahead" all evening for having
 * been awake. The window below is the ordinary waking, moving day.
 */
export const ACTIVE_DAY_START_HOUR = 7
export const ACTIVE_DAY_END_HOUR = 22

/** How much of the moving day has elapsed, 0-1. */
export function activeDayFraction(hour: number, minute = 0): number {
  const now = hour * 60 + minute
  const start = ACTIVE_DAY_START_HOUR * 60
  const end = ACTIVE_DAY_END_HOUR * 60
  if (now <= start) return 0
  if (now >= end) return 1
  return (now - start) / (end - start)
}

/** A step total is this far off schedule before we call it ahead or behind. */
const PACE_TOLERANCE = 0.1

/**
 * Pace a running daily total against a goal and the time of day. Shared by
 * steps and moderate+ minutes — the two differ in their units and their
 * wording, not in how "am I on track" is decided.
 */
export function dailyPace(
  value: number,
  goal: number,
  hour: number,
  minute: number,
  fallbackGoal: number
): DailyPace {
  const safeGoal = goal > 0 ? goal : fallbackGoal
  const fraction = activeDayFraction(hour, minute)
  const expected = Math.round(safeGoal * fraction)
  const delta = value - expected
  const percent = Math.min(100, Math.round((value / safeGoal) * 100))

  let status: PaceStatus
  if (value >= safeGoal) status = "goal-met"
  // Before the moving day starts, every total is "ahead" of an expectation of
  // zero. Saying so at 6am is noise, not information.
  else if (fraction === 0) status = "on-track"
  else if (delta >= safeGoal * PACE_TOLERANCE) status = "ahead"
  else if (delta <= -safeGoal * PACE_TOLERANCE) status = "behind"
  else status = "on-track"

  return {
    value,
    goal: safeGoal,
    remaining: Math.max(0, safeGoal - value),
    percent,
    expected,
    delta,
    status,
    projected: fraction > 0 ? Math.round(value / fraction) : null,
  }
}

/** Today's step total against the step goal. */
export function stepPace(
  steps: number,
  goal: number,
  hour: number,
  minute = 0
): DailyPace {
  return dailyPace(steps, goal, hour, minute, DEFAULT_STEP_GOAL)
}

/**
 * Today's moderate-or-higher minutes against the activity goal.
 *
 * Paced on the same waking-day curve as steps. Minutes arrive lumpier than
 * steps — a single class can clear the whole target — so "behind" here means
 * rather less than it does for steps, and only the card's quiet progress row
 * reads it, not a notification.
 */
export function activeMinutesPace(
  minutes: number,
  goal: number,
  hour: number,
  minute = 0
): DailyPace {
  return dailyPace(minutes, goal, hour, minute, DEFAULT_ACTIVE_MINUTES_GOAL)
}

/**
 * Moderate-or-higher minutes from an Oura activity document.
 *
 * Deliberately excludes light activity. Oura's "low" band is standing and
 * ambling; counting it would routinely put a desk day over a 30-minute
 * health target, which is precisely the claim the target exists to make.
 *
 * Counted from per-minute MET at the standard cut-point where available, and
 * from Oura's own medium+high totals otherwise. The two can differ by a few
 * minutes at the margins — Oura's banding is not exactly MET 3.0 — so the
 * source is chosen the same way everywhere (here, the sync, and the card)
 * rather than per caller. Mixing them would put one definition in today's
 * figure and another in the weekly average it is compared against.
 */
export function activeMinutesFrom(
  activity: {
    met?: MetSamples | null
    medium_activity_time?: number | null
    high_activity_time?: number | null
  } | null
): number {
  if (!activity) return 0

  const hours = parseMetSamples(activity.met)
  if (hours.length > 0) return Math.round(moderatePlusMinutes(hours))

  const seconds =
    (activity.medium_activity_time ?? 0) + (activity.high_activity_time ?? 0)
  return Math.round(seconds / 60)
}

/** Chip tone for a pace status — keys of `CHIP_TONES`. */
export function paceTone(
  status: PaceStatus
): "progress" | "attention" | "neutral" {
  if (status === "goal-met" || status === "ahead") return "progress"
  if (status === "behind") return "attention"
  return "neutral"
}

/** Short label for a pace status. */
export function paceLabel(status: PaceStatus): string {
  switch (status) {
    case "goal-met":
      return "Goal met"
    case "ahead":
      return "Ahead of pace"
    case "behind":
      return "Behind pace"
    default:
      return "On pace"
  }
}

/** A one-line read on the day's steps, for the card's subtitle. */
export function paceDetail(pace: DailyPace): string {
  if (pace.status === "goal-met") {
    return `${pace.value.toLocaleString()} steps — goal cleared.`
  }
  if (pace.status === "behind") {
    return `${Math.abs(pace.delta).toLocaleString()} behind schedule · ${pace.remaining.toLocaleString()} to go`
  }
  if (pace.status === "ahead") {
    return `${pace.delta.toLocaleString()} ahead of schedule · ${pace.remaining.toLocaleString()} to go`
  }
  return `${pace.remaining.toLocaleString()} steps to go`
}

/**
 * The same read for moderate+ minutes.
 *
 * Separate from `paceDetail` rather than parameterized by a unit string: the
 * two read differently on purpose. Minutes are small enough that the exact
 * shortfall is the useful number ("12 min to go"), where steps want the
 * schedule comparison, and a shared template produced stilted lines for both.
 */
export function activeMinutesDetail(pace: DailyPace): string {
  if (pace.status === "goal-met") {
    return `${pace.value} min of moderate+ activity — goal cleared.`
  }
  if (pace.value === 0) {
    return `No moderate activity logged yet · ${pace.goal} min goal`
  }
  return `${pace.remaining} min to go · ${formatMinutes(pace.value)} so far`
}

/** One stored day of history — steps or moderate+ minutes. */
export interface DailyTotal {
  day: string
  value: number | null
}

export interface DailyTrend {
  /** Mean across days that have data; null if none do. */
  average: number | null
  best: { day: string; value: number } | null
  /** Days in the window that reached the goal. */
  daysAtGoal: number
  /** Days that had data at all. */
  days: number
}

/**
 * Summarize stored daily history.
 *
 * `excludeDay` drops today, which is the point: a day measured at 2pm is a
 * partial total, and averaging it against completed days quietly drags the
 * average down every time the user looks at it before evening.
 */
export function dailyTrend(
  rows: DailyTotal[],
  goal: number,
  excludeDay?: string
): DailyTrend {
  const usable = rows.filter(
    (r) => r.day !== excludeDay && r.value != null && r.value > 0
  ) as { day: string; value: number }[]

  if (usable.length === 0) {
    return { average: null, best: null, daysAtGoal: 0, days: 0 }
  }

  const total = usable.reduce((sum, r) => sum + r.value, 0)
  const best = usable.reduce((b, r) => (r.value > b.value ? r : b))

  return {
    average: Math.round(total / usable.length),
    best: { day: best.day, value: best.value },
    daysAtGoal: usable.filter((r) => r.value >= goal).length,
    days: usable.length,
  }
}

/** Compact clock label for an hour tick: 7a, 12p, 6p. */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "a" : "p"
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${suffix}`
}

/** "2h 15m" / "45m" from a minute count. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
