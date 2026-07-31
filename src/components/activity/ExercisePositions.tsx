"use client"

import { movementPattern, isStaticHold, type MovementPattern } from "@/lib/movement-pattern"

/**
 * Start and end positions for a movement, drawn as two stick figures.
 *
 * The muscle map next to it answers "what does this work"; this answers "what
 * do I actually do", which is the question an unfamiliar machine name leaves
 * you with mid-workout. Poses are keyed off the movement PATTERN rather than
 * the exercise, so all 72 catalog entries are covered by a dozen drawings and
 * a new exercise inherits one for free.
 *
 * Stylised, not anatomical — same spirit as MuscleMap.
 */

type Pt = [number, number]

interface Pose {
  /** Head centre. */
  head: Pt
  /** Torso polyline, shoulder through hip. */
  torso: Pt[]
  /** Limb polylines, each starting at the body. */
  limbs: Pt[][]
  /** Where a weight sits, if the movement holds one. */
  load?: Pt[]
  /** Fixed scenery: the floor, a bench, an overhead bar. */
  props?: Array<"floor" | "bench" | "bar-overhead" | "seat">
}

const ACTIVE = "#7c3aed"
const BASE = "#9ca3af"
const PROP = "#d1d5db"

/** Standing side-view legs, reused by most upright patterns. */
const LEGS_SIDE: Pt[][] = [[[45, 66], [45, 88], [45, 108]]]
/** Standing front-view legs. */
const LEGS_FRONT: Pt[][] = [
  [[45, 66], [37, 88], [35, 108]],
  [[45, 66], [53, 88], [55, 108]],
]

