// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { TrainingPlanTodayCard } from "./TrainingPlanTodayCard"

function renderAt(dateIso: string, readinessScore?: number | null) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(dateIso))
  return render(<TrainingPlanTodayCard readinessScore={readinessScore} />)
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("TrainingPlanTodayCard", () => {
  it("shows the week badge and today's session for a week-1 interval day", () => {
    renderAt("2026-07-07T08:00:00") // Tuesday, week 1
    expect(screen.getByText(/week 1 of 12/i)).toBeInTheDocument()
    expect(screen.getByText(/VO2 Max intervals/i)).toBeInTheDocument()
    // Base-phase note for the 4×4 day.
    expect(screen.getByText(/3 rounds/i)).toBeInTheDocument()
    // Baseline test callout appears throughout week 1.
    expect(screen.getByText(/baseline tests/i)).toBeInTheDocument()
  })

  it("shows a rest day without a time or phase note", () => {
    renderAt("2026-07-24T08:00:00") // Friday, week 3 (no test week)
    expect(screen.getByText(/^rest$/i)).toBeInTheDocument()
    expect(screen.queryByText(/baseline tests/i)).toBeNull()
  })

  it("flags the deload week", () => {
    renderAt("2026-08-19T08:00:00") // Wednesday, week 7
    expect(screen.getByText(/week 7 of 12/i)).toBeInTheDocument()
    expect(screen.getByText(/deload week/i)).toBeInTheDocument()
  })

  it("shows the plan-complete state after week 12", () => {
    renderAt("2026-10-06T08:00:00") // Tuesday after the plan ends
    expect(screen.getByText(/plan complete/i)).toBeInTheDocument()
    expect(screen.getByText(/12 weeks are done/i)).toBeInTheDocument()
  })

  it("links to the full plan page", () => {
    renderAt("2026-07-07T08:00:00")
    const link = screen.getByRole("link", { name: /view full plan/i })
    expect(link).toHaveAttribute("href", "/plan")
  })

  it("green-lights an interval day at high readiness", () => {
    renderAt("2026-07-07T08:00:00", 90) // Tuesday intervals, week 1
    expect(screen.getByText(/green light/i)).toBeInTheDocument()
  })

  it("downshifts an interval day at low readiness", () => {
    renderAt("2026-07-07T08:00:00", 60)
    expect(screen.getByText(/downshift, don't skip/i)).toBeInTheDocument()
    // "Zone 2" also appears in the session's own details, hence getAllByText.
    expect(screen.getAllByText(/zone 2/i).length).toBeGreaterThan(0)
  })

  it("shows no readiness gate when the score is unavailable", () => {
    renderAt("2026-07-07T08:00:00", null)
    expect(screen.queryByText(/green light/i)).toBeNull()
    expect(screen.queryByText(/downshift/i)).toBeNull()
  })

  it("never gates a rest day even at low readiness", () => {
    renderAt("2026-07-24T08:00:00", 40) // Friday rest, week 3
    expect(screen.queryByText(/downshift/i)).toBeNull()
  })

  it("renders a missed-session suggestion when one is passed", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-13T08:00:00")) // Monday, week 2
    render(
      <TrainingPlanTodayCard
        suggestion={{
          kind: "cooper-test",
          headline: "Cooper 12-min test still to do",
          detail: "Do it on Tuesday in place of VO2 Max intervals — 4×4.",
        }}
      />
    )
    expect(
      screen.getByText(/cooper 12-min test still to do/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/in place of VO2 Max intervals/i)).toBeInTheDocument()
  })

  it("renders no suggestion block when the suggestion is null", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-13T08:00:00"))
    render(<TrainingPlanTodayCard suggestion={null} />)
    expect(screen.queryByText(/still to do/i)).toBeNull()
    expect(screen.queryByText(/missed:/i)).toBeNull()
  })
})
