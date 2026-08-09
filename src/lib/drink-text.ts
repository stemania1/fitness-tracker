/**
 * Reading a drink out of a free-text description.
 *
 * Shared by the caffeine and alcohol tables: both have to answer "how much
 * liquid is this?" and "which words actually name the drink?" from the same
 * vision-model prose, and the answers must not diverge between them.
 */

const ML_PER_OZ = 29.5735

/**
 * The drink volume a description states, in fluid ounces, or null when it
 * doesn't state one. Handles "32 oz", "16.9 fl oz", "500ml", "1.5 L", and the
 * bare "can" that means 12 oz to everyone who has held one.
 */
export function parseVolumeOz(description: string): number | null {
  const oz = description.match(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?(?:oz\b|ounce)/i)
  if (oz) return Number(oz[1])

  const ml = description.match(/(\d+(?:\.\d+)?)\s*ml\b/i)
  if (ml) return Number(ml[1]) / ML_PER_OZ

  // Require a digit before "L" so "Light beer" and similar can't read as litres.
  const litres = description.match(/(\d+(?:\.\d+)?)\s*(?:l\b|liter|litre)/i)
  if (litres) return Number(litres[1]) * (1000 / ML_PER_OZ)

  if (/\bcan\b/i.test(description)) return 12

  return null
}

/**
 * Drop parenthetical asides before matching a drink name.
 *
 * A vision model hedges inside parentheses, and the hedge names things that
 * aren't on the plate: "Glass of milk (or milky beverage like chai latte)" is
 * milk, but the aside says "latte" and a naive match reads it as 128mg of
 * espresso. The food is what's outside the parentheses; what's inside is a
 * clarification, an example, or a guess.
 *
 * Found by a backfill dry run over real history, which is the only reason
 * that milk didn't get 128mg written against it.
 */
export function stripAsides(description: string): string {
  return description.replace(/\([^)]*\)/g, " ")
}

/** Millilitres in a US fluid ounce, for anything converting volumes. */
export { ML_PER_OZ }