const POSES: Record<MovementPattern, { start: Pose; end: Pose; labels?: [string, string] }> = {
  "overhead-press": {
    start: {
      head: [43, 19],
      torso: [[43, 28], [43, 66]],
      limbs: [[[43, 32], [59, 44], [61, 30]], ...LEGS_SIDE],
      load: [[61, 30]],
      props: ["floor"],
    },
    end: {
      head: [43, 19],
      torso: [[43, 28], [43, 66]],
      limbs: [[[43, 32], [57, 20], [55, 5]], ...LEGS_SIDE],
      load: [[55, 5]],
      props: ["floor"],
    },
  },
  "horizontal-press": {
    start: {
      head: [18, 66],
      torso: [[28, 70], [60, 76]],
      limbs: [
        [[30, 70], [27, 58], [40, 56]],
        [[60, 76], [70, 92], [80, 104]],
      ],
      load: [[40, 56]],
      props: ["floor", "bench"],
    },
    end: {
      head: [18, 66],
      torso: [[28, 70], [60, 76]],
      limbs: [
        [[30, 70], [34, 54], [39, 36]],
        [[60, 76], [70, 92], [80, 104]],
      ],
      load: [[39, 36]],
      props: ["floor", "bench"],
    },
    labels: ["down", "press"],
  },
  "vertical-pull": {
    start: {
      head: [45, 34],
      torso: [[45, 43], [45, 78]],
      limbs: [[[45, 43], [45, 28], [45, 14]], [[45, 78], [45, 98], [45, 114]]],
      props: ["bar-overhead"],
    },
    end: {
      head: [45, 22],
      torso: [[45, 31], [45, 66]],
      limbs: [[[45, 31], [34, 22], [45, 14]], [[45, 66], [45, 88], [45, 104]]],
      props: ["bar-overhead"],
    },
    labels: ["hang", "pull up"],
  },
  "horizontal-pull": {
    start: {
      head: [58, 34],
      torso: [[54, 42], [38, 68]],
      limbs: [
        [[54, 44], [62, 56], [68, 66]],
        [[38, 68], [34, 88], [38, 108]],
      ],
      load: [[68, 66]],
      props: ["floor"],
    },
    end: {
      head: [58, 34],
      torso: [[54, 42], [38, 68]],
      limbs: [
        [[54, 44], [50, 58], [58, 62]],
        [[38, 68], [34, 88], [38, 108]],
      ],
      load: [[58, 62]],
      props: ["floor"],
    },
    labels: ["reach", "row"],
  },
  fly: {
    start: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 33], [26, 36], [12, 40]], [[45, 33], [64, 36], [78, 40]], ...LEGS_FRONT],
      load: [[12, 40], [78, 40]],
      props: ["floor"],
    },
    end: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 33], [38, 34], [40, 30]], [[45, 33], [52, 34], [50, 30]], ...LEGS_FRONT],
      load: [[40, 30], [50, 30]],
      props: ["floor"],
    },
    labels: ["open", "squeeze"],
  },
  curl: {
    start: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 32], [50, 48], [50, 64]], ...LEGS_SIDE],
      load: [[50, 64]],
      props: ["floor"],
    },
    end: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 32], [50, 48], [42, 34]], ...LEGS_SIDE],
      load: [[42, 34]],
      props: ["floor"],
    },
    labels: ["extend", "curl"],
  },
  "tricep-extension": {
    start: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 32], [52, 44], [40, 40]], ...LEGS_SIDE],
      load: [[40, 40]],
      props: ["floor"],
    },
    end: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 32], [52, 44], [56, 60]], ...LEGS_SIDE],
      load: [[56, 60]],
      props: ["floor"],
    },
    labels: ["bent", "extend"],
  },
  "lateral-raise": {
    start: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 33], [40, 48], [38, 62]], [[45, 33], [50, 48], [52, 62]], ...LEGS_FRONT],
      load: [[38, 62], [52, 62]],
      props: ["floor"],
    },
    end: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 33], [28, 34], [14, 33]], [[45, 33], [62, 34], [76, 33]], ...LEGS_FRONT],
      load: [[14, 33], [76, 33]],
      props: ["floor"],
    },
    labels: ["down", "raise"],
  },
  shrug: {
    start: {
      head: [45, 18],
      torso: [[45, 29], [45, 66]],
      limbs: [[[45, 33], [36, 48], [35, 64]], [[45, 33], [54, 48], [55, 64]], ...LEGS_FRONT],
      load: [[35, 64], [55, 64]],
      props: ["floor"],
    },
    end: {
      head: [45, 18],
      torso: [[45, 25], [45, 66]],
      limbs: [[[45, 27], [36, 44], [35, 60]], [[45, 27], [54, 44], [55, 60]], ...LEGS_FRONT],
      load: [[35, 60], [55, 60]],
      props: ["floor"],
    },
    labels: ["hang", "shrug up"],
  },
  squat: {
    start: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 31], [52, 44], [52, 58]], ...LEGS_SIDE],
      props: ["floor"],
    },
    end: {
      head: [52, 42],
      torso: [[49, 51], [39, 78]],
      limbs: [[[49, 53], [61, 58], [66, 52]], [[39, 78], [59, 90], [45, 108]]],
      props: ["floor"],
    },
    labels: ["stand", "sit back"],
  },
  hinge: {
    start: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 31], [47, 48], [47, 64]], ...LEGS_SIDE],
      load: [[47, 64]],
      props: ["floor"],
    },
    end: {
      head: [62, 40],
      torso: [[57, 46], [42, 66]],
      limbs: [[[57, 48], [58, 62], [58, 78]], [[42, 66], [40, 88], [42, 108]]],
      load: [[58, 78]],
      props: ["floor"],
    },
    labels: ["stand", "hinge"],
  },
  "leg-extension": {
    start: {
      head: [30, 34],
      torso: [[33, 43], [36, 70]],
      limbs: [[[33, 47], [44, 56], [50, 62]], [[36, 70], [56, 72], [58, 94]]],
      props: ["seat"],
    },
    end: {
      head: [30, 34],
      torso: [[33, 43], [36, 70]],
      limbs: [[[33, 47], [44, 56], [50, 62]], [[36, 70], [56, 72], [80, 66]]],
      props: ["seat"],
    },
    labels: ["bent", "straighten"],
  },
  "leg-curl": {
    start: {
      head: [30, 34],
      torso: [[33, 43], [36, 70]],
      limbs: [[[33, 47], [44, 56], [50, 62]], [[36, 70], [56, 72], [80, 70]]],
      props: ["seat"],
    },
    end: {
      head: [30, 34],
      torso: [[33, 43], [36, 70]],
      limbs: [[[33, 47], [44, 56], [50, 62]], [[36, 70], [56, 72], [62, 94]]],
      props: ["seat"],
    },
    labels: ["straight", "curl under"],
  },
  "calf-raise": {
    start: {
      head: [45, 18],
      torso: [[45, 27], [45, 66]],
      limbs: [[[45, 31], [48, 46], [48, 62]], [[45, 66], [45, 88], [45, 108]]],
      props: ["floor"],
    },
    end: {
      head: [45, 12],
      torso: [[45, 21], [45, 60]],
      limbs: [[[45, 25], [48, 40], [48, 56]], [[45, 60], [45, 84], [45, 104]]],
      props: ["floor"],
    },
    labels: ["heels down", "up on toes"],
  },
  crunch: {
    start: {
      head: [24, 62],
      torso: [[32, 66], [58, 70]],
      limbs: [[[34, 66], [30, 54], [38, 52]], [[58, 70], [70, 56], [82, 68]]],
      props: ["floor"],
    },
    end: {
      head: [32, 46],
      torso: [[38, 54], [58, 70]],
      limbs: [[[40, 54], [36, 44], [44, 40]], [[58, 70], [70, 56], [82, 68]]],
      props: ["floor"],
    },
    labels: ["lie back", "curl up"],
  },
  hold: {
    start: {
      head: [18, 64],
      torso: [[28, 69], [58, 86]],
      limbs: [[[28, 71], [26, 96], [42, 110]], [[58, 86], [72, 98], [86, 110]]],
      props: ["floor"],
    },
    end: {
      head: [18, 64],
      torso: [[28, 69], [58, 86]],
      limbs: [[[28, 71], [26, 96], [42, 110]], [[58, 86], [72, 98], [86, 110]]],
      props: ["floor"],
    },
    labels: ["hold", "hold"],
  },
}

