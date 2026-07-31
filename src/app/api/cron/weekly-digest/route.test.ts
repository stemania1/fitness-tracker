import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

/**
 * Cron route tests for the weekly digest push.
 *
 * The last "I'm not getting notifications" hunt turned up real bugs that lived
 * exactly here — in the gating a cron does before it sends. So these drive the
 * route through a fake Supabase and a fake web-push, and assert on the gate
 * each user falls through: wrong day, already sent, nothing worth saying.
 */

const sendNotification = vi.hoisted(() => vi.fn())
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification },
}))

const createServiceClient = vi.hoisted(() => vi.fn())
vi.mock("@/lib/supabase/service", () => ({ createServiceClient }))

import { GET } from "./route"

interface Sub {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface Tables {
  push_subscriptions?: Sub[]
  user_profiles?: Record<string, unknown>[]
  weight_logs?: Record<string, unknown>[]
  food_logs?: Record<string, unknown>[]
  workout_logs?: Record<string, unknown>[]
  energy_checkins?: Record<string, unknown>[]
  oura_daily?: Record<string, unknown>[]
}

/** Records every mutation so tests can assert on the de-dupe write. */
interface Recorder {
  updates: { table: string; values: Record<string, unknown> }[]
  deletes: { table: string; id: unknown }[]
}

/**
 * Minimal stand-in for the Supabase query builder: every filter method returns
 * `this`, and the builder itself is thenable, so both `await db.from(x)...`
 * and `.single()` resolve to a PostgREST-shaped result.
 */
function makeDb(tables: Tables, rec: Recorder) {
  return {
    from(table: string) {
      const rows = (tables as Record<string, Record<string, unknown>[]>)[table] ?? []
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          if (builder._pendingDelete) rec.deletes.push({ table, id: val })
          if (builder._pendingUpdate) {
            rec.updates.push({ table, values: builder._pendingUpdate })
            builder._pendingUpdate = undefined
          }
          void col
          return builder
        },
        gte: () => builder,
        lt: () => builder,
        order: () => builder,
        limit: () => builder,
        update: (values: Record<string, unknown>) => {
          builder._pendingUpdate = values
          return builder
        },
        delete: () => {
          builder._pendingDelete = true
          return builder
        },
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then: (
          resolve: (v: { data: unknown[]; error: null }) => unknown
        ) => resolve({ data: rows, error: null }),
        _pendingUpdate: undefined as Record<string, unknown> | undefined,
        _pendingDelete: false,
      }
      return builder
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
/** Sunday 2026-08-02, 22:00 UTC = 18:00 EDT — the digest's moment. */
const SUNDAY_6PM_ET = new Date("2026-08-02T22:00:00Z")
/** Same local hour, but a Wednesday. */
const WEDNESDAY_6PM_ET = new Date("2026-08-05T22:00:00Z")

function run(tables: Tables, now: Date) {
  const rec: Recorder = { updates: [], deletes: [] }
  createServiceClient.mockReturnValue(makeDb(tables, rec))
  vi.setSystemTime(now)
  return { rec, res: GET(new Request("https://app.test/api/cron/weekly-digest")) }
}

beforeEach(() => {
  vi.useFakeTimers()
  sendNotification.mockReset()
  sendNotification.mockResolvedValue(undefined)
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
  process.env.VAPID_PRIVATE_KEY = "priv"
  delete process.env.CRON_SECRET
})

afterEach(() => {
  vi.useRealTimers()
})

describe("weekly digest cron", () => {
  it("rejects a request without the cron secret", async () => {
    process.env.CRON_SECRET = "s3cret"
    const { res } = run({}, SUNDAY_6PM_ET)
    const response = await res
    expect(response.status).toBe(401)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("sends on Sunday evening and records the local date", async () => {
    const { rec, res } = run(
      {
        push_subscriptions: [SUB],
        user_profiles: [
          { timezone: TZ, last_digest_sent_on: null, current_weight: 200, target_weight: 180 },
        ],
        // No workouts this week → the highest-priority action there is.
        workout_logs: [],
      },
      SUNDAY_6PM_ET
    )
    const body = await (await res).json()

    expect(body).toMatchObject({ ok: true, sent: 1, pruned: 0, users: 1 })
    expect(sendNotification).toHaveBeenCalledTimes(1)

    const payload = JSON.parse(sendNotification.mock.calls[0][1])
    expect(payload.title).toBe("Your week in review")
    expect(payload.body).toContain("0 workouts this week")
    expect(payload.url).toBe("/dashboard")
    // A tag so a second digest replaces the first rather than stacking.
    expect(payload.tag).toBe("craigfitness-weekly-digest")

    expect(rec.updates).toContainEqual({
      table: "user_profiles",
      values: { last_digest_sent_on: "2026-08-02" },
    })
  })

  it("stays quiet on any other day", async () => {
    const { res } = run(
      {
        push_subscriptions: [SUB],
        user_profiles: [
          { timezone: TZ, last_digest_sent_on: null, current_weight: 200, target_weight: 180 },
        ],
      },
      WEDNESDAY_6PM_ET
    )
    const body = await (await res).json()
    expect(body.sent).toBe(0)
    expect(body.skipped.notDigestTime).toBe(1)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("does not send twice in the same local day", async () => {
    const { res } = run(
      {
        push_subscriptions: [SUB],
        user_profiles: [
          {
            timezone: TZ,
            last_digest_sent_on: "2026-08-02",
            current_weight: 200,
            target_weight: 180,
          },
        ],
      },
      SUNDAY_6PM_ET
    )
    const body = await (await res).json()
    expect(body.sent).toBe(0)
    expect(body.skipped.alreadySent).toBe(1)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("skips a user with no stored timezone", async () => {
    const { res } = run(
      {
        push_subscriptions: [SUB],
        user_profiles: [{ timezone: null, last_digest_sent_on: null }],
      },
      SUNDAY_6PM_ET
    )
    const body = await (await res).json()
    expect(body.skipped.noTimezone).toBe(1)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("sends nothing on an all-clear week, but still marks the day", async () => {
    const { rec, res } = run(
      {
        push_subscriptions: [SUB],
        user_profiles: [
          { timezone: TZ, last_digest_sent_on: null, current_weight: 200, target_weight: 200 },
        ],
        // 3 workouts, good sleep, no intake data → only the "on track" filler.
        workout_logs: [
          { started_at: "2026-07-28T12:00:00Z" },
          { started_at: "2026-07-30T12:00:00Z" },
          { started_at: "2026-08-01T12:00:00Z" },
        ],
        oura_daily: [
          { day: "2026-07-30", sleep_score: 85, sleep_minutes: 480, readiness_score: 80 },
          { day: "2026-07-31", sleep_score: 85, sleep_minutes: 480, readiness_score: 80 },
        ],
      },
      SUNDAY_6PM_ET
    )
    const body = await (await res).json()

    expect(body.sent).toBe(0)
    expect(body.skipped.nothingToSay).toBe(1)
    expect(sendNotification).not.toHaveBeenCalled()
    // Marked anyway, so a later hour in the same local day doesn't retry.
    expect(rec.updates).toContainEqual({
      table: "user_profiles",
      values: { last_digest_sent_on: "2026-08-02" },
    })
  })

  it("prunes a subscription the push service has expired", async () => {
    sendNotification.mockRejectedValue({ statusCode: 410 })
    const { rec, res } = run(
      {
        push_subscriptions: [SUB],
        user_profiles: [
          { timezone: TZ, last_digest_sent_on: null, current_weight: 200, target_weight: 180 },
        ],
        workout_logs: [],
      },
      SUNDAY_6PM_ET
    )
    const body = await (await res).json()

    expect(body).toMatchObject({ sent: 0, pruned: 1 })
    expect(rec.deletes).toContainEqual({ table: "push_subscriptions", id: "sub-1" })
    // Nothing was delivered, so the day must stay open for a retry.
    expect(rec.updates).toHaveLength(0)
  })

  it("keeps a delivery failure from pruning a live subscription", async () => {
    sendNotification.mockRejectedValue({ statusCode: 500 })
    const { rec, res } = run(
      {
        push_subscriptions: [SUB],
        user_profiles: [
          { timezone: TZ, last_digest_sent_on: null, current_weight: 200, target_weight: 180 },
        ],
        workout_logs: [],
      },
      SUNDAY_6PM_ET
    )
    const body = await (await res).json()

    expect(body).toMatchObject({ sent: 0, pruned: 0 })
    expect(rec.deletes).toHaveLength(0)
  })

  it("uses the user's own timezone, not the server's", async () => {
    // 22:00 UTC is Monday 08:00 in Auckland — not Sunday evening for them.
    const { res } = run(
      {
        push_subscriptions: [SUB],
        user_profiles: [
          {
            timezone: "Pacific/Auckland",
            last_digest_sent_on: null,
            current_weight: 200,
            target_weight: 180,
          },
        ],
      },
      SUNDAY_6PM_ET
    )
    const body = await (await res).json()
    expect(body.skipped.notDigestTime).toBe(1)
    expect(sendNotification).not.toHaveBeenCalled()
  })
})
