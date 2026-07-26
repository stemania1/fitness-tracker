/**
 * Helpers for editing a logged meal's time in place. A meal's `logged_at` is
 * a full ISO timestamp; the Nutrition card lets you correct just the
 * time-of-day (the date stays put, so the meal stays on the day you logged
 * it). Local-time based — the user edits the clock time they see.
 */

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

/** The local "HH:mm" of an ISO timestamp, for seeding a <input type="time">. */
export function localTimeValue(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Return a new ISO timestamp with the local time-of-day replaced by `hhmm`
 * ("HH:mm"), keeping the original local date. Returns the input unchanged if
 * the time string is malformed.
 */
export function withLocalTime(iso: string, hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return iso
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (hours > 23 || minutes > 59) return iso
  const d = new Date(iso)
  d.setHours(hours, minutes, 0, 0)
  return d.toISOString()
}
