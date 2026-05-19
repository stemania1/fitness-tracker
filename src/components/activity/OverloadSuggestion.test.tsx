// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  useExerciseHistory: vi.fn(),
}))

vi.mock("@/hooks/useExerciseHistory", () => ({
  useExerciseHistory: mocks.useExerciseHistory,
}))

import { OverloadSuggestion } from "./OverloadSuggestion"

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
  }>
) {
  mocks.useExerciseHistory.mockReturnValue({
    data: { previousSets, allTimeMaxWeight: null },
    isLoading: false,
  })
}

function set(reps: number, weight: number, set_number = 1) {
  return {
    set_number,
    reps,
    weight,
    duration_mins: null,
    distance_miles: null,
    incline_percent: null,
  }
}

describe("OverloadSuggestion", () => {
  it("suggests a +5 lbs bump when every previous set cleared the rep top", () => {
    setHistory([set(12, 100, 1), set(12, 100, 2), set(12, 100, 3)])
    render(<OverloadSuggestion exerciseId="ex-1" repsTarget="8-12" />)
    expect(screen.getByText(/try \+5 lbs today/i)).toBeInTheDocument()
    expect(
      screen.getByText(/cleared 12\+ reps on every set at 100 lbs/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/aim for 105 lbs/i)).toBeInTheDocument()
  })

  it("renders nothing when the previous session didn't clear the rep top", () => {
    setHistory([set(10, 100), set(11, 100), set(12, 100)])
    const { container } = render(
      <OverloadSuggestion exerciseId="ex-1" repsTarget="8-12" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when there is no previous history", () => {
    setHistory([])
    const { container } = render(
      <OverloadSuggestion exerciseId="ex-1" repsTarget="8-12" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the rep target can't be parsed", () => {
    setHistory([set(30, 100), set(30, 100)])
    const { container } = render(
      <OverloadSuggestion exerciseId="ex-1" repsTarget="30 sec" />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when no rep target is supplied (freestyle workout)", () => {
    setHistory([set(12, 100), set(12, 100)])
    const { container } = render(
      <OverloadSuggestion exerciseId="ex-1" repsTarget={null} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the previous sets used mixed weights", () => {
    setHistory([set(12, 100), set(12, 110), set(12, 100)])
    const { container } = render(
      <OverloadSuggestion exerciseId="ex-1" repsTarget="8-12" />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
