/**
 * Caffeine content for drinks you can recognize by name.
 *
 * A logged meal can carry a meaningful caffeine dose — a 32 oz Dr Pepper is
 * ~110mg, about a cup of coffee — and until that reaches `caffeine_logs` the
 * energy read, the crash window, and the late-caffeine sleep warning are all
 * working from an incomplete day.
 *
 * The vision model can estimate caffeine, but it is guessing from appearance:
 * it cannot tell Coke from Diet Coke across the table, and it will happily
 * invent milligrams for a drink that has none. Where the *name* is
 * unambiguous, a table beats a guess — so this resolves first and the model's
 * number is the fallback for everything not listed.
 *
 * Deliberately drinks only. Solid sources (dark chocolate, coffee ice cream,
 * pre-workout) are measured by weight, not fluid volume, and the same "oz" in
 * a description means something different for them — the model estimate
 * handles those.
 *
 * Values are typical published figures for a standard serving. Brands vary by
 * a few mg and formulations change; this is for tracking trends, not for
 * anyone titrating a dose.
 */

import { parseVolumeOz, stripAsides } from "./drink-text"

// Re-exported: the volume parser was public API here before it was shared
// with the alcohol table.
export { parseVolumeOz }

/** A caffeine source whose dose scales with how much liquid you drank. */
interface PerVolumeSource {
  kind: "per_oz"
  label: string
  match: RegExp
  /** Milligrams per fluid ounce. */
  mgPerOz: number
  /** Serving size assumed when the description states no volume. */
  defaultOz: number
}

/**
 * A caffeine source with a fixed dose per serving. Espresso drinks are the
 * reason this exists: a 20 oz latte is mostly milk and carries the same two
 * shots as a 12 oz one, so scaling by volume would be badly wrong.
 */
interface PerServingSource {
  kind: "per_serving"
  label: string
  match: RegExp
  mg: number
}

type CaffeineSource = PerVolumeSource | PerServingSource

/**
 * Matched in order, first hit wins — so every entry that is a *qualifier* of
 * another ("diet coke" vs "coke", "decaf" vs "coffee", "caffeine-free" vs
 * anything) must come before the entry it qualifies.
 */
