// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useElapsedSeconds, secondsSince } from "./useElapsedSeconds"

const T0 = new Date("2026-07-30T10:00:00.000Z")

describe("secondsSince", () => {
  it("floors to whole seconds", () => {
    expect(secondsSince(T0, T0.getTime() + 1999)).toBe(1)
    expect(secondsSince(T0, T0.getTime() + 2000)).toBe(2)
  })

  it("is 0 with no start time", () => {
    expect(secondsSince(null)).toBe(0)
  })

  // A backwards clock jump must not render a negative timer.
  it("clamps a start time in the future to 0", () => {
    expect(secondsSince(T0, T0.getTime() - 5000)).toBe(0)
  })
})

describe("useElapsedSeconds", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })
  afterEach(() => vi.useRealTimers())

  it("starts at 0 for a workout starting now", () => {
    const { result } = renderHook(() => useElapsedSeconds(T0))
    expect(result.current).toBe(0)
  })

  it("ticks once a second", () => {
    const { result } = renderHook(() => useElapsedSeconds(T0))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current).toBe(3)
  })

  it("stays 0 while the start time is unknown", () => {
    const { result } = renderHook(() => useElapsedSeconds(null))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current).toBe(0)
  })

  // The workout loads asynchronously, so the start time arrives after mount.
  it("picks up a start time that arrives later, without waiting a tick", () => {
    const { result, rerender } = renderHook(
      ({ start }: { start: Date | null }) => useElapsedSeconds(start),
      { initialProps: { start: null as Date | null } }
    )
    expect(result.current).toBe(0)

    vi.setSystemTime(new Date(T0.getTime() + 90_000))
    rerender({ start: T0 })
    expect(result.current).toBe(90)
  })

  // iOS throttles timers in a backgrounded PWA; deriving from the wall clock
  // means the display catches up rather than drifting behind.
  it("recovers the true elapsed time after the interval is throttled", () => {
    const { result } = renderHook(() => useElapsedSeconds(T0))
    act(() => {
      // Ten minutes pass with the interval suspended, then one tick fires.
      vi.setSystemTime(new Date(T0.getTime() + 600_000))
      vi.advanceTimersByTime(1000)
    })
    // 601, not 1: derived from the wall clock, so the missed ticks don't matter.
    expect(result.current).toBe(601)
  })

  it("clears the interval on unmount", () => {
    const clear = vi.spyOn(globalThis, "clearInterval")
    const { unmount } = renderHook(() => useElapsedSeconds(T0))
    unmount()
    expect(clear).toHaveBeenCalled()
  })
})
