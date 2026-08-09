/**
 * What the alcohol you logged is still doing to tonight.
 *
 * Deliberately NOT a blood-alcohol estimate. A Widmark BAC number would be
 * the obvious thing to build and the wrong thing to show: it swings with
 * food, sex, and individual metabolism, and the moment it appears on screen
 * someone will use it to decide whether to drive. What this app can say
 * honestly — and can later check against ring data — is when the alcohol
 * will have cleared, and whether the last drink lands close enough to bed to
 * cost REM sleep.
 *
 * The clearance model differs from caffeine's on purpose. Caffeine decays
 * exponentially (a half-life); alcohol is cleared at a roughly CONSTANT rate,
 * so twice as much takes twice as long, not one extra half-life. Reusing the
 * caffeine curve here would be wrong in a way that still looks plausible.
 *
 * Guidance, not diagnosis, and never a fitness-to-drive signal.
 */

import { STANDARD_DRINK_G } from "./alcohol-drinks"
import { formatClockTimeShort, subtractMinutes, type ClockTime } from "./bedtime"

/**
 * Grams of ethanol a typical adult liver clears per hour. Commonly cited as
 * roughly one standard drink per 1.5 hours; slower in practice for many
 * people, which is the direction we want to be wrong in for a sleep warning.
 */
export const ALCOHOL_CLEARANCE_G_PER_HOUR = 10

/**
 * How long before bed the last drink stops mattering much for sleep quality.
 *
 * Alcohol shortens sleep latency and then fragments the back half of the
 * night, suppressing REM — the effect people misread as "it helps me sleep".
 * Three hours is the usual guidance for letting a moderate dose clear first.
 */
export const ALCOHOL_CUTOFF_BEFORE_BED_MIN = 180

/** One logged drink, relative to "now". */
export interface AlcoholDose {
  /** Grams of ethanol. */
  grams: number
  /** Minutes before now it was drunk (>= 0; future doses are ignored). */
  minutesAgo: number
  /** Local hour it was drunk, 0-23 (for the pre-bed check). */
  hour: number
  /** Minute within `hour`, reading as :00 when absent. */
  minute?: number
}

/**
 * Grams of ethanol still on board.
 *
 * Simulated forward through the doses rather than solved in closed form: with
 * constant-rate clearance the liver can only work on what's actually there,
 * so a drink at 6pm and another at 10pm clear differently than the same total
 * drunk at once. Floored at zero between doses, which is where a closed-form
 * "total minus rate × time" would quietly go negative and under-count the
 * later drink.
 */
export function alcoholOnBoardG(doses: AlcoholDose[]): number {
  const usable = doses
    .filter((d) => d.minutesAgo >= 0 && d.grams > 0)
    // Oldest first, so each gap is cleared before the next drink lands.
    .sort((a, b) => b.minutesAgo - a.minutesAgo)
  if (usable.length === 0) return 0

  let onBoard = 0
  let previousMinutesAgo = usable[0].minutesAgo

  for (const dose of usable) {
    const elapsedMin = previousMinutesAgo - dose.minutesAgo
    onBoard = Math.max(0, onBoard - clearedIn(elapsedMin))
    onBoard += dose.grams
    previousMinutesAgo = dose.minutesAgo
  }

  // And from the most recent drink up to now.
  return Math.max(0, onBoard - clearedIn(previousMinutesAgo))
}

function clearedIn(minutes: number): number {
  return (Math.max(0, minutes) / 60) * ALCOHOL_CLEARANCE_G_PER_HOUR
}

/** Minutes until the given load has cleared, rounded up to the minute. */
export function minutesToClear(gramsOnBoard: number): number {
  if (gramsOnBoard <= 0) return 0
  return Math.ceil((gramsOnBoard / ALCOHOL_CLEARANCE_G_PER_HOUR) * 60)
}

export type AlcoholLevel = "none" | "clearing"

export interface AlcoholStatus {
  level: AlcoholLevel
  /** Grams still on board, to one decimal. */
  gramsOnBoard: number
  /** Standard drinks still on board, to one decimal. */
  drinksOnBoard: number
  /** Minutes until clear (0 when nothing is on board). */
  minutesToClear: number
  /** A sentence for the card, or null when there's nothing to say. */
  message: string | null
}

/** Where the day's drinking currently stands. */
export function alcoholStatus(doses: AlcoholDose[]): AlcoholStatus {
  const grams = round1(alcoholOnBoardG(doses))
  if (grams <= 0) {
    return {
      level: "none",
      gramsOnBoard: 0,
      drinksOnBoard: 0,
      minutesToClear: 0,
      message: null,
    }
  }

  const mins = minutesToClear(grams)
  return {
    level: "clearing",
    gramsOnBoard: grams,
    drinksOnBoard: round1(grams / STANDARD_DRINK_G),
    minutesToClear: mins,
    message: `About ${formatDrinks(grams)} still clearing — roughly ${formatDuration(mins)} to go.`,
  }
}

export interface LateAlcoholFlag {
  late: boolean
  message: string | null
}

/**
 * Whether a drink lands close enough to bed to cost sleep quality.
 *
 * Mirrors the late-caffeine check, but the mechanism is the opposite way
 * round and worth saying out loud: caffeine keeps you from falling asleep,
 * alcohol helps you fall asleep and then takes the back half of the night
 * apart. People stop believing the first and never start believing the second.
 */
export function lateAlcoholFlag(
  doses: AlcoholDose[],
  bedtime: ClockTime | null | undefined
): LateAlcoholFlag {
  if (!bedtime) return { late: false, message: null }
  const cutoff = subtractMinutes(bedtime, ALCOHOL_CUTOFF_BEFORE_BED_MIN)

  const cutoffMinutes = cutoff.hour * 60 + cutoff.minute
  const latest = doses
    .filter((d) => d.minutesAgo >= 0 && d.grams > 0)
    .map((d) => d.hour * 60 + (d.minute ?? 0))
    // Evening drinking sits in the same clock-day as the cutoff; a drink
    // before noon is yesterday's problem as far as tonight is concerned.
    .filter((m) => m >= cutoffMinutes)
    .sort((a, b) => b - a)[0]

  if (latest == null) return { late: false, message: null }

  return {
    late: true,
    message:
      `A drink after ${formatClockTimeShort(cutoff)} tends to fragment the back half of the night — ` +
      "you may fall asleep faster and still wake up short on REM.",
  }
}

function formatDrinks(grams: number): string {
  const drinks = grams / STANDARD_DRINK_G
  if (drinks < 0.95) return "half a drink"
  const rounded = round1(drinks)
  return `${rounded} ${rounded === 1 ? "drink" : "drinks"}`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const h = `${hours} hr`
  return rest === 0 ? h : `${h} ${rest} min`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
