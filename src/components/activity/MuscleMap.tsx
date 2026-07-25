"use client"

/**
 * A simple generated diagram of which muscles an exercise works: a front and
 * back body silhouette with the active muscle groups highlighted. Driven
 * entirely by the exercise's `muscleGroups`, so every exercise gets one with
 * no per-exercise artwork. Stylized, not anatomical.
 */

type Group =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "back"
  | "core"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "full_body"

const ACTIVE = "#7c3aed" // purple-600
const BASE = "#e5e7eb" // gray-200

interface MuscleMapProps {
  groups: string[]
  className?: string
}

export function MuscleMap({ groups, className }: MuscleMapProps) {
  const set = new Set(groups)
  const on = (g: Group) => set.has(g) || set.has("full_body")
  const fill = (g: Group) => (on(g) ? ACTIVE : BASE)

  return (
    <svg
      viewBox="0 0 200 160"
      className={className}
      role="img"
      aria-label={`Muscles worked: ${groups.join(", ") || "none"}`}
    >
      {/* ── Front view ── */}
      <g transform="translate(8,6)">
        <text x="34" y="150" textAnchor="middle" className="fill-gray-400" fontSize="9">
          front
        </text>
        {/* body base */}
        <circle cx="34" cy="12" r="9" fill={BASE} />
        <rect x="20" y="22" width="28" height="40" rx="8" fill={BASE} />
        <rect x="10" y="24" width="9" height="34" rx="4" fill={BASE} />
        <rect x="49" y="24" width="9" height="34" rx="4" fill={BASE} />
        <rect x="21" y="62" width="12" height="46" rx="5" fill={BASE} />
        <rect x="35" y="62" width="12" height="46" rx="5" fill={BASE} />
        {/* muscles */}
        <rect x="21" y="24" width="12" height="12" rx="3" fill={fill("chest")} />
        <rect x="35" y="24" width="12" height="12" rx="3" fill={fill("chest")} />
        <circle cx="16" cy="26" r="5" fill={fill("shoulders")} />
        <circle cx="52" cy="26" r="5" fill={fill("shoulders")} />
        <rect x="11" y="32" width="7" height="14" rx="3" fill={fill("biceps")} />
        <rect x="50" y="32" width="7" height="14" rx="3" fill={fill("biceps")} />
        <rect x="24" y="38" width="20" height="22" rx="4" fill={fill("core")} />
        <rect x="22" y="64" width="10" height="26" rx="4" fill={fill("quads")} />
        <rect x="36" y="64" width="10" height="26" rx="4" fill={fill("quads")} />
        <rect x="23" y="96" width="8" height="12" rx="3" fill={fill("calves")} />
        <rect x="37" y="96" width="8" height="12" rx="3" fill={fill("calves")} />
      </g>

      {/* ── Back view ── */}
      <g transform="translate(108,6)">
        <text x="34" y="150" textAnchor="middle" className="fill-gray-400" fontSize="9">
          back
        </text>
        <circle cx="34" cy="12" r="9" fill={BASE} />
        <rect x="20" y="22" width="28" height="40" rx="8" fill={BASE} />
        <rect x="10" y="24" width="9" height="34" rx="4" fill={BASE} />
        <rect x="49" y="24" width="9" height="34" rx="4" fill={BASE} />
        <rect x="21" y="62" width="12" height="46" rx="5" fill={BASE} />
        <rect x="35" y="62" width="12" height="46" rx="5" fill={BASE} />
        {/* muscles */}
        <circle cx="16" cy="26" r="5" fill={fill("shoulders")} />
        <circle cx="52" cy="26" r="5" fill={fill("shoulders")} />
        <rect x="22" y="24" width="24" height="24" rx="5" fill={fill("back")} />
        <rect x="11" y="32" width="7" height="14" rx="3" fill={fill("triceps")} />
        <rect x="50" y="32" width="7" height="14" rx="3" fill={fill("triceps")} />
        <rect x="22" y="50" width="24" height="12" rx="4" fill={fill("glutes")} />
        <rect x="22" y="64" width="10" height="26" rx="4" fill={fill("hamstrings")} />
        <rect x="36" y="64" width="10" height="26" rx="4" fill={fill("hamstrings")} />
        <rect x="23" y="96" width="8" height="12" rx="3" fill={fill("calves")} />
        <rect x="37" y="96" width="8" height="12" rx="3" fill={fill("calves")} />
      </g>
    </svg>
  )
}
