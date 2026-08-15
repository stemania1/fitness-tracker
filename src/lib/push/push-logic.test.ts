import { describe, it, expect } from "vitest"
import { reminderNotification } from "./reminder-digest"
import {
  localHourInZone,
  localDateInZone,
  daysBetweenLocalDates,
  localWeekdayInZone,
} from "./timezone"
import { dueReminderPush, pushStartHour, DAILY_PUSH_HOUR } from "./due"
import type { Reminder } from "@/lib/reminders"
import type { ReminderContext } from "@/lib/reminders"

const R = (type: Reminder["type"], priority: number, title: string): Reminder => ({
  type,
  priority,
  title,
  detail: "",
})

describe("reminderNotification", () => {
  it("returns null with no reminders", () => {
    expect(reminderNotification([])).toBeNull()
  })

  it("uses the single reminder's title as the body", () => {
    const n = reminderNotification([R("log_meal", 65, "No meals logged yet today")])
    expect(n?.title).toBe("CraigFitness")
    expect(n?.body).toBe("No meals logged yet today")
    expect(n?.url).toBe("/dashboard")
  })

  // A notification's text is frozen when it's built, so the payload has to
  // carry its own age for the service worker to judge it later.
  it("stamps when the payload was built", () => {
    const at = new Date("2026-08-09T22:01:00Z")
    const n = reminderNotification([R("log_meal", 65, "No meals logged yet today")], at)
    expect(n?.builtAt).toBe("2026-08-09T22:01:00.000Z")
  })

  it("lists each reminder on its own line when several are due", () => {
    const n = reminderNotification([
      R("log_workout", 80, "It's been 4 days since your last workout"),
      R("log_meal", 65, "No meals logged yet today"),
      R("log_weight", 30, "Time for a weekly weigh-in"),
    ])
    expect(n?.body).toBe(
      "It's been 4 days since your last workout\n" +
        "No meals logged yet today\n" +
        "Time for a weekly weigh-in"
    )
  })
})

describe("localHourInZone / localDateInZone", () => {
  // 2026-01-15T18:30:00Z
  const now = new Date("2026-01-15T18:30:00Z")

  it("converts UTC to a zone's local hour", () => {
    expect(localHourInZone(now, "UTC")).toBe(18)
    expect(localHourInZone(now, "America/New_York")).toBe(13) // UTC-5 in Jan
    expect(localHourInZone(now, "America/Los_Angeles")).toBe(10) // UTC-8 in Jan
  })

  it("returns the local date, which can differ from the UTC date", () => {
    const lateUtc = new Date("2026-01-15T02:00:00Z")
    expect(localDateInZone(lateUtc, "UTC")).toBe("2026-01-15")
    // 2am UTC is still the previous evening in LA.
    expect(localDateInZone(lateUtc, "America/Los_Angeles")).toBe("2026-01-14")
  })

  it("returns null for a null or invalid timezone", () => {
    expect(localHourInZone(now, null)).toBeNull()
    expect(localHourInZone(now, "Not/AZone")).toBeNull()
    expect(localDateInZone(now, "Not/AZone")).toBeNull()
  })

  it("counts whole days between local dates", () => {
    expect(daysBetweenLocalDates("2026-01-10", "2026-01-15")).toBe(5)
    expect(daysBetweenLocalDates("2026-01-15", "2026-01-15")).toBe(0)
    expect(daysBetweenLocalDates("2026-01-31", "2026-02-01")).toBe(1)
  })
})

