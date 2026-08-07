// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, cleanup } from "@testing-library/react"
import { fireEvent } from "@testing-library/dom"
import { useEscapeKey } from "./useEscapeKey"

afterEach(() => {
  cleanup()
})

describe("useEscapeKey", () => {
  it("calls the handler on Escape", () => {
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it("ignores other keys", () => {
    const onEscape = vi.fn()
    renderHook(() => useEscapeKey(onEscape))
    fireEvent.keyDown(document, { key: "Enter" })
    fireEvent.keyDown(document, { key: "a" })
    expect(onEscape).not.toHaveBeenCalled()
  })

  it("stops listening after unmount", () => {
    const onEscape = vi.fn()
    const { unmount } = renderHook(() => useEscapeKey(onEscape))
    unmount()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onEscape).not.toHaveBeenCalled()
  })
})
