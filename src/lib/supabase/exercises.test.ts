import { describe, it, expect, vi } from "vitest"
import { ensureExercisesExist } from "./exercises"
import { exercises as staticExercises } from "@/data/exercises"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * Build a stub SupabaseClient that responds to `.from("exercises").select(...).in(...)`
 * with the given rows. Anything beyond that contract is intentionally `any` —
 * the helper only uses that single chain.
 */
function stubClient(rows: Array<{ id: string; name: string }>, error: unknown = null): SupabaseClient<Database> {
  const inMock = vi.fn().mockResolvedValue({ data: rows, error })
  const selectMock = vi.fn().mockReturnValue({ in: inMock })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock })
  return { from: fromMock } as unknown as SupabaseClient<Database>
}

describe("ensureExercisesExist", () => {
  it("returns an empty map when no exercise ids are supplied", async () => {
    const client = stubClient([])
    const result = await ensureExercisesExist(client, [])
    expect(result.size).toBe(0)
    // No DB call should have been made — the helper short-circuits.
    expect((client.from as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0)
  })

  it("returns an empty map when none of the ids match the static catalog", async () => {
    const client = stubClient([])
    const result = await ensureExercisesExist(client, ["not-a-real-id"])
    expect(result.size).toBe(0)
    expect((client.from as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0)
  })

  it("maps static ids to Supabase UUIDs by matching on exercise name", async () => {
    const first = staticExercises[0]
    const second = staticExercises[1]
    const client = stubClient([
      { id: "uuid-1", name: first.name },
      { id: "uuid-2", name: second.name },
    ])
    const result = await ensureExercisesExist(client, [first.id, second.id])
    expect(result.size).toBe(2)
    expect(result.get(first.id)).toBe("uuid-1")
    expect(result.get(second.id)).toBe("uuid-2")
  })

  it("skips static ids the database does not return rows for", async () => {
    const first = staticExercises[0]
    const second = staticExercises[1]
    // DB only returned the first; second should be omitted.
    const client = stubClient([{ id: "uuid-1", name: first.name }])
    const result = await ensureExercisesExist(client, [first.id, second.id])
    expect(result.size).toBe(1)
    expect(result.get(first.id)).toBe("uuid-1")
    expect(result.has(second.id)).toBe(false)
  })

  it("throws when the Supabase query returns an error", async () => {
    const client = stubClient([], { message: "boom" })
    await expect(
      ensureExercisesExist(client, [staticExercises[0].id])
    ).rejects.toMatchObject({ message: "boom" })
  })
})
