import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { ouraErrorInfo, isOuraErrorReason } from "./oura-connect-errors"

describe("isOuraErrorReason", () => {
  it("accepts every reason it has guidance for", () => {
    for (const reason of Object.keys(ouraErrorInfo)) {
      expect(isOuraErrorReason(reason)).toBe(true)
    }
  })

  it("rejects anything else, including prototype keys", () => {
    expect(isOuraErrorReason("")).toBe(false)
    expect(isOuraErrorReason("nope")).toBe(false)
    expect(isOuraErrorReason("toString")).toBe(false)
  })
})

describe("guidance content", () => {
  it("gives every reason a title and at least one concrete step", () => {
    for (const [reason, info] of Object.entries(ouraErrorInfo)) {
      expect(info.title, reason).toBeTruthy()
      expect(info.steps.length, reason).toBeGreaterThan(0)
      for (const step of info.steps) expect(step.trim()).not.toBe("")
    }
  })
})

// The callback redirects with ?oura_reason=<code>. A code it emits that isn't
// in the map falls through to no guidance at all, silently.
describe("contract with the OAuth callback", () => {
  it("has guidance for every reason the callback can emit", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/auth/oura/callback/route.ts"),
      "utf8"
    )
    const emitted = new Set(
      [...route.matchAll(/errorRedirect\(\s*request,\s*"([a-z_]+)"/g)].map((m) => m[1])
    )
    expect(emitted.size).toBeGreaterThan(0)
    for (const reason of emitted) {
      expect(isOuraErrorReason(reason), `callback emits "${reason}"`).toBe(true)
    }
  })
})
