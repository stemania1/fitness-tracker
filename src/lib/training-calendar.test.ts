import { describe, it, expect } from "vitest"
import { buildTrainingIcs } from "./training-calendar"

describe("buildTrainingIcs", () => {
  const ics = buildTrainingIcs({ stamp: "20260706T120000Z" })

  it("wraps a valid VCALENDAR with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true)
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true)
    expect(ics).toContain("VERSION:2.0")
  })

  it("emits one event per training day (4: Tue/Thu/Sat/Sun), skipping rest days", () => {
    const events = ics.match(/BEGIN:VEVENT/g) ?? []
    expect(events).toHaveLength(4)
  })

  it("places the Tuesday interval session at its first occurrence and time", () => {
    // Plan starts Mon 2026-07-06; first Tuesday is 07-07 at 5:45 AM.
    expect(ics).toContain("DTSTART:20260707T054500")
    expect(ics).toContain("SUMMARY:VO2 Max intervals — 4×4")
  })

  it("repeats weekly for the full plan length with a pre-session alarm", () => {
    expect(ics).toContain("RRULE:FREQ=WEEKLY;COUNT=12")
    expect(ics).toContain("BEGIN:VALARM")
    expect(ics).toContain("TRIGGER:-PT30M")
  })

  it("honours a custom start date and length", () => {
    const custom = buildTrainingIcs({
      startDate: "2026-08-03", // a Monday
      weeks: 4,
      stamp: "20260803T120000Z",
    })
    expect(custom).toContain("RRULE:FREQ=WEEKLY;COUNT=4")
    // First Tuesday on/after 08-03 is 08-04.
    expect(custom).toContain("DTSTART:20260804T054500")
  })
})
