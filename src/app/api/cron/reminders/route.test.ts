import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

/**
 * Cron route tests for the hourly reminder push.
 *
 * This job runs every hour but may notify at most once per local day, so the
 * whole thing hinges on one write landing: the `last_push_sent_on` claim. When
 * that claim silently fails, the user gets the same nudge every hour — the
 * exact symptom that keeps getting reported. These drive the route through a
 * fake Supabase whose update semantics are real enough to model that failure.
 */

const sendNotification = vi.hoisted(() => vi.fn())
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}))

const createServiceClient = vi.hoisted(() => vi.fn())
vi.mock("@/lib/supabase/service", () => ({ createServiceClient }))

import { GET } from "./route"

type Row = Record<string, unknown>

interface Sub extends Row {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface Tables {
  push_subscriptions?: Sub[]
  user_profiles?: Row[]
  workout_logs?: Row[]
  weight_logs?: Row[]
  energy_checkins?: Row[]
  food_logs?: Row[]
  creatine_logs?: Row[]
}

interface Recorder {
  updates: { table: string; values: Row; matched: number }[]
  deletes: { table: string; id: unknown }[]
}

/** Evaluate the small `or(...)` grammar the claim uses: `col.is.null` / `col.neq.x`. */
function matchesOr(row: Row, expr: string | undefined): boolean {
  if (!expr) return true
  return expr.split(",").some((clause) => {
    const [col, op, ...rest] = clause.split(".")
    const value = rest.join(".")
    if (op === "is" && value === "null") return row[col] == null
    if (op === "neq") return row[col] !== value
    return false
  })
}

/**
 * Stand-in for the Supabase query builder. Filters return `this` and the
 * builder is thenable, as in the real client. Unlike a pure stub it *applies*
 * updates to the row objects and honors the claim's `or` filter, so a repeat
 * run in the same test sees the claim the first run wrote — which is the only
 * way to test "sends once per day" rather than "sends once per request".
 *
 * `stickyUpdates: false` models the failure this route has to survive: an
 * update that reports success without changing anything.
 */
function makeDb(tables: Tables, rec: Recorder, stickyUpdates = true) {
  return {
    from(table: string) {
      const rows = (tables as Record<string, Row[]>)[table] ?? []
      const b = {
        _update: undefined as Row | undefined,
        _delete: false,
        _deleteId: undefined as unknown,
        _or: undefined as string | undefined,
        select: () => b,
        eq: (_col: string, val: unknown) => {
          if (b._delete) b._deleteId = val
          return b
        },
        or: (expr: string) => {
          b._or = expr
          return b
        },
        gte: () => b,
        lt: () => b,
        order: () => b,
        limit: () => b,
        update: (values: Row) => {
          b._update = values
          return b
        },
        delete: () => {
          b._delete = true
          return b
        },
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
          resolve(settle()),
      }

      function settle(): { data: Row[]; error: null } {
        if (b._delete) {
          rec.deletes.push({ table, id: b._deleteId })
          return { data: [], error: null }
        }
        if (b._update) {
          const matched = rows.filter((r) => matchesOr(r, b._or))
          rec.updates.push({ table, values: b._update, matched: matched.length })
          if (stickyUpdates) {
            for (const r of matched) Object.assign(r, b._update)
          }
          return { data: matched, error: null }
        }
        return { data: rows, error: null }
      }

      return b
    },
  }
}

const SUB: Sub = {
  id: "sub-1",
  user_id: "user-1",
  endpoint: "https://push.example/abc",
  p256dh: "key",
  auth: "auth",
}

const TZ = "America/New_York"
/** 2026-08-08T12:00:00Z = 08:00 EDT — the first hour a push may go out. */
const EIGHT_AM_ET = new Date("2026-08-08T12:00:00Z")
/** Same local day, three hours later. */
const ELEVEN_AM_ET = new Date("2026-08-08T15:00:00Z")
/** 00:30 EDT the same local day — due, but far too early to buzz a phone. */
const HALF_PAST_MIDNIGHT_ET = new Date("2026-08-08T04:30:00Z")

/** A user who is overdue on both non-hour-gated nudges. */
function overdueTables(profile: Row = {}): Tables {
  return {
    push_subscriptions: [{ ...SUB }],
    user_profiles: [{ timezone: TZ, last_push_sent_on: null, ...profile }],
    // Seven days ago in NY.
    workout_logs: [{ started_at: "2026-08-01T16:00:00Z" }],
    // Never weighed in.
    weight_logs: [],
  }
}

function makeRunner(tables: Tables, stickyUpdates = true) {
  const rec: Recorder = { updates: [], deletes: [] }
  createServiceClient.mockReturnValue(makeDb(tables, rec, stickyUpdates))
  return {
    rec,
    async at(now: Date) {
      vi.setSystemTime(now)
      const res = await GET(new Request("https://app.test/api/cron/reminders"))
      return res.json()
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  sendNotification.mockReset()
  sendNotification.mockResolvedValue(undefined)
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
  process.env.VAPID_PRIVATE_KEY = "priv"
  delete process.env.CRON_SECRET
  vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("reminder cron", () => {
  it("rejects a request without the cron secret", async () => {
    process.env.CRON_SECRET = "s3cret"
    const res = await GET(new Request("https://app.test/api/cron/reminders"))
    expect(res.status).toBe(401)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("sends the day's nudge and claims the local date", async () => {
    const run = makeRunner(overdueTables())
    const body = await run.at(EIGHT_AM_ET)

    expect(body).toMatchObject({ ok: true, sent: 1, pruned: 0, users: 1 })
    const payload = JSON.parse(sendNotification.mock.calls[0][1])
    expect(payload.title).toBe("CraigFitness")
    expect(payload.body).toContain("It's been 7 days since your last workout")
    expect(payload.body).toContain("Log your first weigh-in")

    expect(run.rec.updates).toContainEqual({
      table: "user_profiles",
      values: { last_push_sent_on: "2026-08-08" },
      matched: 1,
    })
  })

  // The reported bug: the same nudge arriving every hour, all day.
  it("sends once per local day no matter how many times the hour ticks", async () => {
    const run = makeRunner(overdueTables())

    const first = await run.at(EIGHT_AM_ET)
    expect(first.sent).toBe(1)

    const second = await run.at(ELEVEN_AM_ET)
    expect(second.sent).toBe(0)
    expect(second.skipped.notDue).toBe(1)
    expect(second.decisions[0].outcome).toBe("alreadySentToday")

    const third = await run.at(new Date("2026-08-08T22:00:00Z"))
    expect(third.sent).toBe(0)

    expect(sendNotification).toHaveBeenCalledTimes(1)
  })

  it("does not send when the claim reports success but doesn't stick", async () => {
    // Without the read-back this is precisely the hourly-repeat failure: an
    // update that errors silently leaves the guard open for every later run.
    const run = makeRunner(overdueTables(), false)

    const first = await run.at(EIGHT_AM_ET)
    expect(first.sent).toBe(0)
    expect(first.skipped.claimFailed).toBe(1)
    expect(first.decisions[0].error).toContain("did not stick")

    const second = await run.at(ELEVEN_AM_ET)
    expect(second.sent).toBe(0)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("holds the push until a civil local hour", async () => {
    const run = makeRunner(overdueTables())
    const body = await run.at(HALF_PAST_MIDNIGHT_ET)

    expect(body.sent).toBe(0)
    expect(body.skipped.notDue).toBe(1)
    expect(body.decisions[0]).toMatchObject({ hour: 0, outcome: "nothingDue" })
    expect(sendNotification).not.toHaveBeenCalled()
    // The day stays unclaimed, so the morning run can still nudge.
    expect(run.rec.updates).toHaveLength(0)
  })

  it("skips a user with no stored timezone", async () => {
    const run = makeRunner({
      push_subscriptions: [{ ...SUB }],
      user_profiles: [{ timezone: null, last_push_sent_on: null }],
    })
    const body = await run.at(EIGHT_AM_ET)

    expect(body.skipped.noTimezone).toBe(1)
    expect(body.decisions[0].outcome).toBe("noTimezone")
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("skips a user whose stored timezone is unusable", async () => {
    const run = makeRunner(overdueTables({ timezone: "Not/AZone" }))
    const body = await run.at(EIGHT_AM_ET)

    expect(body.skipped.badTimezone).toBe(1)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("stays quiet when the user has switched reminders off", async () => {
    const run = makeRunner(overdueTables({ reminder_settings: { enabled: false } }))
    const body = await run.at(EIGHT_AM_ET)

    expect(body.sent).toBe(0)
    expect(body.decisions[0].outcome).toBe("nothingDue")
    expect(run.rec.updates).toHaveLength(0)
  })

  it("prunes a subscription the push service has expired", async () => {
    sendNotification.mockRejectedValue({ statusCode: 410 })
    const run = makeRunner(overdueTables())
    const body = await run.at(EIGHT_AM_ET)

    expect(body).toMatchObject({ sent: 0, pruned: 1 })
    expect(run.rec.deletes).toContainEqual({ table: "push_subscriptions", id: "sub-1" })
  })

  it("reports a delivery failure instead of swallowing it", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("too many requests"), { statusCode: 429 })
    )
    const run = makeRunner(overdueTables())
    const body = await run.at(EIGHT_AM_ET)

    expect(body).toMatchObject({ sent: 0, pruned: 0 })
    expect(body.sendErrors[0]).toContain("429")
    expect(run.rec.deletes).toHaveLength(0)
  })

  it("surfaces a failed context query instead of nudging on made-up data", async () => {
    const rec: Recorder = { updates: [], deletes: [] }
    const db = makeDb(overdueTables(), rec)
    // A builder whose every filter returns itself and which always fails.
    const failing = {
      select: () => failing,
      eq: () => failing,
      gte: () => failing,
      order: () => failing,
      limit: () => failing,
      then: (resolve: (v: unknown) => unknown) =>
        resolve({ data: null, error: { message: "boom" } }),
    }
    const wrapped = {
      from: (table: string) =>
        table === "creatine_logs" ? failing : db.from(table),
    }
    createServiceClient.mockReturnValue(wrapped)
    vi.setSystemTime(EIGHT_AM_ET)
    const body = await (await GET(new Request("https://app.test/api/cron/reminders"))).json()

    expect(body.contextErrors).toContain("creatine_logs: boom")
  })

  it("writes the run summary to the log, since the response goes nowhere", async () => {
    const run = makeRunner(overdueTables())
    await run.at(EIGHT_AM_ET)

    const logged = (console.log as unknown as { mock: { calls: string[][] } }).mock.calls
    const summary = JSON.parse(logged[logged.length - 1][0])
    expect(summary).toMatchObject({ job: "cron/reminders", sent: 1 })
    expect(summary.decisions[0]).toMatchObject({
      user: "user-1",
      tz: TZ,
      hour: 8,
      localDate: "2026-08-08",
      outcome: "sent",
      delivered: 1,
    })
  })
})
