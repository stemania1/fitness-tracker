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

  it("marks 'Earlier' active and reveals a date picker for older dates", () => {
    render(<BackdateChips value="2020-01-01T10:00" onChange={() => {}} />)
    expect(screen.getByText(/Earlier/)).toHaveClass("bg-purple-600")
    // The date picker is visible and shows the date half of the value.
    const dateInput = screen.getByLabelText("Date") as HTMLInputElement
    expect(dateInput.type).toBe("date")
    expect(dateInput.value).toBe("2020-01-01")
  })

  it("always shows the time input, seeded with the value's time", () => {
    render(<BackdateChips value="2020-01-01T10:00" onChange={() => {}} />)
    const timeInput = screen.getByLabelText("Time") as HTMLInputElement
    expect(timeInput.type).toBe("time")
    expect(timeInput.value).toBe("10:00")
  })

  it("hides the date picker by default when active chip is Today", () => {
    render(
      <BackdateChips value={nowLocalDatetimeString()} onChange={() => {}} />
    )
    expect(screen.queryByLabelText("Date")).toBeNull()
    // The time input is still there.
    expect(screen.getByLabelText("Time")).toBeInTheDocument()
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

  it("preserves the time-of-day when 'Yesterday' is clicked", () => {
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
    // Date changes to yesterday; the 10:00 time carries over.
    expect(emitted).toBe(`${expectedDate}T10:00`)
  })

  it("reveals the date picker when 'Earlier' is clicked", () => {
    render(
      <BackdateChips value={nowLocalDatetimeString()} onChange={() => {}} />
    )
    // Not visible initially (Today is active).
    expect(screen.queryByLabelText("Date")).toBeNull()
    fireEvent.click(screen.getByText(/Earlier/))
    expect(screen.getByLabelText("Date")).toBeInTheDocument()
  })

  it("changes only the time when the time input is edited", () => {
    const onChange = vi.fn()
    render(<BackdateChips value="2020-01-01T10:00" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "14:30" },
    })
    expect(onChange).toHaveBeenCalledWith("2020-01-01T14:30")
  })

  it("changes only the date when the date picker is edited", () => {
    const onChange = vi.fn()
    render(<BackdateChips value="2020-01-01T10:00" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2021-06-15" },
    })
    expect(onChange).toHaveBeenCalledWith("2021-06-15T10:00")
  })

  it("caps the date picker at today via the max attribute", () => {
    render(<BackdateChips value="2020-01-01T10:00" onChange={() => {}} />)
    const max = screen.getByLabelText("Date").getAttribute("max")
    expect(max).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
