// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { RingBatteryIndicator } from "./RingBatteryIndicator"
import type { OuraRingBattery } from "@/lib/oura"

const NOW = new Date("2024-05-01T12:00:00Z").getTime()

function battery(over: Partial<OuraRingBattery>): OuraRingBattery {
  return {
    level: 80,
    charging: false,
    in_charger: false,
    timestamp: "2024-05-01T11:30:00Z",
    ...over,
  }
}

afterEach(() => cleanup())

describe("RingBatteryIndicator", () => {
  it("renders nothing when battery data is unavailable", () => {
    const { container } = render(<RingBatteryIndicator battery={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when level is null", () => {
    const { container } = render(
      <RingBatteryIndicator battery={battery({ level: null })} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the level percentage", () => {
    render(<RingBatteryIndicator battery={battery({ level: 72 })} now={NOW} />)
    expect(screen.getByText("72%")).toBeInTheDocument()
  })

  it("notes charging in the accessible label and title", () => {
    render(
      <RingBatteryIndicator
        battery={battery({ level: 45, charging: true })}
        now={NOW}
      />
    )
    expect(screen.getByText(/charging/i)).toBeInTheDocument()
    expect(
      screen.getByTitle(/ring battery \(charging\)/i)
    ).toBeInTheDocument()
  })

  it("includes a relative last-updated time in the title", () => {
    render(
      <RingBatteryIndicator
        battery={battery({ level: 50, timestamp: "2024-05-01T11:00:00Z" })}
        now={NOW}
      />
    )
    // 12:00 now vs 11:00 sample → 60m → 1h ago
    expect(screen.getByTitle(/updated 1h ago/i)).toBeInTheDocument()
  })
})
