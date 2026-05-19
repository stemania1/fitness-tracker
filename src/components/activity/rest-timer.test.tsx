// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react"
import { RestTimer } from "./rest-timer"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("RestTimer", () => {
  it("renders the initial time formatted as m:ss", () => {
    render(<RestTimer seconds={90} onComplete={() => {}} onSkip={() => {}} />)
    expect(screen.getByText("1:30")).toBeInTheDocument()
  })

  it("pads seconds < 10 with a leading zero", () => {
    render(<RestTimer seconds={65} onComplete={() => {}} onSkip={() => {}} />)
    expect(screen.getByText("1:05")).toBeInTheDocument()
  })

  it("counts down once per second", () => {
    render(<RestTimer seconds={5} onComplete={() => {}} onSkip={() => {}} />)
    expect(screen.getByText("0:05")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText("0:04")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText("0:02")).toBeInTheDocument()
  })

  it("invokes onComplete exactly once when the countdown reaches zero", () => {
    const onComplete = vi.fn()
    render(<RestTimer seconds={2} onComplete={onComplete} onSkip={() => {}} />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("shows the 'Time is up!' message and a 'Dismiss' button after completion", () => {
    render(<RestTimer seconds={1} onComplete={() => {}} onSkip={() => {}} />)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByText(/time is up/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /dismiss/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^skip$/i })
    ).not.toBeInTheDocument()
  })

  it("shows a 'Skip' button while the countdown is running", () => {
    render(<RestTimer seconds={30} onComplete={() => {}} onSkip={() => {}} />)
    expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument()
    expect(screen.queryByText(/time is up/i)).not.toBeInTheDocument()
  })

  it("fires onSkip when the skip button is clicked mid-countdown", () => {
    const onSkip = vi.fn()
    render(<RestTimer seconds={30} onComplete={() => {}} onSkip={onSkip} />)

    fireEvent.click(screen.getByRole("button", { name: /skip/i }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it("never displays negative time even if a stale tick lands at zero", () => {
    // formatTime clamps to >= 0; this protects against off-by-one renders.
    render(<RestTimer seconds={1} onComplete={() => {}} onSkip={() => {}} />)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText("0:00")).toBeInTheDocument()
  })

  it("renders 0:00 immediately when initialized with seconds=0", () => {
    const onComplete = vi.fn()
    render(<RestTimer seconds={0} onComplete={onComplete} onSkip={() => {}} />)
    expect(screen.getByText("0:00")).toBeInTheDocument()
    // Completion handler fires from the initial effect.
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
