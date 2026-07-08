/**
 * VO2 Max percentile reference standards from the FRIEND registry
 * (Fitness Registry and the Importance of Exercise National Database),
 * directly-measured maximal treadmill tests — Kaminsky et al.,
 * Mayo Clinic Proceedings 2015.
 *
 * IMPORTANT: only brackets whose published values have been verified are
 * listed here. Percentile display falls back to the qualitative age/sex
 * rating (src/lib/vo2max.ts) for any bracket not present. Add a bracket
 * only after confirming its row against the source table — do not
 * interpolate or estimate rows into this file.
 */

export type NormSex = "male" | "female"

export interface Vo2Norm {
  sex: NormSex
  /** Inclusive age range this row covers. */
  minAge: number
  maxAge: number
  /**
   * Published percentile → VO2 Max (ml/kg/min) breakpoints, ascending by
   * percentile. Used for monotone-linear interpolation of a reading's
   * percentile rank.
   */
  breakpoints: Array<{ percentile: number; vo2: number }>
}

export const FRIEND_TREADMILL_NORMS: Vo2Norm[] = [
  {
    // Verified: FRIEND treadmill, men 50-59.
    sex: "male",
    minAge: 50,
    maxAge: 59,
    breakpoints: [
      { percentile: 5, vo2: 20.9 },
      { percentile: 10, vo2: 22.8 },
      { percentile: 25, vo2: 27.1 },
      { percentile: 50, vo2: 32.6 },
      { percentile: 75, vo2: 39.7 },
      { percentile: 90, vo2: 45.6 },
      { percentile: 95, vo2: 50.7 },
    ],
  },
]

/** Find the verified norm row for an age/sex, or null if none exists. */
export function findNorm(
  age: number | null | undefined,
  sex: "male" | "female" | "other" | null | undefined
): Vo2Norm | null {
  if (age == null || !Number.isFinite(age)) return null
  if (sex !== "male" && sex !== "female") return null
  return (
    FRIEND_TREADMILL_NORMS.find(
      (n) => n.sex === sex && age >= n.minAge && age <= n.maxAge
    ) ?? null
  )
}
