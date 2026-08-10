/**
 * One-off diagnostic: why is the reminder cron saying what it's saying?
 *
 * Read-only. It reproduces exactly what `/api/cron/reminders` sees — every
 * push subscription, the profile behind it, and the signals that feed the
 * nudges — and prints the reminder body each account would receive.
 *
 * This exists because the loop that should have answered it stayed shut. The
 * cron logs a full per-user summary on every run, but Vercel's runtime logs
 * were unreachable, and the endpoint is behind CRON_SECRET so it can't be
 * called by hand either. Meanwhile a device kept receiving "It's been 8 days
 * since your last workout" while the same account's Activity list showed a
 * session from yesterday — two statements about one table that can't both be
 * true.
 *
 * The specific question it settles: does the cron read the same rows the app
 * does? It runs with the service key, so it sees across accounts — which is
 * the one thing the in-app Diagnostics card structurally cannot do, because
 * RLS scopes that to whoever is signed in.
 *
 * Why the whole context and not just workouts: a push carries up to three
 * lines, and a wrong account gets every one of them wrong at once. Checking a
 * single nudge cannot tell "this account is stale" apart from "this one table
 * is stale", and those have completely different fixes. So all five signals
 * are reproduced, and accounts are grouped rather than listed per
 * subscription — the count of DISTINCT accounts is the headline number.
 *
 * Writes nothing, ever. There is no --apply.
 *
 * Usage (Node 22+, no build step — types are stripped at runtime):
 *
 *   node --experimental-strip-types --env-file=.env.local \
 *     scripts/diagnose-reminders.ts
 *
 * .env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with --env-file=.env.local from the repo root."
  )
  process.exit(1)
}

// ── Reachability pre-flight ──────────────────────────────────────────────
//
// supabase-js reports a transport failure as a bare "TypeError: fetch
// failed" with the real reason buried in the Error's `cause`, which its
// error object does not carry. That reads as "the query went wrong" when in
// fact nothing was ever sent — a very different problem with very different
// fixes. One raw fetch here, where the cause is still attached, turns it
// into an actionable message before any query runs.
//
// The host is printed unconditionally, secret-free. Pointing at a local
// Supabase stack instead of the project the cron actually reads is the
// easiest way to get a confident, completely wrong answer out of this
// script, and seeing the host makes that mistake self-evident.
//
// All of this runs BEFORE createClient, which throws its own terse error on
// a malformed URL — and a value wrapped in stray quotes by an .env editor is
// exactly the case that needs a message saying so.

// A pasted-over scheme — https://https://<ref>.supabase.co — survives every
// check that would plausibly catch it. supabase-js only asserts the string
// STARTS WITH https://, and the URL parser reads the second scheme as the
// hostname, so `new URL()` succeeds and hands back the host `https`. The
// first sign of trouble is then a DNS failure on a name nobody typed, which
// is a long way from the actual mistake.
if (/^https?:\/\/https?:\/\//i.test(url)) {
  console.error(
    `NEXT_PUBLIC_SUPABASE_URL has the scheme twice:\n\n  ${url}\n\n` +
      `It should be a single https:// — try:\n\n  ${url.replace(/^https?:\/\//i, "")}\n`
  )
  process.exit(1)
}

let host: string
try {
  host = new URL(url).host
} catch {
  console.error(
    `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${JSON.stringify(url)}\n` +
      "It should look like https://<ref>.supabase.co — check for stray quotes\n" +
      "or a missing https:// prefix."
  )
  process.exit(1)
}

console.log(`\nreading ${host}`)
if (/^(localhost|127\.|\[?::1)/.test(host)) {
  console.log(
    "  ⚠  That is a LOCAL Supabase stack, not the project the reminder cron\n" +
      "     reads. Every account will look empty and this script will tell you\n" +
      "     nothing about the push you received."
  )
}

try {
  await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    method: "HEAD",
    headers: { apikey: key },
  })
} catch (err) {
  const cause = (err as { cause?: { code?: string } }).cause
  const code = cause?.code ?? "unknown"
  console.error(`\nCannot reach ${host} (${code}).\n`)
  const hint =
    code === "ENOTFOUND"
      ? "That hostname does not resolve. Check NEXT_PUBLIC_SUPABASE_URL for a\n" +
        "typo, and confirm the project still exists in the Supabase dashboard."
      : code === "ECONNREFUSED"
        ? "Nothing is listening there. If this is a local stack, start it with\n" +
          "`npx supabase start` — but you almost certainly want the hosted\n" +
          "project instead, since that is what the cron reads."
        : code === "CERT_HAS_EXPIRED" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
          ? "TLS verification failed. A proxy or VPN is likely intercepting the\n" +
            "connection."
          : "Most often this is a paused Supabase project (the dashboard will\n" +
            "say so and offer to restore it), or no network route to the host."
  console.error(hint + "\n")
  process.exit(1)
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Mirrored production logic ────────────────────────────────────────────
//
// This script runs under bare `node --experimental-strip-types`, which does
// not resolve the `@/` path alias, so it cannot import the real modules. The
// values below are copies and MUST be kept in step with:
//
//   src/lib/reminders.ts          — the hour gates and priorities
//   src/lib/reminder-settings.ts  — quiet hours
//   src/lib/push/due.ts           — the start-hour floor
//
// A copy that has drifted makes this script lie in the most damaging way
// possible: confidently, about the thing it was written to settle. If a gate
// below disagrees with the source file, the source file wins.

/** src/lib/reminders.ts — hour after which a missing-meal nudge makes sense. */
const AFTERNOON = 14
/** src/lib/reminders.ts — hour after which evening nudges make sense. */
const EVENING = 18
/** src/lib/reminders.ts — a workout gap of this many days is worth a nudge. */
const WORKOUT_GAP_DAYS = 3
/** src/lib/reminders.ts — weigh-in cadence. */
const WEIGH_IN_DAYS = 7
/** src/lib/push/due.ts — earliest local hour a push may go out. */
const DEFAULT_PUSH_START_HOUR = 8
/** src/lib/reminders.ts — the digest is capped at this many lines. */
const MAX_REMINDERS = 3

