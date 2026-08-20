// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type React from "react"

// createClient runs at module top level in the card, so the mock must exist
// before the import below. The select chain terminates in `.limit()`, which
// resolves to the Supabase-shaped { data, error }.
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  limit: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: (...args: unknown[]) => mocks.limit(...args),
  }
  return {
    createClient: () => ({
      auth: { getUser: mocks.getUser },
      from: () => ({
        select: () => builder,
        insert: mocks.insert,
      }),
    }),
  }
})

import { EnergyCheckInCard } from "./EnergyCheckInCard"

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } })
  mocks.insert.mockReset().mockResolvedValue({ error: null })
  mocks.limit.mockReset().mockResolvedValue({ data: [], error: null })
})

afterEach(() => cleanup())

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe("EnergyCheckInCard", () => {
  it("always shows an expected-energy chip derived from the day's signals", async () => {
    renderWithClient(<EnergyCheckInCard sleepScore={90} readinessScore={88} />)
    expect(await screen.findByText(/expected:/i)).toBeInTheDocument()
  })

  /**
   * The chip used to say "Expected: High", a three-way band sitting next to
   * five differently-worded buttons. It matched neither Good nor Energized,
   * and "Low" meant one thing as a band and another as a button.
   */
  it("names the expectation with a word that is on one of the buttons", async () => {
    renderWithClient(<EnergyCheckInCard sleepScore={90} readinessScore={88} />)
    // Wait for the selector — the chip renders before the check-in query lands.
    await screen.findByRole("button", { name: /energized/i })
    const chip = screen.getByText(/expected:/i)
    const word = chip.textContent!.replace(/expected:\s*/i, "").trim()

    expect(["Drained", "Low", "Okay", "Good", "Energized"]).toContain(word)
    // And it's a button you can actually press, not a separate vocabulary.
    expect(
      screen.getByRole("button", { name: new RegExp(word, "i") })
    ).toBeInTheDocument()
  })

  it("never labels the expectation with the old band words", async () => {
    renderWithClient(<EnergyCheckInCard sleepScore={90} readinessScore={88} />)
    const chip = await screen.findByText(/expected:/i)
    expect(chip.textContent).not.toMatch(/moderate|high/i)
  })

  it("shows the 1-5 selector when there is no check-in today", async () => {
    renderWithClient(<EnergyCheckInCard />)
    expect(await screen.findByText(/how are you starting the day|how's your energy (holding up|this evening)/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /energized/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /drained/i })).toBeInTheDocument()
  })

  it("inserts a check-in with the chosen level and today's part of day", async () => {
    renderWithClient(<EnergyCheckInCard />)
    fireEvent.click(await screen.findByRole("button", { name: /good/i })) // level 4

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    const row = mocks.insert.mock.calls[0][0]
    expect(row.user_id).toBe("u1")
    expect(row.level).toBe(4)
    expect(row.logged_hour).toBeGreaterThanOrEqual(0)
    expect(row.logged_hour).toBeLessThanOrEqual(23)
    expect(["morning", "afternoon", "evening"]).toContain(row.part_of_day)
    expect(row.logged_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("shows the felt-vs-expected readout (not the selector) once a level is logged", async () => {
    mocks.limit.mockResolvedValue({ data: [{ level: 2 }], error: null })
    renderWithClient(<EnergyCheckInCard sleepScore={90} readinessScore={90} />)

    // A readout headline appears and the selector prompt is gone.
    expect(await screen.findByText(/update how i feel/i)).toBeInTheDocument()
    expect(screen.queryByText(/how are you starting the day|how's your energy (holding up|this evening)/i)).toBeNull()
  })

  it("lets the user reopen the selector to update how they feel", async () => {
    mocks.limit.mockResolvedValue({ data: [{ level: 3 }], error: null })
    renderWithClient(<EnergyCheckInCard />)

    fireEvent.click(await screen.findByRole("button", { name: /update how i feel/i }))
    expect(await screen.findByText(/how are you starting the day|how's your energy (holding up|this evening)/i)).toBeInTheDocument()
  })

  // Reported: "It shows expected but not actual — that's the confusing part."
  // The readout named the expectation and never the logged level, so a card
  // whose whole job is comparing the two only ever showed one of them.
  it("shows both sides of the comparison, not just the expectation", async () => {
    mocks.limit.mockResolvedValue({ data: [{ level: 1 }], error: null })
    renderWithClient(<EnergyCheckInCard sleepScore={90} readinessScore={90} />)

    expect(await screen.findByText("You: 1 (Drained)")).toBeInTheDocument()
    expect(screen.getByText(/^Expected: \d/)).toBeInTheDocument()
    // And the prose stops repeating either number.
    expect(screen.queryByText(/signals point to \d \(/)).toBeNull()
  })

  // Reported: "I update and it says Okay even if I said otherwise." The
  // selector reopening is not the same as the new answer reaching the readout,
  // which is what the old test stopped short of.
  it("reads the updated level back after the user changes it", async () => {
    mocks.limit.mockResolvedValue({ data: [{ level: 4 }], error: null })
    renderWithClient(<EnergyCheckInCard sleepScore={90} readinessScore={90} />)

    // The row names what you logged, not just what was expected.
    expect(await screen.findByText("You: 4 (Good)")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /update how i feel/i }))
    // The next read returns what the insert just wrote.
    mocks.limit.mockResolvedValue({ data: [{ level: 1 }], error: null })
    fireEvent.click(await screen.findByRole("button", { name: /1\s*Drained/i }))

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    expect(mocks.insert.mock.calls[0][0].level).toBe(1)

    // The row reads back the level just logged, and the verdict flips: a card
    // still holding the old 4 would show "You: 4 (Good)" and stay on
    // "This tracks".
    await waitFor(() =>
      expect(screen.getByText("You: 1 (Drained)")).toBeInTheDocument()
    )
    expect(screen.queryByText("You: 4 (Good)")).toBeNull()
    expect(screen.queryByText(/this tracks/i)).toBeNull()
  })

  it("shows the late-caffeine sleep warning when one is passed", async () => {
    renderWithClient(
      <EnergyCheckInCard caffeineWarning="Caffeine after 2pm can cut into tonight's deep sleep." />
    )
    expect(
      await screen.findByText(/can cut into tonight's deep sleep/i)
    ).toBeInTheDocument()
  })

  it("does not show a caffeine warning when none is passed", async () => {
    renderWithClient(<EnergyCheckInCard />)
    await screen.findByText(/expected:/i)
    expect(screen.queryByText(/deep sleep/i)).toBeNull()
  })
})
