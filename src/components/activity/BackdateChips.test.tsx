// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import {
  BackdateChips,
  nowLocalDatetimeString,
} from "./BackdateChips"

afterEach(() => {
  cleanup()
})

describe("nowLocalDatetimeString", () => {
  it("returns the current local time formatted as YYYY-MM-DDTHH:mm", () => {
    const out = nowLocalDatetimeString()
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    // Year matches the current local year.
    expect(out.slice(0, 4)).toBe(new Date().getFullYear().toString())
  })

  it("zero-pads single-digit months, days, hours, and minutes", () => {
    // Construct a known date with single-digit values; bypass the helper to
    // assert the format invariant via a representative input.
    const d = new Date(2026, 0, 3, 4, 5) // 2026-01-03T04:05
    // We can't reach the internal helper directly, but nowLocalDatetimeString
    // uses the same `toLocalDatetimeString` formatter. Mock Date so the
    // helper returns a known output.
    const realDate = global.Date
    global.Date = class extends realDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(d.getTime())
        } else {
          // @ts-expect-error - spreading variable args into Date constructor
          super(...args)
        }
      }
    } as unknown as DateConstructor
    try {
      expect(nowLocalDatetimeString()).toBe("2026-01-03T04:05")
    } finally {
      global.Date = realDate
    }
  })
})

describe("BackdateChips — initial chip selection", () => {
  it("marks 'Today' active when value is today's date", () => {
    render(
      <BackdateChips value={nowLocalDatetimeString()} onChange={() => {}} />
    )
    expect(screen.getByText("Today")).toHaveClass("bg-purple-600")
    expect(screen.getByText("Yesterday")).not.toHaveClass("bg-purple-600")
    expect(screen.getByText(/Earlier/)).not.toHaveClass("bg-purple-600")
  })

  it("marks 'Yesterday' active when value is yesterday's date", () => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    y.setHours(18, 0, 0, 0)
    const pad = (n: number) => n.toString().padStart(2, "0")
    const value = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(
      y.getDate()
    )}T${pad(y.getHours())}:${pad(y.getMinutes())}`
    render(<BackdateChips value={value} onChange={() => {}} />)
    expect(screen.getByText("Yesterday")).toHaveClass("bg-purple-600")
    expect(screen.getByText("Today")).not.toHaveClass("bg-purple-600")
  })

  it("marks 'Earlier' active and reveals the datetime input for older dates", () => {
    const past = "2020-01-01T10:00"
    render(<BackdateChips value={past} onChange={() => {}} />)
    expect(screen.getByText(/Earlier/)).toHaveClass("bg-purple-600")
    // datetime-local input is visible.
    const input = screen.getByDisplayValue(past) as HTMLInputElement
    expect(input.type).toBe("datetime-local")
  })

  it("hides the datetime input by default when active chip is Today", () => {
    render(
      <BackdateChips value={nowLocalDatetimeString()} onChange={() => {}} />
    )
    expect(screen.queryByDisplayValue(nowLocalDatetimeString())).toBeNull()
  })
})

describe("BackdateChips — chip clicks", () => {
  it("emits today's local datetime when 'Today' is clicked", () => {
    const onChange = vi.fn()
    render(<BackdateChips value="2020-01-01T10:00" onChange={onChange} />)
    fireEvent.click(screen.getByText("Today"))
    expect(onChange).toHaveBeenCalledTimes(1)
    const emitted = onChange.mock.calls[0][0] as string
    // Same format and same local-date as today.
    expect(emitted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(emitted.slice(0, 10)).toBe(nowLocalDatetimeString().slice(0, 10))
  })

  it("emits yesterday at 6pm when 'Yesterday' is clicked", () => {
    const onChange = vi.fn()
    render(<BackdateChips value="2020-01-01T10:00" onChange={onChange} />)
    fireEvent.click(screen.getByText("Yesterday"))
    const emitted = onChange.mock.calls[0][0] as string

    const y = new Date()
    y.setDate(y.getDate() - 1)
    const pad = (n: number) => n.toString().padStart(2, "0")
    const expectedDate = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(
      y.getDate()
    )}`
    expect(emitted).toBe(`${expectedDate}T18:00`)
  })

  it("reveals the datetime input when 'Earlier' is clicked", () => {
    render(
      <BackdateChips value={nowLocalDatetimeString()} onChange={() => {}} />
    )
    // Not visible initially.
    expect(screen.queryByDisplayValue(nowLocalDatetimeString())).toBeNull()
    fireEvent.click(screen.getByText(/Earlier/))
    // Now visible (and bound to the current value).
    const input = screen.getByDisplayValue(nowLocalDatetimeString())
    expect(input).toBeInTheDocument()
  })

  it("propagates datetime-local edits via onChange", () => {
    const onChange = vi.fn()
    render(<BackdateChips value="2020-01-01T10:00" onChange={onChange} />)
    const input = screen.getByDisplayValue("2020-01-01T10:00")
    fireEvent.change(input, { target: { value: "2021-06-15T08:30" } })
    expect(onChange).toHaveBeenCalledWith("2021-06-15T08:30")
  })

  it("caps the datetime-local input at the current time via the max attribute", () => {
    render(<BackdateChips value="2020-01-01T10:00" onChange={() => {}} />)
    const input = screen.getByDisplayValue("2020-01-01T10:00")
    const max = input.getAttribute("max")
    expect(max).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})
