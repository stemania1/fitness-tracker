// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

type SbResponse = { data: unknown; error: unknown }

function makeBuilder(response: SbResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  b.select = () => b
  b.eq = () => b
  b.order = () => b
  b.limit = () => b
  b.single = () => Promise.resolve(response)
  b.then = (
    onFulfilled: (value: SbResponse) => unknown,
    onRejected: (reason: unknown) => unknown
  ) => Promise.resolve(response).then(onFulfilled, onRejected)
  return b
}

const script = vi.hoisted(() => ({
  current: {} as Record<string, SbResponse>,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: (table: string) =>
      makeBuilder(script.current[table] ?? { data: null, error: null }),
  }),
}))

import { WeightTrendCard } from "./WeightTrendCard"

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

afterEach(() => {
  cleanup()
  script.current = {}
})

describe("WeightTrendCard", () => {
  it("renders the latest weight and hides the fallback once there are 2+ points", async () => {
    script.current = {
      weight_logs: {
        data: [
          { weight: 180, logged_at: "2026-01-01T08:00:00Z" },
          { weight: 178, logged_at: "2026-01-08T08:00:00Z" },
        ],
        error: null,
      },
      user_profiles: {
        data: { target_weight: 170, current_weight: 185 },
        error: null,
      },
    }
    render(<WeightTrendCard />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText("178")).toBeInTheDocument()
    )
    // Goal readout in the header, and no current/target fallback grid.
    expect(screen.getByText("/ 170")).toBeInTheDocument()
    expect(screen.queryByText(/current \(lbs\)/i)).toBeNull()
  })

  it("shows the current-vs-target fallback when there aren't enough points", async () => {
    script.current = {
      weight_logs: { data: [], error: null },
      user_profiles: {
        data: { target_weight: 170, current_weight: 185 },
        error: null,
      },
    }
    render(<WeightTrendCard />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText(/current \(lbs\)/i)).toBeInTheDocument()
    )
    // Falls back to the profile's current weight, and shows the target.
    expect(screen.getByText("185")).toBeInTheDocument()
    expect(screen.getByText("170")).toBeInTheDocument()
    expect(screen.getByText(/target \(lbs\)/i)).toBeInTheDocument()
  })
})
