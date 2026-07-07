/**
 * The 12-week VO2 Max + pull-up training plan, as structured data.
 *
 * Single source of truth for the in-app plan page and the dashboard
 * "today's session" card. The prose version lives in
 * docs/training-plan-vo2max-pullups.md; keep the two in sync.
 */

/** Monday of week 1, YYYY-MM-DD (local). */
export const PLAN_START_DATE = "2026-07-06"

export const PLAN_WEEKS = 12

/** Week numbers (1-based) with special roles. */
export const BASELINE_WEEK = 1
export const MIDPOINT_TEST_WEEK = 6
export const DELOAD_WEEK = 7
export const FINAL_TEST_WEEK = 12

export type SessionType = "cardio" | "strength" | "rest"

export interface PlanSession {
  /** Stable key for tests and lookups. */
  key:
    | "rest-gtg"
    | "intervals-4x4"
    | "rest-walk"
    | "pull-b"
    | "rest"
    | "pull-a"
    | "intervals-3030"
  title: string
  type: SessionType
  /** Human-readable start time, e.g. "5:45 AM". Empty for rest days. */
  time: string
  /** Rough duration in minutes. 0 for rest days. */
  durationMins: number
  /** Bullet-level details shown on the plan page and dashboard card. */
  details: string[]
}

/**
 * The weekly template, indexed by JS `Date.getDay()` (0 = Sunday).
 * AM lane: Tue/Thu 5:45-6:30, weekends 8:00-9:15.
 */
export const WEEKLY_SCHEDULE: Record<number, PlanSession> = {
  1: {
    key: "rest-gtg",
    title: "Rest",
    type: "rest",
    time: "",
    durationMins: 0,
    details: [
      "Optional: grease-the-groove pull-up sets at home (easy singles/doubles, never to failure)",
    ],
  },
  2: {
    key: "intervals-4x4",
    title: "VO2 Max intervals — 4×4",
    type: "cardio",
    time: "5:45 AM",
    durationMins: 40,
    details: [
      "10-min warm-up, then 4 min @ ~90-95% max HR / 3 min easy recovery",
      "Treadmill or StairMaster",
      "If Oura readiness is red, swap for easy Zone 2 and slide intervals to tomorrow",
    ],
  },
  3: {
    key: "rest-walk",
    title: "Rest",
    type: "rest",
    time: "",
    durationMins: 0,
    details: ["Optional: 20-30 min easy walk after dinner"],
  },
  4: {
    key: "pull-b",
    title: "Pull B — strength",
    type: "strength",
    time: "5:45 AM",
    durationMins: 45,
    details: [
      "Assisted pull-ups 5×4-6 (10-15 lb less assistance than Pull A)",
      "Scapular pulls 3×8 · single-arm DB row 3×8-10/side",
      "Cable face pull 3×12-15 · farmer hold 3×30s",
    ],
  },
  5: {
    key: "rest",
    title: "Rest",
    type: "rest",
    time: "",
    durationMins: 0,
    details: ["Full rest before the weekend sessions"],
  },
  6: {
    key: "pull-a",
    title: "Pull A + Zone 2 finisher",
    type: "strength",
    time: "8:00 AM",
    durationMins: 75,
    details: [
      "Assisted pull-ups 4×6-8 · slow negatives 3×3-5 (5-sec lowering)",
      "Lat pulldown 3×8-12 · seated row 3×10-12 · hollow hold 3×20-30s",
      "Finish with 15-20 min easy Zone 2 (bike/elliptical)",
    ],
  },
  0: {
    key: "intervals-3030",
    title: "30/30 intervals + Zone 2",
    type: "cardio",
    time: "8:00 AM",
    durationMins: 75,
    details: [
      "10-min warm-up, then 30s hard / 30s easy — stationary bike ideal",
      "Weeks 1-2: 2×8 reps · build to 3×10 by week 6",
      "Finish with 30 min Zone 2 cool-down",
    ],
  },
}

export interface PlanPhase {
  /** Inclusive week range this phase covers. */
  fromWeek: number
  toWeek: number
  label: string
  /** Per-session prescriptions that change across the plan. */
  fourByFourRounds: string
  thirtyThirtyReps: string
  pullNote: string
}

export const PLAN_PHASES: PlanPhase[] = [
  {
    fromWeek: 1,
    toWeek: 2,
    label: "Base",
    fourByFourRounds: "3 rounds",
    thirtyThirtyReps: "2 sets of 8",
    pullNote: "Find your working assistance weight; leave 1-2 reps in the tank",
  },
  {
    fromWeek: 3,
    toWeek: 6,
    label: "Build",
    fourByFourRounds: "4 rounds",
    thirtyThirtyReps: "build to 3 sets of 10",
    pullNote: "Drop assistance 5-10 lb each week you hit all prescribed reps",
  },
  {
    fromWeek: 7,
    toWeek: 7,
    label: "Deload",
    fourByFourRounds: "2 rounds (halved)",
    thirtyThirtyReps: "1-2 easy sets",
    pullNote: "Drop one set from every pull exercise; no testing, just recovery",
  },
  {
    fromWeek: 8,
    toWeek: 12,
    label: "Peak",
    fourByFourRounds: "4-5 rounds, nudging pace up",
    thirtyThirtyReps: "3 sets of 10",
    pullNote:
      "Approaching zero assistance: switch to bodyweight sets of max-minus-one, add a rep per week",
  },
]

export interface PlanTest {
  week: number
  title: string
  details: string[]
}

export const PLAN_TESTS: PlanTest[] = [
  {
    week: BASELINE_WEEK,
    title: "Baseline tests",
    details: [
      "Sat: max strict pull-ups (or timed negative) + find assisted 8RM",
      "Sun: Cooper 12-min treadmill test, 1% incline",
      "Log both via Log Test on the dashboard",
    ],
  },
  {
    week: MIDPOINT_TEST_WEEK,
    title: "Week 6 retests",
    details: [
      "Pull-up max replaces Saturday's first exercise",
      "Cooper test replaces Sunday's intervals",
    ],
  },
  {
    week: FINAL_TEST_WEEK,
    title: "Final tests",
    details: [
      "Same protocol as week 6",
      "Expect +5-10% VO2 Max, and 0→3-5 or 5→10-12 pull-ups vs. baseline",
    ],
  },
]
