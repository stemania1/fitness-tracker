import { describe, it, expect } from "vitest"
import {
  defaultReminderSettings,
  normalizeReminderSettings,
  isQuietHour,
} from "./reminder-settings"

describe("defaultReminderSettings", () => {
  it("enables everything with no quiet hours", () => {
    const d = defaultReminderSettings()
    expect(d.enabled).toBe(true)
    expect(Object.values(d.types).every(Boolean)).toBe(true)
    expect(d.quietStartHour).toBeNull()
    expect(d.quietEndHour).toBeNull()
  })
})

describe("normalizeReminderSettings", () => {
  it("returns defaults for null/garbage input", () => {
    expect(normalizeReminderSettings(null)).toEqual(defaultReminderSettings())
    expect(normalizeReminderSettings("nope")).toEqual(defaultReminderSettings())
    expect(normalizeReminderSettings(42)).toEqual(defaultReminderSettings())
  })

  it("merges partial stored settings over the defaults", () => {
    const s = normalizeReminderSettings({ types: { log_meal: false } })
    expect(s.types.log_meal).toBe(false)
    expect(s.types.log_workout).toBe(true) // unspecified → default
    expect(s.enabled).toBe(true)
  })

  it("keeps valid quiet hours and rejects invalid ones", () => {
    expect(normalizeReminderSettings({ quietStartHour: 22, quietEndHour: 7 })).toMatchObject({
      quietStartHour: 22,
      quietEndHour: 7,
    })
    expect(normalizeReminderSettings({ quietStartHour: 25, quietEndHour: -1 })).toMatchObject({
      quietStartHour: null,
      quietEndHour: null,
    })
    expect(normalizeReminderSettings({ quietStartHour: 9.5 }).quietStartHour).toBeNull()
  })

  it("ignores unknown type keys", () => {
    const s = normalizeReminderSettings({ types: { bogus: false, log_weight: false } })
    expect(s.types.log_weight).toBe(false)
    expect("bogus" in s.types).toBe(false)
  })
})

describe("isQuietHour", () => {
  it("is false when quiet hours are unset or degenerate", () => {
    expect(isQuietHour(3, null, null)).toBe(false)
    expect(isQuietHour(3, 22, null)).toBe(false)
    expect(isQuietHour(3, 8, 8)).toBe(false)
  })

  it("handles a same-day window", () => {
    expect(isQuietHour(10, 9, 17)).toBe(true)
    expect(isQuietHour(17, 9, 17)).toBe(false) // end exclusive
    expect(isQuietHour(8, 9, 17)).toBe(false)
  })

  it("handles a window that wraps midnight", () => {
    expect(isQuietHour(23, 22, 7)).toBe(true)
    expect(isQuietHour(3, 22, 7)).toBe(true)
    expect(isQuietHour(7, 22, 7)).toBe(false) // end exclusive
    expect(isQuietHour(12, 22, 7)).toBe(false)
  })
})
