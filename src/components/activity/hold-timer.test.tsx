// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import { HoldTimer } from "./hold-timer"

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("HoldTimer", () => {
  it("counts up and returns the elapsed seconds on Done", () => {
    const onDone = vi.fn()
    render(<HoldTimer onDone={onDone} onCancel={() => {}} />)

    expect(screen.getByText("0")).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText("3")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /done/i }))
    expect(onDone).toHaveBeenCalledWith(3)
  })

  it("shows the target and marks it reached", () => {
    render(<HoldTimer targetSeconds={2} onDone={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/target: 2s/i)).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText(/target 2s reached/i)).toBeInTheDocument()
  })

  it("cancels without reporting a time", () => {
    const onCancel = vi.fn()
    const onDone = vi.fn()
    render(<HoldTimer onDone={onDone} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
