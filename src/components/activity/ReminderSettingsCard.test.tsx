// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"
import { defaultReminderSettings } from "@/lib/reminder-settings"
import { ReminderSettingsCard } from "./ReminderSettingsCard"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ update: mocks.update }),
  }),
}))

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.eq.mockReset().mockResolvedValue({ error: null })
  mocks.update.mockReset().mockReturnValue({ eq: mocks.eq })
})

afterEach(() => cleanup())

function renderCard(props?: Partial<React.ComponentProps<typeof ReminderSettingsCard>>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ReminderSettingsCard initial={defaultReminderSettings()} {...props} />
    </QueryClientProvider>
  )
}

describe("ReminderSettingsCard", () => {
  it("renders the master switch and category toggles", () => {
    renderCard()
    expect(screen.getByRole("switch", { name: /enable reminders/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /workout gap/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /meal logging/i })).toBeInTheDocument()
  })

  it("persists a category toggle to the profile", async () => {
    renderCard()
    fireEvent.click(screen.getByRole("switch", { name: /meal logging/i }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    const payload = mocks.update.mock.calls[0][0]
    expect(payload.reminder_settings.types.log_meal).toBe(false)
    expect(payload.reminder_settings.types.log_workout).toBe(true)
    expect(mocks.eq).toHaveBeenCalledWith("id", "u1")
  })

  it("reveals the quiet-hours pickers when quiet hours are enabled", async () => {
    renderCard()
    expect(screen.queryByLabelText(/from/i)).toBeNull()

    fireEvent.click(screen.getByRole("switch", { name: /enable quiet hours/i }))

    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    const payload = mocks.update.mock.calls[0][0]
    expect(payload.reminder_settings.quietStartHour).toBe(22)
    expect(payload.reminder_settings.quietEndHour).toBe(7)
    // Pickers now visible.
    expect(screen.getByLabelText(/from/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/until/i)).toBeInTheDocument()
  })

  it("disables category toggles when the master switch is off", () => {
    renderCard({ initial: { ...defaultReminderSettings(), enabled: false } })
    expect(screen.getByRole("switch", { name: /workout gap/i })).toBeDisabled()
  })
})
