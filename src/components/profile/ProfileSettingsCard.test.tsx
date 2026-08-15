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

// `createClient` is called at module top level inside the card, so the mock
// has to be in place before the import below. vi.hoisted ensures the shared
// fn references exist by the time vi.mock's factory runs.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: (_table: string) => ({
      select: () => ({ eq: () => ({ single: mocks.single }) }),
      update: (values: Record<string, unknown>) => {
        mocks.update(values)
        return { eq: mocks.updateEq }
      },
    }),
  }),
}))

import { ProfileSettingsCard } from "./ProfileSettingsCard"
import { resetAuthUserId } from "@/lib/supabase/user-query"

const profileRow = {
  display_name: "Curtis",
  age: 40,
  sex: "male",
  height_inches: 70,
  current_weight: 244.4,
  fitness_level: "beginner",
  primary_goal: "lose_weight",
  target_weight: 200,
  workout_days: 4,
  limitations: null,
  wake_time: "06:30",
  sleep_goal_hours: 8,
  weekday_workout_minutes: 25,
  weekend_workout_minutes: 60,
  creatine_target_g: 5,
  daily_step_goal: 8000,
}

beforeEach(() => {
  resetAuthUserId()
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } })
  mocks.single.mockReset().mockResolvedValue({ data: profileRow, error: null })
  mocks.update.mockReset()
  mocks.updateEq.mockReset().mockResolvedValue({ error: null })
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
      <ProfileSettingsCard onFeedback={onFeedback} />
    </QueryClientProvider>
  )
  return onFeedback
}

describe("ProfileSettingsCard", () => {
  it("populates the form from the stored profile", async () => {
    renderCard()
    // The row loads and the populate effect runs after first paint, so wait
    // for a populated value rather than asserting on the just-mounted input.
    expect(await screen.findByDisplayValue("Curtis")).toBeInTheDocument()
    expect(screen.getByLabelText(/current weight/i)).toHaveValue(244.4)
    expect(screen.getByLabelText(/usual wake time/i)).toHaveValue("06:30")
  })

  it("reports 'No changes to save.' without writing when nothing changed", async () => {
    const onFeedback = renderCard()
    await screen.findByDisplayValue("Curtis")

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() =>
      expect(onFeedback).toHaveBeenCalledWith({
        type: "success",
        text: "No changes to save.",
      })
    )
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("sends only the changed column and reports success", async () => {
    const onFeedback = renderCard()
    // Wait for the populate effect — editing before it runs gets overwritten.
    const name = await screen.findByDisplayValue("Curtis")

    fireEvent.change(name, { target: { value: "Curt" } })
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() =>
      expect(onFeedback).toHaveBeenCalledWith({
        type: "success",
        text: "Profile updated successfully.",
      })
    )
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.update).toHaveBeenCalledWith({ display_name: "Curt" })
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "user-1")
  })

  it("surfaces an update error through onFeedback", async () => {
    mocks.updateEq.mockResolvedValue({ error: { message: "row violates RLS" } })
    const onFeedback = renderCard()
    const name = await screen.findByDisplayValue("Curtis")

    fireEvent.change(name, { target: { value: "Curt" } })
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }))

    await waitFor(() =>
      expect(onFeedback).toHaveBeenCalledWith({
        type: "error",
        text: "row violates RLS",
      })
    )
  })
})
