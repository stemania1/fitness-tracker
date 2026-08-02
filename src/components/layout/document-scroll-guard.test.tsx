// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { DocumentScrollGuard } from "./document-scroll-guard"

/** jsdom has no layout, so scroll position is simulated. */
function setScroll(x: number, y: number) {
  Object.defineProperty(window, "scrollX", { value: x, configurable: true })
  Object.defineProperty(window, "scrollY", { value: y, configurable: true })
}

let scrollTo: ReturnType<typeof vi.fn>

beforeEach(() => {
  scrollTo = vi.fn()
  Object.defineProperty(window, "scrollTo", {
    value: scrollTo,
    configurable: true,
    writable: true,
  })
  setScroll(0, 0)
})
afterEach(cleanup)

describe("DocumentScrollGuard", () => {
  it("renders nothing", () => {
    const { container } = render(<DocumentScrollGuard />)
    expect(container).toBeEmptyDOMElement()
  })

  it("snaps back when the document is scrolled", () => {
    render(<DocumentScrollGuard />)
    setScroll(0, 286) // the displacement measured on the device
    window.dispatchEvent(new Event("scroll"))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it("corrects a document that was already displaced on mount", () => {
    // A client-side navigation into the shell can land mid-scroll; waiting for
    // an event would leave the TopBar off screen until the user gestured.
    setScroll(0, 148)
    render(<DocumentScrollGuard />)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it("stays quiet when the document is already at the top", () => {
    render(<DocumentScrollGuard />)
    window.dispatchEvent(new Event("scroll"))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it("corrects horizontal displacement too", () => {
    render(<DocumentScrollGuard />)
    setScroll(40, 0)
    window.dispatchEvent(new Event("scroll"))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it("also fires on the resize and orientation changes that displace it", () => {
    // Opening the keyboard and rotating are when iOS is most likely to leave
    // the document offset, and neither necessarily emits a scroll event.
    render(<DocumentScrollGuard />)

    setScroll(0, 100)
    window.dispatchEvent(new Event("resize"))
    expect(scrollTo).toHaveBeenCalledTimes(1)

    setScroll(0, 100)
    window.dispatchEvent(new Event("orientationchange"))
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })

  it("stops correcting once unmounted, leaving ordinary pages alone", () => {
    const { unmount } = render(<DocumentScrollGuard />)
    unmount()
    setScroll(0, 200)
    window.dispatchEvent(new Event("scroll"))
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
