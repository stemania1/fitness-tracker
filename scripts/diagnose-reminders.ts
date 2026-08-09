/**
 * One-off diagnostic: why is the reminder cron saying what it's saying?
 *
 * Read-only. It reproduces exactly what `/api/cron/reminders` sees — every
 * push subscription, the profile behind it, and the signals that feed the
 * nudges — and prints the answer per subscription.
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

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** The user's local date for an instant, in their stored timezone. */
function localDateInZone(when: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(when)
  } catch {
    return null
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
  )
}

const now = new Date()

const { data: subs, error: subErr } = await db
  .from("push_subscriptions")
  .select("id, user_id, endpoint, created_at")
  .order("created_at", { ascending: true })

if (subErr) {
  console.error("Could not read push_subscriptions:", subErr.message)
  process.exit(1)
}

console.log(`\npush_subscriptions rows: ${subs?.length ?? 0}`)
console.log(
  "More than one row here, on accounts that aren't both yours, is itself the answer:\n" +
    "the cron sends to every row, each computed from its own account's data.\n"
)

for (const sub of subs ?? []) {
  // The endpoint is a capability URL — the tail is a secret, so only enough
  // to tell two devices apart is printed.
  const host = (() => {
    try {
      return new URL(sub.endpoint).host
    } catch {
      return "unparseable"
    }
  })()

  console.log("─".repeat(72))
  console.log(`subscription ${sub.id}`)
  console.log(`  user_id     ${sub.user_id}`)
  console.log(`  endpoint    ${host} …${sub.endpoint.slice(-8)}`)
  console.log(`  subscribed  ${sub.created_at}`)

  const { data: profile, error: profErr } = await db
    .from("user_profiles")
    .select("display_name, timezone, last_push_sent_on, reminder_settings")
    .eq("id", sub.user_id)
    .single()

  if (profErr || !profile) {
    console.log(`  PROFILE     none (${profErr?.message ?? "no row"}) — cron skips this user`)
    continue
  }

  console.log(`  profile     ${profile.display_name ?? "(no name)"}`)
  console.log(`  timezone    ${profile.timezone ?? "MISSING — cron skips this user"}`)
  console.log(`  guard       last_push_sent_on = ${profile.last_push_sent_on ?? "null"}`)

  if (!profile.timezone) continue
  const localDate = localDateInZone(now, profile.timezone)
  if (!localDate) {
    console.log("  timezone is unusable — cron skips this user")
    continue
  }
  console.log(`  local date  ${localDate}`)
  console.log(
    `  guard says  ${
      profile.last_push_sent_on === localDate
        ? "already sent today (no push this run)"
        : "NOT yet sent today (a push may go out)"
    }`
  )

  // The exact query the cron uses for the workout-gap nudge.
  const { data: lastWorkout, error: wErr } = await db
    .from("workout_logs")
    .select("id, name, started_at, finished_at")
    .eq("user_id", sub.user_id)
    .order("started_at", { ascending: false })
    .limit(3)

  if (wErr) {
    console.log(`  workouts    query failed: ${wErr.message}`)
    continue
  }
  if (!lastWorkout || lastWorkout.length === 0) {
    console.log("  workouts    none for this user — nudge would say 'first workout'")
    continue
  }

  console.log("  newest workout_logs rows for this user_id:")
  for (const w of lastWorkout) {
    const day = localDateInZone(new Date(w.started_at), profile.timezone)
    console.log(
      `    ${w.started_at}  (local ${day})  finished=${w.finished_at ? "yes" : "NO"}  ${w.name ?? "(unnamed)"}`
    )
  }

  const newestDay = localDateInZone(
    new Date(lastWorkout[0].started_at),
    profile.timezone
  )
  if (newestDay) {
    console.log(
      `  → the cron would say "${daysBetween(newestDay, localDate)} days since your last workout"`
    )
  }
}

console.log("─".repeat(72))
console.log(
  "\nIf the days figure above matches the push you received, the cron is reading\n" +
    "this account correctly and the workout row is genuinely missing or older than\n" +
    "you think. If it does NOT match, the push came from a different subscription\n" +
    "row — look for a second user_id in the list above.\n"
)
