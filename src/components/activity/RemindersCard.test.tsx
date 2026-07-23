// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react"
import type { Reminder } from "@/lib/reminders"
import { RemindersCard } from "./RemindersCard"

const WORKOUT: Reminder = {
  type: "log_workout",
  priority: 80,
  title: "It's been 4 days since your last workout",
  detail: "A short session still counts.",
}
const MEAL: Reminder = {
  type: "log_meal",
  priority: 65,
  title: "No meals logged yet today",
  detail: "Snap a meal.",
}

beforeEach(() => window.localStorage.clear())
afterEach(() => cleanup())

describe("RemindersCard", () => {
  it("renders nothing when there are no reminders", () => {
    const { container } = render(<RemindersCard reminders={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders each reminder's title and detail", () => {
    render(<RemindersCard reminders={[WORKOUT, MEAL]} />)
    expect(screen.getByText(/4 days since your last workout/i)).toBeInTheDocument()
    expect(screen.getByText(/no meals logged yet today/i)).toBeInTheDocument()
  })

  it("shows a Start a workout link for the workout nudge", () => {
    render(<RemindersCard reminders={[WORKOUT]} startWorkoutHref="/activity/log" />)
    const link = screen.getByRole("link", { name: /start a workout/i })
    expect(link).toHaveAttribute("href", "/activity/log")
  })

  it("dismisses a reminder and persists it for the day", () => {
    render(<RemindersCard reminders={[WORKOUT, MEAL]} />)
    const workoutItem = screen.getByText(/4 days since your last workout/i).closest("li")!
    fireEvent.click(within(workoutItem).getByRole("button", { name: /dismiss/i }))

    // The workout nudge is gone; the meal one remains.
    expect(screen.queryByText(/4 days since your last workout/i)).toBeNull()
    expect(screen.getByText(/no meals logged yet today/i)).toBeInTheDocument()

    // Persisted so it stays dismissed on a re-render (same day).
    const stored = Object.values({ ...window.localStorage }).join()
    expect(stored).toContain("log_workout")
  })

  it("stays dismissed across a remount within the same day", () => {
    const { unmount } = render(<RemindersCard reminders={[WORKOUT, MEAL]} />)
    const workoutItem = screen.getByText(/4 days/i).closest("li")!
    fireEvent.click(within(workoutItem).getByRole("button", { name: /dismiss/i }))
    unmount()

    render(<RemindersCard reminders={[WORKOUT, MEAL]} />)
    expect(screen.queryByText(/4 days/i)).toBeNull()
    expect(screen.getByText(/no meals logged yet today/i)).toBeInTheDocument()
  })
})
