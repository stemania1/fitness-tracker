import { describe, it, expect } from "vitest"
import { supabaseProjectRef, payloadSource } from "./payload-source"

describe("supabaseProjectRef", () => {
  it("takes the first host label of a project URL", () => {
    expect(supabaseProjectRef("https://abcd1234.supabase.co")).toBe("abcd1234")
  })

  it("ignores a path and trailing slash", () => {
    expect(supabaseProjectRef("https://abcd1234.supabase.co/rest/v1/")).toBe(
      "abcd1234"
    )
  })

  it("returns null for a local stack rather than the word localhost", () => {
    expect(supabaseProjectRef("http://localhost:54321")).toBeNull()
    expect(supabaseProjectRef("http://127.0.0.1:54321")).toBe("127")
  })

  it("returns null for anything unparseable, instead of guessing", () => {
    expect(supabaseProjectRef("not a url")).toBeNull()
    expect(supabaseProjectRef("")).toBeNull()
    expect(supabaseProjectRef(undefined)).toBeNull()
  })

  it("reads the doubled-scheme mistake as the literal host it parses to", () => {
    // https://https://ref.supabase.co parses with host "https" — worth
    // pinning, since this exact value reached production config once.
    expect(supabaseProjectRef("https://https://abcd1234.supabase.co")).toBe(
      "https"
    )
  })
})

describe("payloadSource", () => {
  it("pairs the project ref with the short commit", () => {
    expect(
      payloadSource({
        NEXT_PUBLIC_SUPABASE_URL: "https://abcd1234.supabase.co",
        VERCEL_GIT_COMMIT_SHA: "36918d797f4f85965c3c13668ada9f4998ca3d2f",
      })
    ).toBe("abcd1234@36918d7")
  })

  it("marks a build with no commit as local", () => {
    expect(
      payloadSource({ NEXT_PUBLIC_SUPABASE_URL: "https://abcd1234.supabase.co" })
    ).toBe("abcd1234@local")
  })

  it("never throws on an empty environment", () => {
    expect(payloadSource({})).toBe("unknown@local")
  })

  it("distinguishes two databases behind the same build", () => {
    const sha = { VERCEL_GIT_COMMIT_SHA: "aaaaaaabbbbbb" }
    const a = payloadSource({ ...sha, NEXT_PUBLIC_SUPABASE_URL: "https://old.supabase.co" })
    const b = payloadSource({ ...sha, NEXT_PUBLIC_SUPABASE_URL: "https://new.supabase.co" })
    expect(a).not.toBe(b)
  })
})