function toPath(points: Pt[]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ")
}

function Figure({ pose, accent }: { pose: Pose; accent: boolean }) {
  const stroke = accent ? ACTIVE : BASE
  return (
    <g>
      {pose.props?.includes("floor") && (
        <line x1="6" y1="112" x2="84" y2="112" stroke={PROP} strokeWidth="2.5" strokeLinecap="round" />
      )}
      {pose.props?.includes("bench") && (
        <line x1="14" y1="78" x2="76" y2="78" stroke={PROP} strokeWidth="4" strokeLinecap="round" />
      )}
      {pose.props?.includes("seat") && (
        <>
          <line x1="16" y1="74" x2="56" y2="74" stroke={PROP} strokeWidth="4" strokeLinecap="round" />
          <line x1="19" y1="74" x2="19" y2="46" stroke={PROP} strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {pose.props?.includes("bar-overhead") && (
        <line x1="16" y1="12" x2="74" y2="12" stroke={PROP} strokeWidth="3" strokeLinecap="round" />
      )}

      <circle cx={pose.head[0]} cy={pose.head[1]} r="6.5" fill={stroke} />
      <path d={toPath(pose.torso)} stroke={stroke} strokeWidth="4" strokeLinecap="round" fill="none" />
      {pose.limbs.map((limb, i) => (
        <path
          key={i}
          d={toPath(limb)}
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
      {pose.load?.map(([x, y], i) => (
        <rect key={i} x={x - 5} y={y - 2.5} width="10" height="5" rx="2" fill={stroke} />
      ))}
    </g>
  )
}

interface ExercisePositionsProps {
  exerciseId: string
  className?: string
}

/**
 * Renders nothing when the exercise has no meaningful two-position shape
 * (cardio, stretches) — the caller doesn't need to check.
 */
export function ExercisePositions({ exerciseId, className }: ExercisePositionsProps) {
  const pattern = movementPattern(exerciseId)
  if (!pattern) return null

  const { start, end, labels } = POSES[pattern]
  const isHold = isStaticHold(pattern)
  const [startLabel, endLabel] = labels ?? ["start", "end"]

  if (isHold) {
    return (
      <figure className={className}>
        <svg viewBox="0 0 90 120" role="img" aria-label="Hold position" className="h-24 w-auto">
          <Figure pose={start} accent />
        </svg>
        <figcaption className="text-center text-[10px] text-gray-400">hold</figcaption>
      </figure>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-end justify-center gap-1">
        <figure>
          <svg
            viewBox="0 0 90 120"
            role="img"
            aria-label={`Start position: ${startLabel}`}
            className="h-24 w-auto"
          >
            <Figure pose={start} accent={false} />
          </svg>
          <figcaption className="text-center text-[10px] text-gray-400">
            {startLabel}
          </figcaption>
        </figure>

        <svg
          viewBox="0 0 16 120"
          className="h-24 w-3 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M3 58 L11 58 M7 54 L11 58 L7 62"
            stroke={PROP}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>

        <figure>
          <svg
            viewBox="0 0 90 120"
            role="img"
            aria-label={`End position: ${endLabel}`}
            className="h-24 w-auto"
          >
            <Figure pose={end} accent />
          </svg>
          <figcaption className="text-center text-[10px] font-medium text-purple-600">
            {endLabel}
          </figcaption>
        </figure>
      </div>
    </div>
  )
}
