/**
 * Learn a personal caffeine half-life and sensitivity from the check-in
 * history, instead of assuming the ~5.5h population average.
 *
 * Approach: grid-search candidate half-lives. For each candidate, compute the
 * caffeine on board at every energy check-in and correlate it with the felt
 * energy (1–5). The candidate that best explains the check-ins wins; the
 * regression slope at that half-life is the sensitivity.
 *
 * The obvious trap is circadian confounding — mornings pair high caffeine
 * with naturally high energy, evenings pair low with low, so a naive
 * correlation "discovers" caffeine works no matter what. Correlations are
 * therefore computed WITHIN time-of-day bands (morning / afternoon /
 * evening) and averaged, so a candidate only scores well if caffeine
 * separates energy among check-ins at a comparable hour.
 *
 * Honest fallback: without enough data, or without contrast (always
 * caffeinated at check-in, or never), the population value is returned and
 * said so. Guidance, not diagnosis.
 */

import { CAFFEINE_HALF_LIFE_MIN } from "./caffeine"

/** One energy check-in with the caffeine doses that preceded it. */
export interface CaffeineCheckin {
  /** Felt energy 1–5. */
  level: number
  /** Local hour 0–23 of the check-in, for the time-of-day banding. */
  hour: number
  /** Doses taken before the check-in: mg and minutes before it. */
  doses: Array<{ mg: number; minutesAgo: number }>
}

export interface PersonalCaffeineModel {
  /** Best-fitting elimination half-life in minutes. Population value when
   *  `personalized` is false. */
  halfLifeMin: number
  personalized: boolean
  /** Energy points (on the 1–5 scale) per 100 mg on board, at the chosen
   *  half-life. Null when not personalized. */
  energyPer100mg: number | null
  sensitivity: "low" | "typical" | "high" | null
  /** Check-ins that informed (or failed to inform) the fit. */
  observations: number
  /** Why the model fell back, when it did. */
  reason?: "not_enough_data" | "no_contrast" | "no_signal"
}

/** Candidate half-lives, minutes (3h … 9h). The population value is one of
 *  them so "typical" is always reachable. */
export const HALF_LIFE_CANDIDATES_MIN = [180, 240, 300, 330, 390, 450, 540]

/** Minimum check-ins before attempting a fit at all. */
export const MIN_CHECKINS = 12
/** Minimum check-ins per time-of-day band for that band to count. */
const MIN_BAND = 6
/** Minimum average within-band correlation to trust the fit. */
const MIN_CORRELATION = 0.2
/** Contrast guard: need some check-ins clearly caffeinated and some clearly
 *  not, at the population half-life, or there is nothing to compare. */
const CONTRAST_HIGH_MG = 50
const CONTRAST_LOW_MG = 25
const MIN_CONTRAST_EACH = 4

/** Sensitivity classification bounds, energy points per 100 mg. */
const HIGH_SENSITIVITY_PER_100MG = 0.45
const LOW_SENSITIVITY_PER_100MG = 0.15

