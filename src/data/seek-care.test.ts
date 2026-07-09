import { describe, it, expect } from "vitest"
import {
  EMERGENCY_NOTE,
  SEEK_CARE_SIGNALS,
  shouldSuggestClinician,
} from "./seek-care"

describe("seek-care guidance", () => {
  it("emergency note names 911 and disclaims device detection", () => {
    expect(EMERGENCY_NOTE).toMatch(/911/)
    expect(EMERGENCY_NOTE).toMatch(/not medical devices/i)
    expect(EMERGENCY_NOTE).toMatch(/heart attack/i)
  })

  it("lists non-empty, non-diagnostic signals", () => {
    expect(SEEK_CARE_SIGNALS.length).toBeGreaterThan(0)
    for (const s of SEEK_CARE_SIGNALS) {
      expect(s.pattern.length).toBeGreaterThan(0)
      expect(s.note.length).toBeGreaterThan(0)
    }
  })

  it("only nudges toward a clinician on sustained low HRV, not a single suppressed week", () => {
    expect(shouldSuggestClinician("low")).toBe(true)
    expect(shouldSuggestClinician("suppressed")).toBe(false)
    expect(shouldSuggestClinician("normal")).toBe(false)
    expect(shouldSuggestClinician("insufficient")).toBe(false)
  })
})
