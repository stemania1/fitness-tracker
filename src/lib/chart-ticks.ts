/**
 * Regular clock-aligned tick marks for time-of-day chart axes.
 *
 * Recharts' automatic tick placement picks ticks from the data points
 * themselves, which for irregular samples (e.g. Oura heart-rate readings)
 * produces odd labels like 12:01, 1:29, 2:54. These helpers generate
 * evenly spaced ticks that land on local clock-hour boundaries instead.
 */

const HOUR_MS = 3_600_000

/** Candidate spacings between ticks, in hours. */
const STEP_HOURS = [1, 2, 3, 4, 6, 12]

/**
 * Evenly spaced tick timestamps (ms) on local clock-hour boundaries
 * covering [minMs, maxMs]. The step is the smallest of 1/2/3/4/6/12 hours
 * that keeps the tick count near `maxTicks`, and every tick lands on a local
 * hour that is a multiple of the step (so a 2-hour step gives 12 AM,
 * 2 AM, 4 AM, ... rather than 1 AM, 3 AM, 5 AM).
 *
 * Returns [] when the range is empty, inverted, or not finite.
 */
export function hourlyTicks(
  minMs: number,
  maxMs: number,
  maxTicks = 6
): number[] {
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) {
    return []
  }

  const spanHours = (maxMs - minMs) / HOUR_MS
  const step =
    STEP_HOURS.find((s) => spanHours / s <= maxTicks) ??
    STEP_HOURS[STEP_HOURS.length - 1]

  // First tick: round minMs up to the next local hour boundary, then
  // advance to an hour that is a multiple of the step.
  const first = new Date(minMs)
  first.setMinutes(0, 0, 0)
  let t = first.getTime()
  if (t < minMs) t += HOUR_MS
  while (new Date(t).getHours() % step !== 0 && t <= maxMs) t += HOUR_MS

  const ticks: number[] = []
  for (; t <= maxMs; t += step * HOUR_MS) ticks.push(t)
  return ticks
}

/**
 * Label for an hour-aligned tick, e.g. "1 AM". Falls back to "1:30 AM"
 * form if the timestamp is not on an hour boundary.
 */
export function formatHourTick(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    ...(d.getMinutes() !== 0 ? { minute: "2-digit" } : {}),
    hour12: true,
  })
}
