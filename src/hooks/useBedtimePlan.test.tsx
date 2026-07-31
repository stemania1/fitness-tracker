// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, cleanup } from "@testing-library/react"
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

import { useBedtimePlan } from "./useBedtimePlan"

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.profile = null
})
afterEach(cleanup)

describe("useBedtimePlan", () => {
  it("derives the plan from the stored wake time and sleep goal", async () => {
    mocks.profile = { wake_time: "05:00", sleep_goal_hours: 7.5 }
    const { result } = renderHook(() => useBedtimePlan(), { wrapper })

    await waitFor(() => expect(result.current.plan).not.toBeNull())
    expect(result.current.plan?.bedtime).toEqual({ hour: 21, minute: 30 })
    expect(result.current.plan?.caffeineCutoff).toEqual({ hour: 13, minute: 30 })
  })

  it("is null with no wake time, so callers fall back rather than guess", async () => {
    mocks.profile = { wake_time: null, sleep_goal_hours: 7.5 }
    const { result } = renderHook(() => useBedtimePlan(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.plan).toBeNull()
  })

  // Consumers put the plan's cutoff in useMemo dependency lists. A fresh
  // object every render would silently recompute them on every render.
  it("returns a stable plan across re-renders", async () => {
    mocks.profile = { wake_time: "06:30", sleep_goal_hours: 8 }
    const { result, rerender } = renderHook(() => useBedtimePlan(), { wrapper })

    await waitFor(() => expect(result.current.plan).not.toBeNull())
    const first = result.current.plan
    rerender()
    expect(result.current.plan).toBe(first)
  })
})
