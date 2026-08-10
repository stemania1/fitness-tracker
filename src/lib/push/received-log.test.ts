import { describe, it, expect } from "vitest"
import {
  parseReceived,
  deliveryLagMs,
  formatLag,
  type ReceivedPush,
} from "./received-log"

const entry = (over: Partial<ReceivedPush> = {}): ReceivedPush => ({
  receivedAt: "2026-08-09T22:01:00.000Z",
  builtAt: "2026-08-09T22:00:00.000Z",
  source: "abcd1234@36918d7",
  title: "CraigFitness",
  body: "Haven't logged creatine today",
  shown: true,
  ...over,
})

describe("parseReceived", () => {
  it("keeps well-formed entries", () => {
    expect(parseReceived([entry()])).toHaveLength(1)
  })

  it("drops entries with no timestamp, which can't be ordered or aged", () => {
    expect(parseReceived([{ body: "x" }, entry()])).toHaveLength(1)
  })

  it("survives a cache holding something that isn't a list", () => {
    expect(parseReceived(null)).toEqual([])
    expect(parseReceived({ nope: true })).toEqual([])
    expect(parseReceived("[]")).toEqual([])
  })

  it("preserves the distinction between unstamped and stamped payloads", () => {
    const [parsed] = parseReceived([{ receivedAt: entry().receivedAt }])
    expect(parsed.builtAt).toBeNull()
    expect(parsed.source).toBeNull()
  })

  it("treats a missing shown flag as shown, and only false as dropped", () => {
    expect(parseReceived([{ receivedAt: "x" }])[0].shown).toBe(true)
    expect(parseReceived([{ receivedAt: "x", shown: false }])[0].shown).toBe(false)
  })
})

describe("deliveryLagMs", () => {
  it("measures build to receipt", () => {
    expect(deliveryLagMs(entry())).toBe(60_000)
  })

  it("is null without a builtAt — the absence is the finding", () => {
    expect(deliveryLagMs(entry({ builtAt: null }))).toBeNull()
  })

  it("is null rather than NaN on an unparseable stamp", () => {
    expect(deliveryLagMs(entry({ builtAt: "whenever" }))).toBeNull()
  })

  it("reports the hours a held push spent in flight", () => {
    const lag = deliveryLagMs(
      entry({
        builtAt: "2026-08-09T18:00:00.000Z",
        receivedAt: "2026-08-09T21:30:00.000Z",
      })
    )
    expect(lag).toBe(3.5 * 3_600_000)
  })
})

describe("formatLag", () => {
  it("renders seconds, minutes and hours", () => {
    expect(formatLag(12_000)).toBe("12s")
    expect(formatLag(4 * 60_000)).toBe("4m")
    expect(formatLag(125 * 60_000)).toBe("2h 5m")
  })

  it("says unknown for an unmeasurable lag", () => {
    expect(formatLag(null)).toBe("unknown")
  })

  it("clamps a clock skew to zero instead of printing a negative age", () => {
    expect(formatLag(-5_000)).toBe("0s")
  })
})