type ReminderType =
  | "log_workout"
  | "log_meal"
  | "energy_checkin"
  | "log_weight"
  | "log_creatine"

interface ReminderSettings {
  enabled: boolean
  types: Record<ReminderType, boolean>
  quietStartHour: number | null
  quietEndHour: number | null
}

const REMINDER_TYPES: ReminderType[] = [
  "log_workout",
  "log_meal",
  "energy_checkin",
  "log_weight",
  "log_creatine",
]

function defaultReminderSettings(): ReminderSettings {
  return {
    enabled: true,
    types: {
      log_workout: true,
      log_meal: true,
      energy_checkin: true,
      log_weight: true,
      log_creatine: true,
    },
    quietStartHour: null,
    quietEndHour: null,
  }
}

function validHour(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23
    ? v
    : null
}

/** Mirror of normalizeReminderSettings in src/lib/reminder-settings.ts. */
function normalizeReminderSettings(raw: unknown): ReminderSettings {
  const d = defaultReminderSettings()
  if (!raw || typeof raw !== "object") return d
  const r = raw as Record<string, unknown>

  const types = { ...d.types }
  if (r.types && typeof r.types === "object") {
    const rt = r.types as Record<string, unknown>
    for (const k of REMINDER_TYPES) {
      if (typeof rt[k] === "boolean") types[k] = rt[k] as boolean
    }
  }

  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : d.enabled,
    types,
    quietStartHour: validHour(r.quietStartHour),
    quietEndHour: validHour(r.quietEndHour),
  }
}

