// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  useExerciseHistory: vi.fn(),
}))

vi.mock("@/hooks/useExerciseHistory", () => ({
  useExerciseHistory: mocks.useExerciseHistory,
}))

import { PreviousPerformance } from "./PreviousPerformance"

beforeEach(() => {
  mocks.useExerciseHistory.mockReset()
})

afterEach(() => {
  cleanup()
})

function setHistory(
  previousSets: Array<{
    set_number: number
    reps: number | null
    weight: number | null
    duration_mins: number | null
    distance_miles: number | null
    incline_percent: number | null
  }>,
  isLoading = false
) {
  mocks.useExerciseHistory.mockReturnValue({
    data: { previousSets, allTimeMaxWeight: null },
    isLoading,
  })
}

const blank = {
  duration_mins: null,
  distance_miles: null,
  incline_percent: null,
}

describe("PreviousPerformance — strength", () => {
  it("renders each set as 'weight × reps' joined by commas", () => {
    setHistory([
      { set_number: 1, reps: 10, weight: 100, ...blank },
      { set_number: 2, reps: 8, weight: 105, ...blank },
      { set_number: 3, reps: 6, weight: 110, ...blank },
    ])
    render(<PreviousPerformance exerciseId="ex-1" exerciseType="strength" />)
    expect(
      screen.getByText("Last: 100 lbs × 10, 105 lbs × 8, 110 lbs × 6")
    ).toBeInTheDocument()
  })

  it("renders bodyweight sets as 'BW × reps'", () => {
    setHistory([{ set_number: 1, reps: 15, weight: null, ...blank }])
    render(<PreviousPerformance exerciseId="ex-1" exerciseType="strength" />)
    expect(screen.getByText("Last: BW × 15")).toBeInTheDocument()
  })

  it("renders a '?' for missing rep counts", () => {
    setHistory([{ set_number: 1, reps: null, weight: 100, ...blank }])
    render(<PreviousPerformance exerciseId="ex-1" exerciseType="strength" />)
    expect(screen.getByText("Last: 100 lbs × ?")).toBeInTheDocument()
  })
})

describe("PreviousPerformance — cardio", () => {
  it("sums minutes and miles across all sets", () => {
    setHistory([
      {
        set_number: 1,
        reps: null,
        weight: null,
        duration_mins: 10,
        distance_miles: 1,
        incline_percent: null,
      },
      {
        set_number: 2,
        reps: null,
        weight: null,
        duration_mins: 15,
        distance_miles: 2,
        incline_percent: null,
      },
    ])
    render(<PreviousPerformance exerciseId="ex-1" exerciseType="cardio" />)
    expect(screen.getByText("Last: 25 min, 3 mi")).toBeInTheDocument()
  })

  it("omits distance when no miles were logged", () => {
    setHistory([
      {
        set_number: 1,
        reps: null,
        weight: null,
        duration_mins: 30,
        distance_miles: 0,
        incline_percent: null,
      },
    ])
    render(<PreviousPerformance exerciseId="ex-1" exerciseType="cardio" />)
    expect(screen.getByText("Last: 30 min")).toBeInTheDocument()
  })
})

describe("PreviousPerformance — loading and empty states", () => {
  it("shows a loading hint while the hook is fetching", () => {
    setHistory([], true)
    render(<PreviousPerformance exerciseId="ex-1" exerciseType="strength" />)
    expect(screen.getByText(/loading previous/i)).toBeInTheDocument()
  })

  it("renders nothing when there are no previous sets", () => {
    setHistory([])
    const { container } = render(
      <PreviousPerformance exerciseId="ex-1" exerciseType="strength" />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
