// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: null as { wake_time: string | null; sleep_goal_hours: number } | null,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: mocks.profile, error: null }),
        }),
      }),
    }),
  }),
}))

import { BedtimeCard } from "./BedtimeCard"

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.profile = null
})
afterEach(cleanup)

describe("BedtimeCard", () => {
  it("prompts to set a wake time when none is stored", async () => {
    mocks.profile = { wake_time: null, sleep_goal_hours: 7.5 }
    render(wrap(<BedtimeCard />))
    expect(
      await screen.findByText(/Set your usual wake time/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Set wake time/i })).toHaveAttribute(
      "href",
      "/profile"
    )
  })

  it("shows bedtime, wind-down, and caffeine cutoff from wake time", async () => {
    mocks.profile = { wake_time: "05:30", sleep_goal_hours: 7.5 }
    render(wrap(<BedtimeCard />))
    expect(await screen.findByText("10:00 PM")).toBeInTheDocument()
    expect(screen.getByText(/9:30 PM/)).toBeInTheDocument()
    expect(screen.getByText(/2:00 PM/)).toBeInTheDocument()
    expect(screen.getByText(/wake 5:30 AM/)).toBeInTheDocument()
  })
})