/** Mirror of isQuietHour in src/lib/reminder-settings.ts. */
function isQuietHour(
  hour: number,
  start: number | null,
  end: number | null
): boolean {
  if (start == null || end == null || start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

interface ReminderContext {
  hour: number
  mealsLoggedToday: number
  workedOutToday: boolean
  daysSinceLastWorkout: number | null
  energyCheckedInToday: boolean
  daysSinceLastWeighIn: number | null
  creatineTakenToday: boolean
}

/** Mirror of computeReminders in src/lib/reminders.ts — titles included. */
function computeReminders(
  ctx: ReminderContext,
  settings: ReminderSettings
): { type: ReminderType; priority: number; title: string }[] {
  if (!settings.enabled) return []
  if (isQuietHour(ctx.hour, settings.quietStartHour, settings.quietEndHour)) {
    return []
  }

  const out: { type: ReminderType; priority: number; title: string }[] = []

  if (
    !ctx.workedOutToday &&
    ctx.daysSinceLastWorkout != null &&
    ctx.daysSinceLastWorkout >= WORKOUT_GAP_DAYS
  ) {
    out.push({
      type: "log_workout",
      priority: 80,
      title: `It's been ${ctx.daysSinceLastWorkout} days since your last workout`,
    })
  }

  if (ctx.hour >= AFTERNOON && ctx.mealsLoggedToday === 0) {
    out.push({ type: "log_meal", priority: 65, title: "No meals logged yet today" })
  } else if (ctx.hour >= EVENING + 2 && ctx.mealsLoggedToday < 2) {
    out.push({ type: "log_meal", priority: 55, title: "Log your dinner before bed" })
  }

  if (!ctx.energyCheckedInToday && ctx.hour >= EVENING) {
    out.push({
      type: "energy_checkin",
      priority: 40,
      title: "How's your energy today?",
    })
  }

  if (!ctx.creatineTakenToday && ctx.hour >= EVENING) {
    out.push({
      type: "log_creatine",
      priority: 35,
      title: "Haven't logged creatine today",
    })
  }

  if (ctx.daysSinceLastWeighIn == null || ctx.daysSinceLastWeighIn >= WEIGH_IN_DAYS) {
    out.push({
      type: "log_weight",
      priority: 30,
      title:
        ctx.daysSinceLastWeighIn == null
          ? "Log your first weigh-in"
          : "Time for a weekly weigh-in",
    })
  }

  return out
    .filter((r) => settings.types[r.type] !== false)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_REMINDERS)
}

// ── Time helpers (mirror src/lib/push/timezone.ts) ───────────────────────

function localDateInZone(when: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(when)
  } catch {
    return null
  }
}

function localHourInZone(when: Date, timeZone: string): number | null {
  try {
    const h = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        hour12: false,
      }).format(when),
      10
    )
    return Number.isFinite(h) ? h % 24 : null
  } catch {
    return null
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
  )
}

/** Only enough of a capability URL to tell two devices apart. */
function endpointLabel(endpoint: string): string {
  let host = "unparseable"
  try {
    host = new URL(endpoint).host
  } catch {
    // keep the placeholder
  }
  return `${host} …${endpoint.slice(-8)}`
}

// ── Gather ───────────────────────────────────────────────────────────────

const now = new Date()

const { data: subs, error: subErr } = await db
  .from("push_subscriptions")
  .select("id, user_id, endpoint, created_at")
  .order("created_at", { ascending: true })

if (subErr) {
  console.error("Could not read push_subscriptions:", subErr.message)
  process.exit(1)
}

/** Subscriptions grouped by the account the cron will compute them from. */
const byUser = new Map<string, NonNullable<typeof subs>>()
for (const s of subs ?? []) {
  const list = byUser.get(s.user_id) ?? []
  list.push(s)
  byUser.set(s.user_id, list)
}

console.log("")
console.log("═".repeat(72))
console.log(
  `push_subscriptions: ${subs?.length ?? 0} row(s) across ${byUser.size} account(s)`
)
console.log("═".repeat(72))
if (byUser.size > 1) {
  console.log(
    "\n  ⚠  MORE THAN ONE ACCOUNT CARRIES A SUBSCRIPTION.\n\n" +
      "  The cron loops over rows, not over people. Each row's push is computed\n" +
      "  from ITS OWN account's data and delivered to whatever device that\n" +
      "  endpoint points at. If two rows point at the same phone, that phone\n" +
      "  gets both — and an account you no longer use has nothing logged, so\n" +
      "  every one of its nudges fires. Compare the bodies below: the account\n" +
      "  whose figures you do NOT recognise is the one to delete."
  )
}

// ── Per-account reproduction of the cron's decision ──────────────────────

