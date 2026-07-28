// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"

const { registerServiceWorker } = vi.hoisted(() => ({
  registerServiceWorker: vi.fn(),
}))
vi.mock("@/lib/service-worker", () => ({ registerServiceWorker }))

import { ServiceWorkerManager } from "./ServiceWorkerManager"

afterEach(() => {
  cleanup()
  registerServiceWorker.mockClear()
})

describe("ServiceWorkerManager", () => {
  it("registers the service worker on mount and renders nothing", () => {
    const { container } = render(<ServiceWorkerManager />)
    expect(container).toBeEmptyDOMElement()
    expect(registerServiceWorker).toHaveBeenCalledTimes(1)
  })
})
