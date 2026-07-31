// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mocks = vi.hoisted(() => {
  const replace = vi.fn()
  return {
    replace,
    // Stable identity, matching Next's own useRouter — a fresh object each
    // render would re-fire effects that depend on it.
    router: { replace },
    params: new URLSearchParams(),
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => mocks.params,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ delete: () => ({ eq: async () => ({}) }) }),
  }),
}))

import { OuraConnectionCard } from "./OuraConnectionCard"

function renderCard(onFeedback = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <OuraConnectionCard onFeedback={onFeedback} />
    </QueryClientProvider>
  )
  return onFeedback
}

beforeEach(() => {
  mocks.replace.mockReset()
  mocks.params = new URLSearchParams()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("OuraConnectionCard", () => {
  it("offers Connect when no ring is linked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    renderCard()
    expect(
      await screen.findByRole("button", { name: /connect/i })
    ).toBeInTheDocument()
  })

  it("offers Disconnect once linked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    renderCard()
    expect(
      await screen.findByRole("button", { name: /disconnect/i })
    ).toBeInTheDocument()
  })

  it("disconnects and reports it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const onFeedback = renderCard()
    await userEvent.click(await screen.findByRole("button", { name: /disconnect/i }))
    await waitFor(() =>
      expect(onFeedback).toHaveBeenCalledWith({
        type: "success",
        text: "Oura Ring disconnected.",
      })
    )
  })

  it("shows troubleshooting steps for a known failure reason", async () => {
    mocks.params = new URLSearchParams("oura=error&oura_reason=user_denied")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    renderCard()
    expect(
      await screen.findByText(/authorization was denied on oura's site/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/troubleshooting steps/i)).toBeInTheDocument()
  })

  // A reason the callback emits but this app doesn't recognise must not render
  // an empty panel — or crash reading `.steps` off nothing.
  it("shows no panel for an unrecognised reason", async () => {
    mocks.params = new URLSearchParams("oura=error&oura_reason=banana")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    renderCard()
    await screen.findByRole("button", { name: /connect/i })
    expect(screen.queryByText(/troubleshooting steps/i)).toBeNull()
  })

  it("reports a successful connection and cleans the URL", async () => {
    mocks.params = new URLSearchParams("oura=connected")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const onFeedback = renderCard()
    await waitFor(() =>
      expect(onFeedback).toHaveBeenCalledWith({
        type: "success",
        text: "Oura Ring connected successfully!",
      })
    )
    expect(mocks.replace).toHaveBeenCalledWith("/profile")
  })

  it("dismisses the troubleshooting panel", async () => {
    mocks.params = new URLSearchParams("oura=error&oura_reason=token_exchange")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: /dismiss/i }))
    expect(screen.queryByText(/troubleshooting steps/i)).toBeNull()
  })
})