for (const [userId, userSubs] of byUser) {
  console.log("")
  console.log("─".repeat(72))
  console.log(`account ${userId}`)
  console.log(`  subscriptions ${userSubs.length}`)
  for (const s of userSubs) {
    console.log(`    ${endpointLabel(s.endpoint)}   (subscribed ${s.created_at})`)
  }

  const { data: profile, error: profErr } = await db
    .from("user_profiles")
    .select("display_name, timezone, last_push_sent_on, reminder_settings")
    .eq("id", userId)
    .single()

  if (profErr || !profile) {
    console.log(
      `  profile       none (${profErr?.message ?? "no row"}) — cron skips this account`
    )
    continue
  }

  console.log(`  profile       ${profile.display_name ?? "(no name)"}`)
  console.log(
    `  timezone      ${profile.timezone ?? "MISSING — cron skips this account"}`
  )
  if (!profile.timezone) continue

  const localDate = localDateInZone(now, profile.timezone)
  const hour = localHourInZone(now, profile.timezone)
  if (localDate == null || hour == null) {
    console.log("  timezone is unusable — cron skips this account")
    continue
  }

  const settings = normalizeReminderSettings(profile.reminder_settings)
  const startHour = settings.quietEndHour ?? DEFAULT_PUSH_START_HOUR

  console.log(`  local now     ${localDate} ${String(hour).padStart(2, "0")}:xx`)
  console.log(
    `  guard         last_push_sent_on = ${profile.last_push_sent_on ?? "null"}` +
      ` → ${
        profile.last_push_sent_on === localDate
          ? "already sent today, no further push today"
          : "not yet sent today, a push may still go out"
      }`
  )
  console.log(
    `  settings      enabled=${settings.enabled}` +
      `  quiet=${settings.quietStartHour ?? "–"}→${settings.quietEndHour ?? "–"}` +
      `  earliest push hour=${startHour}`
  )
  const offTypes = REMINDER_TYPES.filter((t) => settings.types[t] === false)
  if (offTypes.length > 0) console.log(`  muted types   ${offTypes.join(", ")}`)

  // Every query below is the cron's, verbatim (src/app/api/cron/reminders).
  // A query that ERRORS is not the same as one that returns nothing: the cron
  // treats an error as "already done" and suppresses that nudge, so an error
  // here can never be the cause of a nudge firing.
  const [lastWorkout, lastWeight, energy, meals, creatine] = await Promise.all([
    db
      .from("workout_logs")
      .select("id, name, started_at, finished_at, created_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(3),
    db
      .from("weight_logs")
      .select("logged_at, weight")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(1),
    db
      .from("energy_checkins")
      .select("id, level, logged_hour, logged_on, created_at")
      .eq("user_id", userId)
      .eq("logged_on", localDate),
    db
      .from("food_logs")
      .select("logged_at")
      .eq("user_id", userId)
      .gte("logged_at", new Date(Date.now() - 48 * 3_600_000).toISOString()),
    db
      .from("creatine_logs")
      .select("id, dose_g, taken_on, created_at")
      .eq("user_id", userId)
      .eq("taken_on", localDate),
  ])

  console.log("\n  signals the cron reads")

  // Workouts — printed in full, because started_at and created_at diverging
  // is its own failure mode: a session saved a day late is invisible to every
  // cron run before the save, which looks identical to reading wrong rows.
  let daysSinceLastWorkout: number | null = null
  if (lastWorkout.error) {
    console.log(`    workouts    QUERY FAILED: ${lastWorkout.error.message} (nudge suppressed)`)
  } else if (!lastWorkout.data || lastWorkout.data.length === 0) {
    console.log("    workouts    no rows for this account")
  } else {
    console.log("    workouts    newest rows:")
    for (const w of lastWorkout.data) {
      const day = w.started_at
        ? localDateInZone(new Date(w.started_at), profile.timezone)
        : "NULL started_at"
      console.log(
        `                started ${w.started_at} (local ${day})` +
          `  finished=${w.finished_at ? "yes" : "NO"}  ${w.name ?? "(unnamed)"}`
      )
      console.log(`                  saved ${w.created_at}`)
    }
    const newest = lastWorkout.data[0].started_at
    const newestDay = newest
      ? localDateInZone(new Date(newest), profile.timezone)
      : null
    if (newestDay) daysSinceLastWorkout = daysBetween(newestDay, localDate)
  }

  let daysSinceLastWeighIn: number | null = null
  if (lastWeight.error) {
    console.log(`    weigh-ins   QUERY FAILED: ${lastWeight.error.message} (nudge suppressed)`)
  } else if (!lastWeight.data || lastWeight.data.length === 0) {
    console.log("    weigh-ins   no rows for this account")
  } else {
    const w = lastWeight.data[0]
    const day = localDateInZone(new Date(w.logged_at), profile.timezone)
    daysSinceLastWeighIn = day ? daysBetween(day, localDate) : null
    console.log(
      `    weigh-ins   latest ${w.logged_at} (local ${day}) → ${daysSinceLastWeighIn} days ago`
    )
  }

  // The two the current complaint is about. Both are keyed on a LOCAL DATE
  // written by the client, matched here against the local date derived from
  // the stored timezone — so a row logged today under a different date key
  // reads as absent.
  const energyToday = energy.error ? null : energy.data ?? []
  if (energy.error) {
    console.log(`    energy      QUERY FAILED: ${energy.error.message} (nudge suppressed)`)
  } else if (energyToday!.length === 0) {
    console.log(`    energy      NO check-in with logged_on = ${localDate}`)
  } else {
    console.log(
      `    energy      ${energyToday!.length} check-in(s) with logged_on = ${localDate}: ` +
        energyToday!
          .map((e) => `level ${e.level} @ ${String(e.logged_hour).padStart(2, "0")}:00`)
          .join(", ")
    )
  }

  const creatineToday = creatine.error ? null : creatine.data ?? []
  if (creatine.error) {
    console.log(`    creatine    QUERY FAILED: ${creatine.error.message} (nudge suppressed)`)
  } else if (creatineToday!.length === 0) {
    console.log(`    creatine    NO row with taken_on = ${localDate}`)
  } else {
    console.log(
      `    creatine    ${creatineToday!.length} row(s) with taken_on = ${localDate}: ` +
        creatineToday!.map((c) => `${c.dose_g} g (saved ${c.created_at})`).join(", ")
    )
  }

  let mealsLoggedToday = 0
  if (meals.error) {
    console.log(`    meals       QUERY FAILED: ${meals.error.message} (nudge suppressed)`)
    mealsLoggedToday = 99
  } else {
    mealsLoggedToday = (meals.data ?? []).filter(
      (m) => localDateInZone(new Date(m.logged_at), profile.timezone!) === localDate
    ).length
    console.log(`    meals       ${mealsLoggedToday} logged on ${localDate}`)
  }

  // When a query failed, fall back exactly as buildReminderContext does, so
  // the body printed below is what the cron would actually send.
  // On a failed workout query buildReminderContext pretends the session
  // happened today, which makes BOTH the gap and workedOutToday read as "did
  // it" — getting only one of the two right would print a body the cron would
  // never send.
  const ctxBase = {
    mealsLoggedToday,
    workedOutToday: lastWorkout.error ? true : daysSinceLastWorkout === 0,
    daysSinceLastWorkout: lastWorkout.error ? 0 : daysSinceLastWorkout,
    energyCheckedInToday: energy.error ? true : energyToday!.length > 0,
    daysSinceLastWeighIn: lastWeight.error ? 0 : daysSinceLastWeighIn,
    creatineTakenToday: creatine.error ? true : creatineToday!.length > 0,
  }

  const render = (h: number): string => {
    if (h < startHour) return `(held — before the ${startHour}:00 start hour)`
    const rs = computeReminders({ ...ctxBase, hour: h }, settings)
    if (rs.length === 0) return "(nothing due — no push)"
    return "\n" + rs.map((r) => `                  ${r.title}`).join("\n")
  }

  console.log("\n  what the cron would send")
  console.log(`    right now (${String(hour).padStart(2, "0")}:00)  ${render(hour)}`)
  // The evening hour matters on its own: the energy and creatine nudges are
  // gated at 18:00, so they can only ever appear in a push built at or after
  // that hour, whatever the clock says while this script runs.
  if (hour !== EVENING) {
    console.log(`    at 18:00            ${render(EVENING)}`)
  }
}

console.log("")
console.log("═".repeat(72))
console.log(
  "\nHow to read this:\n\n" +
    "  • One account, and the body matches the push you got → the cron is\n" +
    "    reading your data correctly and the rows really are missing. Check\n" +
    "    the saved-at timestamps: a row written after the push was built was\n" +
    "    not there to be read.\n\n" +
    "  • One account, but the body does NOT match the push you got → the push\n" +
    "    was built at a different hour than this run. The body is a snapshot,\n" +
    "    and the service worker will still display one up to two hours old\n" +
    "    (MAX_REMINDER_AGE_MS in public/sw.js).\n\n" +
    "  • More than one account → the extra account is the answer. Its push is\n" +
    "    computed from data you never write and delivered to your phone.\n" +
    "    Deleting its push_subscriptions row stops it.\n"
)
