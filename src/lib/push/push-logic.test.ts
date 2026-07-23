import { describe, it, expect } from "vitest"
import { reminderNotification } from "./reminder-digest"
import { localHourInZone, localDateInZone, daysBetweenLocalDates } from "./timezone"
import { dueReminderPush } from "./due"
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

  it("summarizes extras when several are due", () => {
    const n = reminderNotification([
      R("log_workout", 80, "It's been 4 days since your last workout"),
      R("log_meal", 65, "No meals logged yet today"),
      R("log_weight", 30, "Time for a weekly weigh-in"),
    ])
    expect(n?.body).toMatch(/last workout/)
    expect(n?.body).toMatch(/\+2 more/)
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
})
