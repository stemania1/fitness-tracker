// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { DayNav } from "./DayNav"

afterEach(cleanup)

describe("DayNav", () => {
  it("renders the label", () => {
    render(<DayNav label="Today's Plan" />)
    expect(screen.getByText("Today's Plan")).toBeInTheDocument()
  })

  it("disables an arrow when its handler is omitted", () => {
    render(<DayNav label="Today's Plan" onNext={() => {}} />)
    expect(screen.getByLabelText("Previous day")).toBeDisabled()
    expect(screen.getByLabelText("Next day")).toBeEnabled()
  })

  it("fires the handlers on click", () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    render(<DayNav label="Tomorrow's Plan" onPrev={onPrev} onNext={onNext} />)
    fireEvent.click(screen.getByLabelText("Previous day"))
    fireEvent.click(screen.getByLabelText("Next day"))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})
