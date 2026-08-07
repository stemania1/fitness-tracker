// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  deleteEq: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser, signOut: mocks.signOut },
    from: (_table: string) => ({
      delete: () => ({ eq: mocks.deleteEq }),
    }),
  }),
}))

import { AccountCard } from "./AccountCard"
import { resetAuthUserId } from "@/lib/supabase/user-query"

beforeEach(() => {
  resetAuthUserId()
  mocks.push.mockReset()
  mocks.getUser
    .mockReset()
    .mockResolvedValue({
      data: { user: { id: "user-1", email: "curtis@example.com" } },
    })
  mocks.signOut.mockReset().mockResolvedValue({ error: null })
  mocks.deleteEq.mockReset().mockResolvedValue({ error: null })
})

afterEach(() => {
  cleanup()
})

function renderCard(onFeedback = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <AccountCard onFeedback={onFeedback} />
    </QueryClientProvider>
  )
  return onFeedback
}

describe("AccountCard", () => {
  it("shows the signed-in email", async () => {
    renderCard()
    expect(await screen.findByText("curtis@example.com")).toBeInTheDocument()
  })

  it("signs out and routes to /login", async () => {
    renderCard()
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/login"))
    expect(mocks.signOut).toHaveBeenCalled()
  })

  it("routes to the password page", () => {
    renderCard()
    fireEvent.click(screen.getByRole("button", { name: /change password/i }))
    expect(mocks.push).toHaveBeenCalledWith("/update-password")
  })

  it("deletes the account after confirmation, then signs out and routes home", async () => {
    renderCard()
    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }))

    fireEvent.click(
      await screen.findByRole("button", { name: /yes, delete my account/i })
    )

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"))
    expect(mocks.deleteEq).toHaveBeenCalledWith("id", "user-1")
    expect(mocks.signOut).toHaveBeenCalled()
  })

  it("surfaces a delete error and closes the dialog", async () => {
    mocks.deleteEq.mockResolvedValue({ error: { message: "delete failed" } })
    const onFeedback = renderCard()
    fireEvent.click(screen.getByRole("button", { name: /^delete account$/i }))

    fireEvent.click(
      await screen.findByRole("button", { name: /yes, delete my account/i })
    )

    await waitFor(() =>
      expect(onFeedback).toHaveBeenCalledWith({
        type: "error",
        text: "delete failed",
      })
    )
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    // Nothing was signed out or navigated on failure.
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
