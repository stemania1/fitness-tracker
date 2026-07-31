// @vitest-environment jsdom
import { render, screen, cleanup, act } from "@testing-library/react"
import { describe, it, expect, afterEach } from "vitest"
import { ViewportDebug } from "./ViewportDebug"

import { setViewportDebug } from "@/lib/viewport-debug-flag"

function setSearch(search: string) {
  window.history.replaceState({}, "", `/dashboard${search}`)
}

afterEach(() => {
  cleanup()
  setSearch("")
  window.localStorage.clear()
})

describe("ViewportDebug", () => {
  it("renders nothing without the debug query param", () => {
    setSearch("")
    render(<ViewportDebug />)
    expect(screen.queryByTestId("viewport-debug")).toBeNull()
  })

  it("renders the readout when ?debug=viewport is present", () => {
    setSearch("?debug=viewport")
    render(<ViewportDebug />)
    expect(screen.getByTestId("viewport-debug")).toBeInTheDocument()
  })

  it("reports the display mode and the unit probes", () => {
    setSearch("?debug=viewport")
    render(<ViewportDebug />)
    const panel = screen.getByTestId("viewport-debug")
    expect(panel.textContent).toContain("mode")
    expect(panel.textContent).toContain("probe 100dvh")
    expect(panel.textContent).toContain("insets t/r/b/l")
  })

  it("reports absent for shell elements that are not mounted", () => {
    setSearch("?debug=viewport")
    render(<ViewportDebug />)
    expect(screen.getByTestId("viewport-debug").textContent).toContain("absent")
  })

  // An installed PWA launches at the manifest start_url and drops the query
  // string, so the choice has to survive without it.
  it("stays on after the query param is gone", () => {
    setSearch("?debug=viewport")
    render(<ViewportDebug />)
    cleanup()

    setSearch("")
    render(<ViewportDebug />)
    expect(screen.getByTestId("viewport-debug")).toBeInTheDocument()
  })

  it("turns off again with ?debug=off", () => {
    setSearch("?debug=viewport")
    render(<ViewportDebug />)
    cleanup()

    setSearch("?debug=off")
    render(<ViewportDebug />)
    expect(screen.queryByTestId("viewport-debug")).toBeNull()
    cleanup()

    setSearch("")
    render(<ViewportDebug />)
    expect(screen.queryByTestId("viewport-debug")).toBeNull()
  })

  // An installed PWA has no address bar, so the Profile toggle is the only way
  // in — it must take effect on an already-mounted overlay, without a reload.
  it("appears when the flag is switched on while mounted", () => {
    setSearch("")
    render(<ViewportDebug />)
    expect(screen.queryByTestId("viewport-debug")).toBeNull()

    act(() => setViewportDebug(true))
    expect(screen.getByTestId("viewport-debug")).toBeInTheDocument()
  })

  it("disappears when the flag is switched off while mounted", () => {
    setSearch("?debug=viewport")
    render(<ViewportDebug />)
    expect(screen.getByTestId("viewport-debug")).toBeInTheDocument()

    act(() => setViewportDebug(false))
    expect(screen.queryByTestId("viewport-debug")).toBeNull()
  })
})
