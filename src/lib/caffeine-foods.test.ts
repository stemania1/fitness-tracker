import { describe, it, expect } from "vitest"
import {
  lookupCaffeine,
  parseVolumeOz,
  resolveCaffeineMg,
} from "./caffeine-foods"

describe("parseVolumeOz", () => {
  it("reads fluid ounces in the forms a description uses", () => {
    expect(parseVolumeOz("32 oz Dr Pepper soda")).toBe(32)
    expect(parseVolumeOz("16.9 fl oz bottle of water")).toBe(16.9)
    expect(parseVolumeOz("20oz Coke")).toBe(20)
    expect(parseVolumeOz("8 ounce coffee")).toBe(8)
  })

  it("converts millilitres and litres", () => {
    expect(parseVolumeOz("500ml cold brew")).toBeCloseTo(16.9, 1)
    expect(parseVolumeOz("2 L bottle of Pepsi")).toBeCloseTo(67.6, 1)
  })

  it("treats a can as 12 oz", () => {
    expect(parseVolumeOz("a can of Coke")).toBe(12)
  })

  it("returns null when no volume is stated", () => {
    expect(parseVolumeOz("Dr Pepper")).toBeNull()
    expect(parseVolumeOz("Chicken bowl with rice")).toBeNull()
  })

  it("does not read a stray L as litres", () => {
    // "Light" starts with an l; only a digit-prefixed unit counts.
    expect(parseVolumeOz("Light beer")).toBeNull()
  })
})

describe("lookupCaffeine", () => {
  it("scales a soda by the volume actually stated", () => {
    // 41mg per 12oz → 32oz is ~110mg, about a cup of coffee.
    expect(lookupCaffeine("32 oz Dr Pepper soda")).toEqual({
      mg: 109,
      label: "Dr Pepper",
      oz: 32,
    })
  })

  it("falls back to a standard serving when no volume is given", () => {
    expect(lookupCaffeine("Dr Pepper")).toEqual({
      mg: 41,
      label: "Dr Pepper",
      oz: 12,
    })
  })

  it("distinguishes diet variants from their regular counterpart", () => {
    // Diet Coke genuinely carries more caffeine than Coke does.
    expect(lookupCaffeine("Diet Coke")?.mg).toBe(46)
    expect(lookupCaffeine("Coca-Cola")?.mg).toBe(34)
  })

  it("reports zero for sodas that have no caffeine", () => {
    // A real answer, not a miss — this is what stops a model guessing "soda,
    // so ~40mg" and inventing caffeine.
    expect(lookupCaffeine("Sprite")).toEqual({
      mg: 0,
      label: "Caffeine-free soda",
      oz: 12,
    })
    expect(lookupCaffeine("chamomile tea")?.mg).toBe(0)
  })

  it("honours explicit caffeine-free and decaf qualifiers", () => {
    expect(lookupCaffeine("caffeine-free Dr Pepper")?.mg).toBe(0)
    expect(lookupCaffeine("decaf coffee")?.mg).toBe(5)
  })

  it("does not scale espresso drinks by cup size — that's milk", () => {
    const small = lookupCaffeine("12 oz latte")
    const large = lookupCaffeine("20 oz latte")
    expect(small?.mg).toBe(128)
    expect(large?.mg).toBe(128)
    expect(small?.oz).toBeNull()
  })

  it("scales brewed coffee, which is all coffee", () => {
    expect(lookupCaffeine("16 oz coffee")?.mg).toBe(190)
  })

  it("ignores drink names inside a parenthetical aside", () => {
    // A real backfill row: the model hedged, and matching inside the hedge
    // would have written 128mg of espresso against a glass of milk.
    expect(
      lookupCaffeine("Glass of milk (or milky beverage like chai latte)")
    ).toBeNull()
  })

  it("still matches the drink named outside the parentheses", () => {
    expect(lookupCaffeine("Latte (espresso with steamed milk)")?.mg).toBe(128)
  })

  it("reads a volume stated inside parentheses", () => {
    // Parenthetical numbers are measurements, not competing drinks.
    expect(lookupCaffeine("Iced coffee (16 oz)")?.mg).toBe(190)
  })

  it("recognizes an unbranded cola", () => {
    expect(lookupCaffeine("Large iced cola soft drink")?.mg).toBe(34)
    expect(lookupCaffeine("diet cola")?.mg).toBe(46)
  })

  it("reads a cola as a cola even when root beer is also mentioned", () => {
    // Another real row. Matching only "root beer" scored a cola as zero.
    expect(lookupCaffeine("Large iced cola soft drink,  root beer")).toEqual({
      mg: 34,
      label: "Cola",
      oz: 12,
    })
    // A root beer on its own is still caffeine-free.
    expect(lookupCaffeine("root beer float")?.mg).toBe(0)
  })

  it("returns null for anything it doesn't recognize", () => {
    expect(lookupCaffeine("Chicken bowl with rice")).toBeNull()
    expect(lookupCaffeine("dark chocolate square")).toBeNull()
  })
})

describe("resolveCaffeineMg", () => {
  it("prefers the table over the model for a known drink", () => {
    expect(
      resolveCaffeineMg({ description: "32 oz Dr Pepper soda", caffeine_mg: 40 })
    ).toEqual({ mg: 109, from: "known", label: "Dr Pepper" })
  })

  it("lets the table zero out a model guess on a caffeine-free drink", () => {
    expect(resolveCaffeineMg({ description: "Sprite", caffeine_mg: 35 }).mg).toBe(0)
  })

  it("falls back to the model estimate for unrecognized food", () => {
    expect(
      resolveCaffeineMg({ description: "dark chocolate bar", caffeine_mg: 24 })
    ).toEqual({ mg: 24, from: "estimate", label: null })
  })

  it("treats a missing model estimate as no caffeine", () => {
    expect(resolveCaffeineMg({ description: "Chicken bowl" }).mg).toBe(0)
  })
})
