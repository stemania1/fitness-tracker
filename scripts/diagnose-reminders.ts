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

// ── Schema probe ─────────────────────────────────────────────────────────
//
// Every table this script reads is checked up front, because a missing one
// is not a fact about the user — it is a fact about which database is on the
// other end of the connection. Reported per-account it reads as "no profile
// row, cron skips this account", which is a data condition with a completely
// different meaning and no way to tell the two apart from the output.
//
// The distinction that matters: `user_profiles` is created by migration
// 00001, `push_subscriptions` by 00015. A database that has the later table
// but not the earlier one was not partially migrated — it is a different
// database, almost always because .env.local points somewhere other than the
// project the cron reads.

/** PostgREST reports an absent table as PGRST205, not as an empty result. */
function isMissingTable(err: { code?: string; message?: string }): boolean {
  return err.code === "PGRST205" || /schema cache/i.test(err.message ?? "")
}

/** A rejected key, as opposed to a query that ran and found nothing. */
function isAuthFailure(err: { code?: string; message?: string }): boolean {
  return /invalid api key|jwt|unauthorized|invalid authentication/i.test(
    err.message ?? ""
  )
}

const REQUIRED_TABLES = [
  "push_subscriptions",
  "user_profiles",
  "workout_logs",
  "weight_logs",
  "energy_checkins",
  "food_logs",
  "creatine_logs",
]

const missingTables: string[] = []
for (const table of REQUIRED_TABLES) {
  const { error } = await db.from(table).select("*", { head: true }).limit(1)
  if (!error) continue
  // A rejected key fails every table identically, so reporting it as seven
  // missing tables would point at the schema when the problem is the
  // credential. It also matters far beyond this script: the reminder cron
  // builds its client from this exact pair (see createServiceClient), so a
  // key the pair rejects means the cron cannot read anything either.
  if (isAuthFailure(error)) {
    console.error(
      `\n  ✖  ${host} rejected SUPABASE_SERVICE_ROLE_KEY: ${error.message}\n\n` +
        "     This is the same NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY\n" +
        "     pair that src/lib/supabase/service.ts builds the reminder cron's\n" +
        "     client from. If the deployed cron holds this pair, it cannot read\n" +
        "     push_subscriptions and sends nothing at all.\n\n" +
        "     Worth separating two cases:\n\n" +
        "       • The key is wrong only HERE. Vercel cannot read back a variable\n" +
        "         marked Sensitive, so `vercel env pull` need not round-trip it.\n" +
        "         Take service_role straight from the Supabase dashboard for this\n" +
        "         project and retry.\n\n" +
        "       • The key is wrong in PRODUCTION too — it belongs to a different\n" +
        "         project, or the project disabled legacy JWT keys. Then the cron\n" +
        "         is dead and no reminder has been sent since it broke.\n"
    )
    process.exit(1)
  }
  if (isMissingTable(error)) missingTables.push(table)
}

if (missingTables.length > 0) {
  console.error(
    `\n  ✖  ${host} is missing ${missingTables.length} of the ${REQUIRED_TABLES.length} tables\n` +
      "     this script reads:\n\n" +
      missingTables.map((t) => `       ${t}`).join("\n") +
      "\n\n" +
      "     Going further would describe a database the app does not use, so\n" +
      "     this stops here. Two things produce it:\n\n" +
      "       • NEXT_PUBLIC_SUPABASE_URL points at a different Supabase project\n" +
      "         than production. Confirm against the value the cron actually\n" +
      "         runs with:\n\n" +
      "           npx vercel link\n" +
      "           npx vercel env pull .env.production.local --environment=production\n" +
      "           grep NEXT_PUBLIC_SUPABASE_URL .env.production.local\n\n" +
      "       • The migrations in supabase/migrations were never applied here.\n" +
      "         They are applied by hand, not on deploy — see supabase/README.md.\n"
  )
  process.exit(1)
}

// ── Mirrored production logic ────────────────────────────────────────────
//
// This script runs under bare `node --experimental-strip-types`, which
// resolves neither the `@/` alias nor the extensionless relative imports the
// real modules use internally, so it cannot import the reminder engine. The
// copy lives in ./reminder-mirror.ts, and reminder-mirror.test.ts asserts the
// copy and the real thing agree across every hour, context and setting — so
// drift fails CI rather than surfacing as a confident wrong answer here.

import {
  EVENING,
  MAX_REMINDERS,
  REMINDER_TYPES,
  computeReminders,
  normalizeReminderSettings,
  pushStartHour,
  type ReminderContext,
} from "./reminder-mirror.ts"

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
    .select(
      "display_name, timezone, last_push_sent_on, reminder_settings, daily_step_goal"
    )
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
  const startHour = pushStartHour(settings.quietEndHour)

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
      `  daily push hour=${startHour}`
  )
  const offTypes = REMINDER_TYPES.filter((t) => settings.types[t] === false)
  if (offTypes.length > 0) console.log(`  muted types   ${offTypes.join(", ")}`)

  // Every query below is the cron's, verbatim (src/app/api/cron/reminders).
  // A query that ERRORS is not the same as one that returns nothing: the cron
  // treats an error as "already done" and suppresses that nudge, so an error
  // here can never be the cause of a nudge firing.
  const [lastWorkout, lastWeight, energy, meals, creatine, ouraToday] =
    await Promise.all([
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
      // Steps come from the client's Oura sync, not a live read — the cron has
      // no user token — so an absent row means "unknown", not "didn't walk".
      db
        .from("oura_daily")
        .select("steps, updated_at")
        .eq("user_id", userId)
        .eq("day", localDate),
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
  const stepsToday = ouraToday.error
    ? null
    : (ouraToday.data?.[0]?.steps ?? null)
  const stepGoal = profile.daily_step_goal ?? 8000
  if (ouraToday.error) {
    console.log(`    steps       QUERY FAILED: ${ouraToday.error.message} (nudge suppressed)`)
  } else if (stepsToday == null) {
    console.log(
      `    steps       NO oura_daily row with day = ${localDate} ` +
        "(nudge suppressed — the app hasn't synced today)"
    )
  } else {
    console.log(
      `    steps       ${stepsToday.toLocaleString()} of ${stepGoal.toLocaleString()} ` +
        `(synced ${ouraToday.data![0].updated_at})`
    )
  }

  const ctxBase = {
    mealsLoggedToday,
    workedOutToday: lastWorkout.error ? true : daysSinceLastWorkout === 0,
    daysSinceLastWorkout: lastWorkout.error ? 0 : daysSinceLastWorkout,
    energyCheckedInToday: energy.error ? true : energyToday!.length > 0,
    daysSinceLastWeighIn: lastWeight.error ? 0 : daysSinceLastWeighIn,
    creatineTakenToday: creatine.error ? true : creatineToday!.length > 0,
    stepsToday,
    stepGoal,
  }

  const render = (h: number): string => {
    if (h < startHour) return `(held — the day's push goes out at ${startHour}:00)`
    const rs = computeReminders({ ...ctxBase, hour: h }, settings)
    if (rs.length === 0) return "(nothing due — no push)"
    return "\n" + rs.map((r) => `                  ${r.title}`).join("\n")
  }

  console.log("\n  what the cron would send")
  console.log(`    right now (${String(hour).padStart(2, "0")}:00)  ${render(hour)}`)
  // The send hour is worth showing on its own whenever the script runs at
  // some other time: it is the only hour that produces a push at all, so it
  // is the only one that describes what the user will actually receive.
  if (hour !== startHour) {
    console.log(
      `    at ${String(startHour).padStart(2, "0")}:00 (the day's send hour)  ${render(startHour)}`
    )
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
