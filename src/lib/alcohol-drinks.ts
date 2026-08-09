/**
 * Alcohol content for drinks you can recognize by name.
 *
 * The sibling of `caffeine-foods.ts`, and for the same reason: a vision model
 * can see a glass of red wine but cannot tell you it carries ~16g of ethanol,
 * and it will happily invent a number for a drink that has none. Where the
 * name and the volume are stated, arithmetic beats a guess.
 *
 * Everything here is derived rather than tabulated. Ethanol content is
 * volume × ABV × density, so one honest number per drink style (its typical
 * ABV) covers every size — which matters more for alcohol than for caffeine,
 * where a 20oz latte carries the same two shots as a 12oz one. A pint of the
 * same beer as a can really is a third more alcohol.
 *
 * Typical strengths, not the bottle in your hand. Craft beer in particular
 * ranges from 4% to 12%, so a stated ABV in the description always wins.
 */

import { parseVolumeOz, stripAsides, ML_PER_OZ } from "./drink-text"

/** Density of ethanol, g/mL. */
const ETHANOL_G_PER_ML = 0.789

/**
 * A US standard drink: 14g of pure ethanol — 12oz of 5% beer, 5oz of 12%
 * wine, or 1.5oz of 40% spirits, which is why those three are "one drink"
 * despite looking nothing alike.
 */
export const STANDARD_DRINK_G = 14

/** Upper bound on a single logged drink, matching the DB check constraint. */
export const MAX_ALCOHOL_G = 500

/** A drink whose alcohol scales with how much you poured. */
interface AbvSource {
  kind: "abv"
  label: string
  match: RegExp
  /** Typical alcohol by volume, 0-1. */
  abv: number
  /** Serving size assumed when the description states no volume, in fl oz. */
  defaultOz: number
}

/**
 * A drink measured by what goes in it rather than by the glass. A margarita
 * is mostly mixer and ice, so scaling its volume by a spirit's ABV would be
 * badly wrong in the other direction.
 */
interface ServingSource {
  kind: "per_serving"
  label: string
  match: RegExp
  grams: number
}

type AlcoholSource = AbvSource | ServingSource

/**
 * Matched in order, first hit wins — so every entry that *qualifies* another
 * ("non-alcoholic beer" vs "beer", "light beer" vs "beer") must come before
 * the entry it qualifies.
 */
const SOURCES: readonly AlcoholSource[] = [
  // ── Explicit "no alcohol" qualifiers ─────────────────────────────────
  // These win over everything, including their own base drink.
  {
    kind: "per_serving",
    label: "Non-alcoholic",
    match: /non[\s-]?alcoholic|alcohol[\s-]?free|\bNA\s+beer\b|\bmocktail\b|\bvirgin\b|\bde-?alcoholi/i,
    grams: 0,
  },

  // ── Cocktails: measured by the pour, not the glass ───────────────────
  { kind: "per_serving", label: "Margarita", match: /margarita/i, grams: 22 },
  { kind: "per_serving", label: "Martini", match: /martini/i, grams: 25 },
  { kind: "per_serving", label: "Old fashioned", match: /old[\s-]?fashioned|manhattan|negroni/i, grams: 25 },
  { kind: "per_serving", label: "Mojito", match: /mojito|daiquiri|piña\s*colada|pina\s*colada/i, grams: 18 },
  { kind: "per_serving", label: "Mixed drink", match: /cocktail|mixed\s+drink|\bhighball\b|moscow\s+mule|gin\s+and\s+tonic|rum\s+and\s+coke|whiske?y\s+(?:and\s+)?(?:coke|sour)/i, grams: 18 },
  { kind: "per_serving", label: "Shot", match: /\bshot\b/i, grams: 14 },

  // ── Beer ─────────────────────────────────────────────────────────────
  { kind: "abv", label: "Light beer", match: /light\s+beer|\blite\s+beer\b|michelob\s+ultra|\bbud\s+light\b|\bmiller\s+lite\b|\bcoors\s+light\b/i, abv: 0.042, defaultOz: 12 },
  { kind: "abv", label: "IPA", match: /\bipa\b|india\s+pale\s+ale|double\s+ipa/i, abv: 0.068, defaultOz: 12 },
  { kind: "abv", label: "Stout", match: /\bstout\b|\bporter\b|guinness/i, abv: 0.055, defaultOz: 12 },
  { kind: "abv", label: "Craft beer", match: /craft\s+beer|pale\s+ale|\bamber\s+ale\b|\bsaison\b|\bhefeweizen\b/i, abv: 0.06, defaultOz: 12 },
  { kind: "abv", label: "Beer", match: /\bbeer\b|\blager\b|\bpilsner\b|\bale\b/i, abv: 0.05, defaultOz: 12 },
  { kind: "abv", label: "Hard seltzer", match: /hard\s+seltzer|white\s+claw|truly\b|hard\s+cider|\bcider\b/i, abv: 0.05, defaultOz: 12 },

  // ── Wine ─────────────────────────────────────────────────────────────
  { kind: "abv", label: "Fortified wine", match: /\bport\b|\bsherry\b|\bvermouth\b|madeira/i, abv: 0.18, defaultOz: 3 },
  { kind: "abv", label: "Sparkling wine", match: /champagne|prosecco|sparkling\s+wine|\bcava\b/i, abv: 0.12, defaultOz: 5 },
  { kind: "abv", label: "Red wine", match: /red\s+wine|cabernet|merlot|pinot\s+noir|malbec|\bshiraz\b|\bsyrah\b|\bzinfandel\b/i, abv: 0.135, defaultOz: 5 },
  { kind: "abv", label: "White wine", match: /white\s+wine|chardonnay|sauvignon\s+blanc|pinot\s+grigio|\briesling\b|\bros[ée]\b/i, abv: 0.12, defaultOz: 5 },
  { kind: "abv", label: "Wine", match: /\bwine\b/i, abv: 0.125, defaultOz: 5 },
  { kind: "abv", label: "Sake", match: /\bsake\b/i, abv: 0.16, defaultOz: 3 },

  // ── Spirits ──────────────────────────────────────────────────────────
  { kind: "abv", label: "Liqueur", match: /\bliqueur\b|baileys|kahl[uú]a|amaretto|\bschnapps\b/i, abv: 0.2, defaultOz: 1.5 },
  { kind: "abv", label: "Spirits", match: /\bvodka\b|\bwhiske?y\b|\bbourbon\b|\bscotch\b|\bgin\b|\brum\b|\btequila\b|\bmezcal\b|\bbrandy\b|\bcognac\b|\bspirits?\b|\bliquor\b/i, abv: 0.4, defaultOz: 1.5 },
]

