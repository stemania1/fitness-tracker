import { describe, it, expect } from "vitest"
import { reorderList } from "./reorder"

describe("reorderList", () => {
  it("moves an item down", () => {
    expect(reorderList(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"])
  })

  it("moves an item up", () => {
    expect(reorderList(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"])
  })

  it("returns an equal-but-new array when from === to", () => {
    const input = ["a", "b", "c"]
    const out = reorderList(input, 1, 1)
    expect(out).toEqual(input)
    expect(out).not.toBe(input)
  })

  it("ignores out-of-range indices", () => {
    expect(reorderList(["a", "b"], -1, 1)).toEqual(["a", "b"])
    expect(reorderList(["a", "b"], 0, 5)).toEqual(["a", "b"])
  })

  it("does not mutate the input", () => {
    const input = ["a", "b", "c"]
    reorderList(input, 0, 2)
    expect(input).toEqual(["a", "b", "c"])
  })
})
