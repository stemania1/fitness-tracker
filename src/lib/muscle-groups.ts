/**
 * Canonical display label for a muscle-group token. The static catalog and the
 * DB enum drifted ("quads" vs "quadriceps", "full_body" vs "full body"), and
 * different views formatted them differently (some with a CSS `capitalize`,
 * some raw). One helper normalizes aliases and returns a ready-to-render label.
 */

/** Aliases → canonical token. */
const ALIASES: Record<string, string> = {
  quadriceps: "quads",
  hamstring: "hamstrings",
  glute: "glutes",
  ab: "abs",
  oblique: "obliques",
  lat: "lats",
}

/** Explicit display strings where simple capitalization isn't enough. */
const DISPLAY: Record<string, string> = {
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  lats: "Lats",
  abs: "Abs",
  obliques: "Obliques",
  full_body: "Full body",
  upper_back: "Upper back",
  lower_back: "Lower back",
}

export function formatMuscleGroup(mg: string): string {
  const key = mg.trim().toLowerCase()
  const canonical = ALIASES[key] ?? key
  if (DISPLAY[canonical]) return DISPLAY[canonical]
  const spaced = canonical.replace(/_/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
