// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { SetWithMeta } from "@/lib/personal-records"

const { useStrengthSets } = vi.hoisted(() => ({ useStrengthSets: vi.fn() }))
vi.mock("@/hooks/useStrengthSets", () => ({ useStrengthSets }))

import { RecentPRsCard } from "./RecentPRsCard"

afterEach(() => {
  cleanup()
  useStrengthSets.mockReset()
})

/** ISO string for a date `days` before now, within the 30-day PR window. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

describe("RecentPRsCard", () => {
  it("shows loading skeletons while the query is pending", () => {
    useStrengthSets.mockReturnValue({ data: undefined, isLoading: true })
    render(<RecentPRsCard />)
    expect(screen.getByText("Recent PRs")).toBeInTheDocument()
    expect(screen.queryByText(/no new prs/i)).toBeNull()
  })

  it("shows the empty state when there are no recent PRs", () => {
    useStrengthSets.mockReturnValue({ data: [], isLoading: false })
    render(<RecentPRsCard />)
    expect(screen.getByText(/no new prs in the last 30 days/i)).toBeInTheDocument()
  })

  it("renders a weight PR with its badge and previous-best detail", () => {
    // An earlier lighter session, then a recent heavier one — a weight PR.
    const sets: SetWithMeta[] = [
      { exerciseName: "Bench Press", weight: 100, reps: 5, startedAt: daysAgo(40), assisted: false },
      { exerciseName: "Bench Press", weight: 120, reps: 5, startedAt: daysAgo(2), assisted: false },
    ]
    useStrengthSets.mockReturnValue({ data: sets, isLoading: false })
    render(<RecentPRsCard />)

    expect(screen.getByText("Bench Press")).toBeInTheDocument()
    expect(screen.getByText("Weight")).toBeInTheDocument()
    // Badge shows the achieving set; detail line shows the previous best.
    expect(screen.getByText(/120 lbs.*×.*5/)).toBeInTheDocument()
    expect(screen.getByText(/prev 100 lbs/)).toBeInTheDocument()
  })
})