/** Grams of ethanol in `oz` fluid ounces at `abv` (0-1). */
export function gramsEthanol(oz: number, abv: number): number {
  return oz * ML_PER_OZ * abv * ETHANOL_G_PER_ML
}

/**
 * An ABV stated in the description ("Beer 7.2% ABV"), 0-1, or null. A number
 * on the label beats any typical value we could assume — craft beer varies
 * more than twofold.
 */
export function parseAbv(description: string): number | null {
  const m = description.match(/(\d+(?:\.\d+)?)\s*%(?:\s*(?:abv|alc))?/i)
  if (!m) return null
  const pct = Number(m[1])
  // Above ~60% is a mis-read of something else on the label (juice content,
  // cacao percentage) rather than a drinkable strength.
  if (!Number.isFinite(pct) || pct <= 0 || pct > 60) return null
  return pct / 100
}

export interface KnownAlcohol {
  /** Estimated ethanol for the described serving, in grams. */
  grams: number
  /** The matched drink, for showing why this number was suggested. */
  label: string
  /** Volume used, in fl oz — null for per-serving sources like a margarita. */
  oz: number | null
  /** ABV used, 0-1 — null for per-serving sources. */
  abv: number | null
}

/**
 * Look up the alcohol in a described drink, or null when the description
 * names nothing recognizable. A zero match (non-alcoholic beer) returns
 * `grams: 0` rather than null: knowing a drink has none is a real answer, and
 * it's what stops "beer" inside "non-alcoholic beer" from being counted.
 */
export function lookupAlcohol(description: string): KnownAlcohol | null {
  const text = stripAsides(description)
  const source = SOURCES.find((s) => s.match.test(text))
  if (!source) return null

  if (source.kind === "per_serving") {
    return { grams: source.grams, label: source.label, oz: null, abv: null }
  }

  // Volume and strength are read from the full text: a parenthetical is often
  // where the size lives ("red wine (6 oz pour)"), and a number there is a
  // measurement rather than a competing drink.
  const oz = parseVolumeOz(description) ?? source.defaultOz
  const abv = parseAbv(description) ?? source.abv
  return { grams: round1(gramsEthanol(oz, abv)), label: source.label, oz, abv }
}

/** Standard drinks for a gram figure, to one decimal. */
export function standardDrinks(grams: number): number {
  return round1(grams / STANDARD_DRINK_G)
}

/**
 * The alcohol to suggest for a logged meal or drink.
 *
 * Table-only, deliberately: unlike caffeine there is no model estimate to
 * fall back on, and a guessed dose is worse than no row at all — it would
 * feed a sleep warning the user can't trace back to anything they drank.
 */
export function resolveAlcoholGrams(estimate: { description: string }): {
  grams: number
  label: string | null
} {
  const known = lookupAlcohol(estimate.description)
  if (!known) return { grams: 0, label: null }
  return { grams: known.grams, label: known.label }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
