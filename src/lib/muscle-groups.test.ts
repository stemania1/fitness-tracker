import { describe, it, expect } from "vitest"
import { formatMuscleGroup } from "./muscle-groups"

describe("formatMuscleGroup", () => {
  it("normalizes known aliases to a canonical label", () => {
    expect(formatMuscleGroup("quadriceps")).toBe("Quads")
    expect(formatMuscleGroup("quads")).toBe("Quads")
    expect(formatMuscleGroup("lat")).toBe("Lats")
    expect(formatMuscleGroup("oblique")).toBe("Obliques")
  })

  it("turns underscores into spaces with a sentence-case label", () => {
    expect(formatMuscleGroup("full_body")).toBe("Full body")
    expect(formatMuscleGroup("lower_back")).toBe("Lower back")
  })

  it("capitalizes simple single-word groups", () => {
    expect(formatMuscleGroup("chest")).toBe("Chest")
    expect(formatMuscleGroup("biceps")).toBe("Biceps")
  })

  it("is case-insensitive and trims", () => {
    expect(formatMuscleGroup("  BACK ")).toBe("Back")
    expect(formatMuscleGroup("Full_Body")).toBe("Full body")
  })
})
