/**
 * Generate an iCalendar (.ics) file for the 12-week training plan, so the user
 * can add the recurring sessions to their phone's native calendar and get
 * reliable alerts — no web-push infrastructure required. Pure and testable;
 * the download glue lives in the AddToCalendarButton component.
 */

import {
  WEEKLY_SCHEDULE,
  PLAN_START_DATE,
  PLAN_WEEKS,
} from "@/data/training-plan"

/** Parse "5:45 AM" → { h: 5, m: 45 } (24-hour). Null if unparseable. */
function parseTime(t: string): { h: number; m: number } | null {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const mer = m[3].toUpperCase()
  if (mer === "PM" && h !== 12) h += 12
  if (mer === "AM" && h === 12) h = 0
  return { h, m: min }
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Floating local time YYYYMMDDTHHMMSS — displays at that wall-clock time in
 *  whatever timezone the user's calendar is in (right for fixed workout times). */
function fmtLocal(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  )
}

/** RFC 5545 text escaping for SUMMARY/DESCRIPTION values. */
function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

export interface TrainingIcsOptions {
  /** Plan start (Monday of week 1), YYYY-MM-DD. Defaults to PLAN_START_DATE. */
  startDate?: string
  /** Number of weekly repeats. Defaults to PLAN_WEEKS. */
  weeks?: number
  /** DTSTAMP value (UTC, ...Z). Defaults to a fixed stamp for determinism. */
  stamp?: string
}

/**
 * Build a VCALENDAR string with one weekly-recurring VEVENT per training day
 * (rest days excluded), each with a 30-minute-before alarm.
 */
export function buildTrainingIcs(opts: TrainingIcsOptions = {}): string {
  const startDate = opts.startDate ?? PLAN_START_DATE
  const weeks = opts.weeks ?? PLAN_WEEKS
  const stamp = opts.stamp ?? "20260101T000000Z"

  const [y, mo, d] = startDate.split("-").map(Number)
  const startBase = new Date(y, mo - 1, d) // local midnight of week 1 Monday

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fitness Tracker//Training Plan//EN",
    "CALSCALE:GREGORIAN",
  ]

  for (const [dowStr, session] of Object.entries(WEEKLY_SCHEDULE)) {
    const dow = Number(dowStr)
    if (session.type === "rest") continue
    const time = parseTime(session.time)
    if (!time) continue

    // First occurrence of this weekday on or after the plan start.
    const first = new Date(startBase)
    const diff = (dow - startBase.getDay() + 7) % 7
    first.setDate(startBase.getDate() + diff)
    first.setHours(time.h, time.m, 0, 0)
    const end = new Date(first.getTime() + session.durationMins * 60000)

    lines.push(
      "BEGIN:VEVENT",
      `UID:pf-training-${dow}@fitness-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmtLocal(first)}`,
      `DTEND:${fmtLocal(end)}`,
      `RRULE:FREQ=WEEKLY;COUNT=${weeks}`,
      `SUMMARY:${icsEscape(session.title)}`,
      `DESCRIPTION:${icsEscape(session.details.join(" • "))}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Workout reminder",
      "TRIGGER:-PT30M",
      "END:VALARM",
      "END:VEVENT"
    )
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n")
}
