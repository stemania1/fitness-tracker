// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

const mocks = vi.hoisted(() => ({ history: vi.fn() }))

vi.mock("@/hooks/useExerciseHistory", () => ({
  useExerciseHistory: () => ({ data: mocks.history() }),
}))

import { AdaptiveTargetBanner } from "./AdaptiveTargetBanner"

beforeEach(() => mocks.history.mockReset())
afterEach(() => cleanup())

describe("AdaptiveTargetBanner", () => {
  it("renders nothing when there's no history", () => {
    mocks.history.mockReturnValue({ previousSets: [], allTimeMaxWeight: null })
    const { container } = render(
      <AdaptiveTargetBanner exerciseId="e1" repsTarget="8-12" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("shows a progress recommendation after a maxed-out session", () => {
    mocks.history.mockReturnValue({
      previousSets: [
        { weight: 100, reps: 12 },
        { weight: 100, reps: 12 },
      ],
      allTimeMaxWeight: 100,
    })
    render(
      <AdaptiveTargetBanner
        exerciseId="e1"
        repsTarget="8-12"
        muscleGroups={["chest", "triceps"]}
      />
    )
    // Upper-body compound → +5.
    expect(screen.getByText(/Progress \+5 lb/)).toBeInTheDocument()
    expect(screen.getByText(/go for 105 lb/i)).toBeInTheDocument()
  })

  it("shows a hold recommendation after falling short", () => {
    mocks.history.mockReturnValue({
      previousSets: [
        { weight: 100, reps: 6 },
        { weight: 100, reps: 5 },
      ],
      allTimeMaxWeight: 100,
    })
    render(<AdaptiveTargetBanner exerciseId="e1" repsTarget="8-12" />)
    expect(screen.getByText(/Hold/)).toBeInTheDocument()
    expect(screen.getByText(/stay at 100 lb/i)).toBeInTheDocument()
  })
})