const SOURCES: readonly CaffeineSource[] = [
  // ── Explicit "no caffeine" qualifiers ────────────────────────────────
  // These win over everything, including their own base drink.
  { kind: "per_serving", label: "Caffeine-free", match: /caffeine[\s-]?free/i, mg: 0 },
  { kind: "per_serving", label: "Decaf coffee", match: /decaf/i, mg: 5 },

  // ── Sodas (mg per 12 oz ÷ 12) ────────────────────────────────────────
  // Diet variants differ enough from their regular counterpart to be worth
  // separate rows — Diet Coke has noticeably more caffeine than Coke does.
  { kind: "per_oz", label: "Dr Pepper", match: /dr\.?\s*pepper/i, mgPerOz: 41 / 12, defaultOz: 12 },
  { kind: "per_oz", label: "Diet Coke", match: /diet\s+coke|coca[\s-]?cola\s+light/i, mgPerOz: 46 / 12, defaultOz: 12 },
  { kind: "per_oz", label: "Coke", match: /coca[\s-]?cola|\bcoke\b/i, mgPerOz: 34 / 12, defaultOz: 12 },
  { kind: "per_oz", label: "Diet Pepsi", match: /diet\s+pepsi/i, mgPerOz: 35 / 12, defaultOz: 12 },
  { kind: "per_oz", label: "Pepsi", match: /\bpepsi\b/i, mgPerOz: 38 / 12, defaultOz: 12 },
  { kind: "per_oz", label: "Mountain Dew", match: /mountain\s*dew|\bmtn\s*dew\b/i, mgPerOz: 54 / 12, defaultOz: 12 },
  { kind: "per_oz", label: "Barq's root beer", match: /barq/i, mgPerOz: 22 / 12, defaultOz: 12 },
  // Generic colas, for when the description doesn't name a brand ("large
  // iced cola"). Listed above the caffeine-free sodas on purpose: a
  // description that mentions both ("iced cola, root beer") is far more
  // likely to be a cola than a root beer, and reading it as caffeine-free
  // silently drops a real dose.
  { kind: "per_oz", label: "Diet cola", match: /diet\s+cola|\bcola\s+zero\b/i, mgPerOz: 46 / 12, defaultOz: 12 },
  { kind: "per_oz", label: "Cola", match: /\bcola\b/i, mgPerOz: 34 / 12, defaultOz: 12 },
  // Caffeine-free by formulation. Listed so a confident model guess of
  // "it's a soda, so ~40mg" can't put phantom caffeine on the day.
  {
    kind: "per_oz",
    label: "Caffeine-free soda",
    match: /\bsprite\b|7[\s-]?up\b|\bfanta\b|ginger\s*ale|root\s*beer|\bsierra\s*mist\b|\bfresca\b/i,
    mgPerOz: 0,
    defaultOz: 12,
  },

  // ── Energy drinks ────────────────────────────────────────────────────
  { kind: "per_oz", label: "Red Bull", match: /red\s*bull/i, mgPerOz: 80 / 8.4, defaultOz: 8.4 },
  { kind: "per_oz", label: "Monster", match: /monster/i, mgPerOz: 160 / 16, defaultOz: 16 },
  { kind: "per_oz", label: "Celsius", match: /celsius/i, mgPerOz: 200 / 12, defaultOz: 12 },
  { kind: "per_oz", label: "Energy drink", match: /energy\s*drink/i, mgPerOz: 10, defaultOz: 12 },

  // ── Coffee ───────────────────────────────────────────────────────────
  // Espresso drinks are per-serving: the cup size is milk, not coffee.
  { kind: "per_serving", label: "Espresso", match: /espresso|\bristretto\b/i, mg: 64 },
  {
    kind: "per_serving",
    label: "Espresso drink",
    match: /\blatte\b|cappuccino|macchiato|americano|\bmocha\b|flat\s*white|cortado/i,
    mg: 128,
  },
  { kind: "per_oz", label: "Cold brew", match: /cold\s*brew|nitro/i, mgPerOz: 155 / 12, defaultOz: 12 },
  { kind: "per_oz", label: "Coffee", match: /\bcoffee\b/i, mgPerOz: 95 / 8, defaultOz: 8 },

  // ── Tea ──────────────────────────────────────────────────────────────
  { kind: "per_oz", label: "Matcha", match: /matcha/i, mgPerOz: 70 / 8, defaultOz: 8 },
  { kind: "per_oz", label: "Green tea", match: /green\s*tea/i, mgPerOz: 28 / 8, defaultOz: 8 },
  {
    kind: "per_oz",
    label: "Herbal tea",
    match: /herbal\s*tea|chamomile|rooibos|peppermint\s*tea/i,
    mgPerOz: 0,
    defaultOz: 8,
  },
  { kind: "per_oz", label: "Iced tea", match: /iced\s*tea|sweet\s*tea/i, mgPerOz: 3, defaultOz: 12 },
  { kind: "per_oz", label: "Tea", match: /\btea\b|\bchai\b/i, mgPerOz: 47 / 8, defaultOz: 8 },
] as const

export interface KnownCaffeine {
  /** Estimated caffeine for the described serving, in milligrams. */
  mg: number
  /** The matched drink, for showing why this number was suggested. */
  label: string
  /** Volume used, in fl oz — null for per-serving sources like a latte. */
  oz: number | null
}

/**
 * Look up caffeine for a described drink, or null when the description names
 * nothing recognizable. A zero-caffeine match (Sprite, herbal tea) returns
 * `mg: 0` rather than null — knowing a drink has none is a real answer, and
 * it's what keeps a model guess from adding caffeine that was never there.
 */
export function lookupCaffeine(description: string): KnownCaffeine | null {
  const text = stripAsides(description)
  const source = SOURCES.find((s) => s.match.test(text))
  if (!source) return null

  if (source.kind === "per_serving") {
    return { mg: source.mg, label: source.label, oz: null }
  }

  // Volume is read from the full text: a parenthetical is often where the
  // size lives ("iced coffee (16 oz)"), and a number there is a measurement
  // rather than a competing drink.
  const oz = parseVolumeOz(description) ?? source.defaultOz
  return { mg: Math.round(source.mgPerOz * oz), label: source.label, oz }
}


/**
 * The caffeine to suggest for a meal: the table when it recognizes the drink,
 * the model's own estimate otherwise. Returns the source so the UI can say
 * which one the number came from — "Dr Pepper, 32 oz" is checkable in a way
 * that a bare number from a vision model is not.
 */
export function resolveCaffeineMg(estimate: {
  description: string
  caffeine_mg?: number
}): { mg: number; from: "known" | "estimate"; label: string | null } {
  const known = lookupCaffeine(estimate.description)
  if (known) return { mg: known.mg, from: "known", label: known.label }
  return { mg: estimate.caffeine_mg ?? 0, from: "estimate", label: null }
}
