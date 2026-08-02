// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog"

afterEach(() => {
  cleanup()
})

function Basic({ withDescription = true }: { withDescription?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Weight</DialogTitle>
          {withDescription && (
            <DialogDescription>Record today&apos;s weigh-in.</DialogDescription>
          )}
        </DialogHeader>
        <input aria-label="Weight" />
        <button>Save</button>
      </DialogContent>
    </Dialog>
  )
}

function open() {
  fireEvent.click(screen.getByText("Open"))
}

describe("Dialog accessibility", () => {
  it("labels the dialog by its own title, not a shared id", () => {
    render(<Basic />)
    open()
    const dialog = screen.getByRole("dialog")
    const title = screen.getByText("Log Weight")
    expect(title.id).toBeTruthy()
    expect(title.id).not.toBe("dialog-title")
    expect(dialog.getAttribute("aria-labelledby")).toBe(title.id)
  })

  it("gives two dialogs distinct title ids", () => {
    render(
      <>
        <Dialog open>
          <DialogContent>
            <DialogTitle>First</DialogTitle>
          </DialogContent>
        </Dialog>
        <Dialog open>
          <DialogContent>
            <DialogTitle>Second</DialogTitle>
          </DialogContent>
        </Dialog>
      </>
    )
    const first = screen.getByText("First").id
    const second = screen.getByText("Second").id
    expect(first).toBeTruthy()
    expect(second).toBeTruthy()
    expect(first).not.toBe(second)
  })

  it("points aria-describedby at the description when one is rendered", () => {
    render(<Basic />)
    open()
    const dialog = screen.getByRole("dialog")
    const description = screen.getByText("Record today's weigh-in.")
    expect(dialog.getAttribute("aria-describedby")).toBe(description.id)
  })

  it("omits aria-describedby when there is no description", () => {
    render(<Basic withDescription={false} />)
    open()
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-describedby")
  })

  it("moves focus to the first control on open", () => {
    render(<Basic />)
    open()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" })
    )
  })

  it("restores focus to the trigger on close", () => {
    render(<Basic />)
    const trigger = screen.getByText("Open")
    // A real click focuses the button; fireEvent.click does not, so focus it
    // explicitly or there is nothing for the dialog to restore to.
    trigger.focus()
    fireEvent.click(trigger)
    expect(document.activeElement).not.toBe(trigger)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(document.activeElement).toBe(trigger)
  })

  it("wraps Tab from the last control back to the first", () => {
    render(<Basic />)
    open()
    const save = screen.getByRole("button", { name: "Save" })
    save.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" })
    )
  })

  it("wraps Shift+Tab from the first control to the last", () => {
    render(<Basic />)
    open()
    const close = screen.getByRole("button", { name: "Close" })
    close.focus()
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Save" })
    )
  })

  it("leaves other keys alone", () => {
    render(<Basic />)
    open()
    const input = screen.getByLabelText("Weight")
    input.focus()
    fireEvent.keyDown(document, { key: "a" })
    expect(document.activeElement).toBe(input)
  })

  it("still closes on Escape", () => {
    render(<Basic />)
    open()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

describe("Dialog — keyboard-aware positioning", () => {
  /** Install a fake visualViewport and return a way to shrink it. */
  function fakeViewport(height: number, offsetTop = 0) {
    const listeners: Record<string, Array<() => void>> = {}
    const vv = {
      height,
      offsetTop,
      addEventListener: (type: string, fn: () => void) => {
        ;(listeners[type] ??= []).push(fn)
      },
      removeEventListener: (type: string, fn: () => void) => {
        listeners[type] = (listeners[type] ?? []).filter((l) => l !== fn)
      },
    }
    Object.defineProperty(window, "visualViewport", {
      value: vv,
      configurable: true,
      writable: true,
    })
    return {
      shrinkTo(next: number, top = 0) {
        // act() so the resulting state update flushes before we assert.
        act(() => {
          vv.height = next
          vv.offsetTop = top
          for (const fn of listeners.resize ?? []) fn()
        })
      },
    }
  }

  /** The box the dialog is centred within. */
  function centeringBox() {
    return screen.getByRole("dialog").parentElement as HTMLElement
  }

  it("centres within the visible region once the keyboard opens", () => {
    // The reported bug: the meal dialog's text input sat behind the keyboard,
    // because a fixed, centred panel centres in the layout viewport, which the
    // keyboard does not shrink.
    Object.defineProperty(window, "innerHeight", {
      value: 956,
      configurable: true,
    })
    const vp = fakeViewport(956)
    render(<Basic />)
    open()

    // Nothing covering the screen — ordinary full-screen positioning.
    expect(centeringBox().style.top).toBe("0px")
    expect(centeringBox().style.bottom).toBe("0px")

    vp.shrinkTo(620)
    expect(centeringBox().style.height).toBe("620px")
    expect(centeringBox().style.bottom).toBe("")
  })

  it("follows the offset when the visual viewport is panned", () => {
    Object.defineProperty(window, "innerHeight", {
      value: 956,
      configurable: true,
    })
    const vp = fakeViewport(956)
    render(<Basic />)
    open()
    vp.shrinkTo(620, 140)
    expect(centeringBox().style.top).toBe("140px")
  })

  it("lets a panel taller than the visible region scroll", () => {
    // Otherwise the keyboard simply clips whatever does not fit.
    render(<Basic />)
    open()
    expect(screen.getByRole("dialog").className).toContain("overflow-y-auto")
    expect(screen.getByRole("dialog").className).toContain("max-h-full")
  })
})
