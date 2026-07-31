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

  it("shows adjust buttons while running and hides them once done", () => {
    render(<RestTimer seconds={30} onComplete={() => {}} onSkip={() => {}} />)
    expect(
      screen.getByRole("button", { name: /add 30 seconds/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /subtract 30 seconds/i })
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(31_000)
    })
    expect(
      screen.queryByRole("button", { name: /add 30 seconds/i })
    ).not.toBeInTheDocument()
  })

  it("adds 30 seconds to the remaining time", () => {
    render(<RestTimer seconds={60} onComplete={() => {}} onSkip={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /add 30 seconds/i }))
    expect(screen.getByText("1:30")).toBeInTheDocument()
  })

  it("subtracts 30 seconds from the remaining time", () => {
    render(<RestTimer seconds={120} onComplete={() => {}} onSkip={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /subtract 30 seconds/i }))
    expect(screen.getByText("1:30")).toBeInTheDocument()
  })

  it("keeps adjustments across subsequent ticks", () => {
    render(<RestTimer seconds={60} onComplete={() => {}} onSkip={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /add 30 seconds/i }))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.getByText("1:25")).toBeInTheDocument()
  })

  // Taking it to zero counts as the rest finishing, which is deliberately
  // different from Skip — the logger auto-advances on a natural end.
  it("completes when subtracting past zero, and never shows negative time", () => {
    const onComplete = vi.fn()
    render(<RestTimer seconds={20} onComplete={onComplete} onSkip={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /subtract 30 seconds/i }))
    expect(screen.getByText("0:00")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  // iOS throttles timers in a backgrounded PWA. A decrementing counter would
  // come back still showing time left long after the rest actually ended.
  it("catches up after the app is backgrounded and timers are throttled", () => {
    const onComplete = vi.fn()
    render(<RestTimer seconds={120} onComplete={onComplete} onSkip={() => {}} />)
    expect(screen.getByText("2:00")).toBeInTheDocument()

    act(() => {
      // Three minutes of wall clock pass with no ticks delivered.
      vi.setSystemTime(new Date(Date.now() + 180_000))
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByText("0:00")).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("renders 0:00 immediately when initialized with seconds=0", () => {
    const onComplete = vi.fn()
    render(<RestTimer seconds={0} onComplete={onComplete} onSkip={() => {}} />)
    expect(screen.getByText("0:00")).toBeInTheDocument()
    // Completion handler fires from the initial effect.
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