describe("dueReminderPush", () => {
  const overdueCtx: ReminderContext = {
    hour: 19,
    mealsLoggedToday: 0,
    workedOutToday: false,
    daysSinceLastWorkout: 5,
    energyCheckedInToday: false,
    daysSinceLastWeighIn: 10,
    creatineTakenToday: true,
    stepsToday: null,
    stepGoal: 8000,
  }

  it("sends when reminders are due and none sent today", () => {
    const n = dueReminderPush({
      reminderSettingsRaw: {},
      ctx: overdueCtx,
      localDate: "2026-01-15",
      lastPushSentOn: null,
    })
    expect(n).not.toBeNull()
  })

  it("skips when a push already went out today", () => {
    const n = dueReminderPush({
      reminderSettingsRaw: {},
      ctx: overdueCtx,
      localDate: "2026-01-15",
      lastPushSentOn: "2026-01-15",
    })
    expect(n).toBeNull()
  })

  it("respects the user's settings (master off → no push)", () => {
    const n = dueReminderPush({
      reminderSettingsRaw: { enabled: false },
      ctx: overdueCtx,
      localDate: "2026-01-15",
      lastPushSentOn: null,
    })
    expect(n).toBeNull()
  })

  it("respects quiet hours", () => {
    const n = dueReminderPush({
      reminderSettingsRaw: { quietStartHour: 18, quietEndHour: 23 },
      ctx: overdueCtx, // hour 19 is inside 18–23
      localDate: "2026-01-15",
      lastPushSentOn: null,
    })
    expect(n).toBeNull()
  })

  // The workout-gap and weigh-in nudges are true from the first minute of the
  // local day, so without a floor the day's single push fires at 00:0x.
  it("holds the day's push until a civil hour", () => {
    const justAfterMidnight = { ...overdueCtx, hour: 0 }
    expect(
      dueReminderPush({
        reminderSettingsRaw: {},
        ctx: justAfterMidnight,
        localDate: "2026-01-15",
        lastPushSentOn: null,
      })
    ).toBeNull()
    expect(
      dueReminderPush({
        reminderSettingsRaw: {},
        ctx: { ...overdueCtx, hour: DAILY_PUSH_HOUR - 1 },
        localDate: "2026-01-15",
        lastPushSentOn: null,
      })
    ).toBeNull()
    expect(
      dueReminderPush({
        reminderSettingsRaw: {},
        ctx: { ...overdueCtx, hour: DAILY_PUSH_HOUR },
        localDate: "2026-01-15",
        lastPushSentOn: null,
      })
    ).not.toBeNull()
  })

  // The whole reason the push waits: the workout gap is true from midnight
  // and would otherwise claim the day before either evening nudge existed.
  it("carries the evening nudges the morning would have suppressed", () => {
    const skippedEverything: ReminderContext = {
      ...overdueCtx,
      hour: DAILY_PUSH_HOUR,
      // Meals logged, so the meal nudge doesn't fire and the digest's cap of
      // three leaves room for both evening lines. This is the exact shape of
      // the real notification that started the investigation.
      mealsLoggedToday: 3,
      energyCheckedInToday: false,
      creatineTakenToday: false,
    }
    const n = dueReminderPush({
      reminderSettingsRaw: {},
      ctx: skippedEverything,
      localDate: "2026-01-15",
      lastPushSentOn: null,
    })
    expect(n?.body).toContain("How's your energy today?")
    expect(n?.body).toContain("Haven't logged creatine today")
  })

  it("lets quiet hours delay the push but never bring it forward", () => {
    // Quiet 22:00–06:00. The window ending at 6am is permission to disturb,
    // not a reason to send before the day is knowable.
    expect(pushStartHour(6)).toBe(DAILY_PUSH_HOUR)
    expect(
      dueReminderPush({
        reminderSettingsRaw: { quietStartHour: 22, quietEndHour: 6 },
        ctx: { ...overdueCtx, hour: 6 },
        localDate: "2026-01-15",
        lastPushSentOn: null,
      })
    ).toBeNull()

    // Quiet 09:00–20:00 pushes it later, and that must be honored.
    const lateSettings = { quietStartHour: 9, quietEndHour: 20 }
    expect(pushStartHour(20)).toBe(20)
    expect(
      dueReminderPush({
        reminderSettingsRaw: lateSettings,
        ctx: { ...overdueCtx, hour: DAILY_PUSH_HOUR },
        localDate: "2026-01-15",
        lastPushSentOn: null,
      })
    ).toBeNull()
    expect(
      dueReminderPush({
        reminderSettingsRaw: lateSettings,
        ctx: { ...overdueCtx, hour: 20 },
        localDate: "2026-01-15",
        lastPushSentOn: null,
      })
    ).not.toBeNull()
  })
})

describe("localWeekdayInZone", () => {
  it("reads the weekday in the user's zone, not the server's", () => {
    // 03:00 UTC Sunday is still Saturday evening in New York.
    const sundayMorningUtc = new Date("2026-08-02T03:00:00Z")
    expect(localWeekdayInZone(sundayMorningUtc, "UTC")).toBe(0)
    expect(localWeekdayInZone(sundayMorningUtc, "America/New_York")).toBe(6)
  })

  it("reads Sunday once the user's local day has turned over", () => {
    const sundayLocal = new Date("2026-08-02T16:00:00Z")
    expect(localWeekdayInZone(sundayLocal, "America/New_York")).toBe(0)
  })

  it("is null for a missing or invalid timezone", () => {
    expect(localWeekdayInZone(new Date(), null)).toBeNull()
    expect(localWeekdayInZone(new Date(), "Not/AZone")).toBeNull()
  })
})
