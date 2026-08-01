// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
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