function onBoardAt(doses: CaffeineCheckin["doses"], halfLifeMin: number): number {
  return doses.reduce((sum, d) => {
    if (d.minutesAgo < 0) return sum
    return sum + d.mg * Math.pow(0.5, d.minutesAgo / halfLifeMin)
  }, 0)
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

/** Least-squares slope of y on x. */
function slope(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  if (sxx === 0) return null
  return sxy / sxx
}

type Band = "morning" | "afternoon" | "evening"

function bandOf(hour: number): Band {
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}

/** Average within-band correlation for one candidate half-life, weighted by
 *  band size; null when no band is usable. */
function scoreCandidate(
  checkins: CaffeineCheckin[],
  halfLifeMin: number
): number | null {
  const bands = new Map<Band, CaffeineCheckin[]>()
  for (const c of checkins) {
    const b = bandOf(c.hour)
    bands.set(b, [...(bands.get(b) ?? []), c])
  }

  let weighted = 0
  let weight = 0
  for (const group of bands.values()) {
    if (group.length < MIN_BAND) continue
    const xs = group.map((c) => onBoardAt(c.doses, halfLifeMin))
    const ys = group.map((c) => c.level)
    const r = pearson(xs, ys)
    if (r === null) continue
    weighted += r * group.length
    weight += group.length
  }
  return weight > 0 ? weighted / weight : null
}

const fallback = (
  observations: number,
  reason: PersonalCaffeineModel["reason"]
): PersonalCaffeineModel => ({
  halfLifeMin: CAFFEINE_HALF_LIFE_MIN,
  personalized: false,
  energyPer100mg: null,
  sensitivity: null,
  observations,
  reason,
})

/**
 * Fit the personal model. Falls back to the population half-life — saying
 * why — whenever the data can't support a personal claim.
 */
export function learnCaffeineModel(
  checkins: CaffeineCheckin[]
): PersonalCaffeineModel {
  if (checkins.length < MIN_CHECKINS) {
    return fallback(checkins.length, "not_enough_data")
  }

  // Contrast guard, judged at the population half-life: some check-ins must
  // be clearly caffeinated and some clearly not.
  const referenceLoads = checkins.map((c) =>
    onBoardAt(c.doses, CAFFEINE_HALF_LIFE_MIN)
  )
  const high = referenceLoads.filter((x) => x >= CONTRAST_HIGH_MG).length
  const low = referenceLoads.filter((x) => x <= CONTRAST_LOW_MG).length
  if (high < MIN_CONTRAST_EACH || low < MIN_CONTRAST_EACH) {
    return fallback(checkins.length, "no_contrast")
  }

  let bestHalfLife: number | null = null
  let bestScore = -Infinity
  for (const candidate of HALF_LIFE_CANDIDATES_MIN) {
    const score = scoreCandidate(checkins, candidate)
    if (score !== null && score > bestScore) {
      bestScore = score
      bestHalfLife = candidate
    }
  }

  // A weak best correlation means caffeine isn't separating this user's
  // energy — claiming a personal half-life from it would be noise.
  if (bestHalfLife === null || bestScore < MIN_CORRELATION) {
    return fallback(checkins.length, "no_signal")
  }

  const xs = checkins.map((c) => onBoardAt(c.doses, bestHalfLife!))
  const ys = checkins.map((c) => c.level)
  const perMg = slope(xs, ys)
  const energyPer100mg =
    perMg === null ? null : Math.round(perMg * 100 * 100) / 100

  let sensitivity: PersonalCaffeineModel["sensitivity"] = null
  if (energyPer100mg !== null) {
    sensitivity =
      energyPer100mg >= HIGH_SENSITIVITY_PER_100MG
        ? "high"
        : energyPer100mg <= LOW_SENSITIVITY_PER_100MG
          ? "low"
          : "typical"
  }

  return {
    halfLifeMin: bestHalfLife,
    personalized: true,
    energyPer100mg,
    sensitivity,
    observations: checkins.length,
  }
}

// ── Assembling observations from raw rows ────────────────────────

export interface CheckinRow {
  level: number
  logged_on: string // YYYY-MM-DD
  logged_hour: number
}

export interface CaffeineLogRow {
  mg: number
  logged_at: string // ISO timestamp
}

/** Doses further back than this can't meaningfully act on a check-in. */
const DOSE_WINDOW_MIN = 18 * 60

/**
 * Pair each check-in with the caffeine doses of the preceding 18 hours,
 * expressed as minutes-before-the-check-in. Check-in time is taken as the
 * top of its logged hour on its local day.
 */
export function buildCaffeineCheckins(
  checkinRows: CheckinRow[],
  caffeineRows: CaffeineLogRow[]
): CaffeineCheckin[] {
  const doses = caffeineRows
    .map((r) => ({ mg: r.mg, at: new Date(r.logged_at).getTime() }))
    .filter((d) => Number.isFinite(d.at) && d.mg > 0)

  return checkinRows.map((c) => {
    const at = new Date(
      `${c.logged_on}T${String(c.logged_hour).padStart(2, "0")}:00:00`
    ).getTime()
    return {
      level: c.level,
      hour: c.logged_hour,
      doses: doses
        .map((d) => ({ mg: d.mg, minutesAgo: Math.round((at - d.at) / 60000) }))
        .filter((d) => d.minutesAgo >= 0 && d.minutesAgo <= DOSE_WINDOW_MIN),
    }
  })
}

// ── Display ──────────────────────────────────────────────────────

/** "5.5h"-style label for a half-life in minutes. */
export function formatHalfLife(halfLifeMin: number): string {
  const hours = halfLifeMin / 60
  const rounded = Math.round(hours * 10) / 10
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded}h`
}

/**
 * One sentence for the caffeine card when the model is personalized; null
 * otherwise (the population default needs no announcement).
 */
export function describeCaffeineModel(
  model: PersonalCaffeineModel
): string | null {
  if (!model.personalized) return null

  const speed =
    model.halfLifeMin <= 270
      ? "faster than typical"
      : model.halfLifeMin >= 420
        ? "slower than typical"
        : "about typical"

  const base = `Your ${model.observations} energy check-ins suggest caffeine clears ${speed} for you (~${formatHalfLife(model.halfLifeMin)} half-life vs ~5.5h average)`

  const tail =
    model.sensitivity === "high"
      ? " — and it moves your energy more than most, so timing matters."
      : model.sensitivity === "low"
        ? " — with a smaller-than-typical kick per dose."
        : "."

  return base + tail
}
