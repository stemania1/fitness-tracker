/**
 * Non-diagnostic "when to seek care" guidance surfaced alongside Oura-derived
 * recovery signals.
 *
 * IMPORTANT: this app is not a medical device and none of these signals
 * diagnose anything. Oura is optical (PPG) — it has no ECG and cannot detect
 * a heart attack. This copy exists to point users toward a clinician for
 * PATTERNS, and toward emergency services for SYMPTOMS. Keep it conservative;
 * never imply the app can rule an emergency in or out.
 */

/** Always-visible reminder that acute symptoms are a 911 matter, not an app one. */
export const EMERGENCY_NOTE =
  "This app and your ring are not medical devices and cannot detect a heart attack or other emergency. If you have chest pain or pressure, pain spreading to the arm/jaw/back, sudden shortness of breath, cold sweat, or fainting, call 911 — don't wait for a device."

/** Trend-based signals that warrant a (non-urgent) clinician conversation. */
export interface SeekCareSignal {
  /** Short label for the pattern. */
  pattern: string
  /** Why it's worth a conversation — framed as screening, not diagnosis. */
  note: string
}

export const SEEK_CARE_SIGNALS: SeekCareSignal[] = [
  {
    pattern: "HRV stays well below baseline for 1-2+ weeks",
    note: "Persistent suppression that doesn't recover with easy days and sleep can reflect more than training fatigue — worth mentioning to a doctor.",
  },
  {
    pattern: "Resting heart rate trends up over weeks for no clear reason",
    note: "A steady unexplained climb (not just a hard training block) is worth a check-up.",
  },
  {
    pattern: "Oura flags an irregular rhythm",
    note: "Not a diagnosis — Oura can't confirm AFib — but a repeated flag is a reason to ask a clinician for a proper ECG.",
  },
  {
    pattern: "Symptom Radar or temperature stays elevated",
    note: "Persistent deviations can precede illness; rest, and see a doctor if symptoms develop.",
  },
]

/**
 * Whether a given HRV-baseline status should nudge toward a clinician.
 * Only sustained low (overreaching-level) suppression qualifies — a single
 * "suppressed" week is a training cue, not a medical one.
 */
export function shouldSuggestClinician(
  hrvStatus: "normal" | "suppressed" | "low" | "insufficient"
): boolean {
  return hrvStatus === "low"
}
