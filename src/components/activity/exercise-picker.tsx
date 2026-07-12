"use client"

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { exercises, type ExerciseDefinition } from "@/data/exercises"
import { equipment } from "@/data/equipment"
import { MUSCLE_GROUPS, EQUIPMENT_CATEGORIES } from "@/lib/constants"
import { formatMuscleGroup } from "@/lib/muscle-groups"
import { cn } from "@/lib/utils"

interface ExercisePickerProps {
  onSelect: (exercise: ExerciseDefinition) => void
  onClose: () => void
}

export function ExercisePicker({ onSelect, onClose }: ExercisePickerProps) {
  const [search, setSearch] = useState("")
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null)
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null)

  const equipmentMap = useMemo(() => {
    const map = new Map<string, string>()
    equipment.forEach((e) => map.set(e.id, e.name))
    return map
  }, [])

  const equipmentCategoryMap = useMemo(() => {
    const map = new Map<string, string>()
    equipment.forEach((e) => map.set(e.id, e.category))
    return map
  }, [])

  const filtered = useMemo(() => {
    let result = exercises
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.muscleGroups.some((mg) => mg.toLowerCase().includes(q))
      )
    }
    if (muscleFilter) {
      result = result.filter((e) => e.muscleGroups.includes(muscleFilter))
    }
    if (equipmentFilter) {
      result = result.filter((e) => {
        if (!e.equipmentId) return false
        return equipmentCategoryMap.get(e.equipmentId) === equipmentFilter
      })
    }
    return result
  }, [search, muscleFilter, equipmentFilter, equipmentCategoryMap])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">Add Exercise</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Search */}
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
      </div>

      {/* Muscle group filter chips */}
      <div className="border-b border-gray-100 px-4 py-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setMuscleFilter(null)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              !muscleFilter
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            All
          </button>
          {MUSCLE_GROUPS.map((mg) => (
            <button
              key={mg}
              onClick={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                muscleFilter === mg
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {formatMuscleGroup(mg)}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment filter chips */}
      <div className="border-b border-gray-100 px-4 py-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setEquipmentFilter(null)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              !equipmentFilter
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            All Equipment
          </button>
          {EQUIPMENT_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() =>
                setEquipmentFilter(
                  equipmentFilter === cat.value ? null : cat.value
                )
              }
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                equipmentFilter === cat.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Search className="mb-2 h-8 w-8" />
            <p className="text-sm">No exercises found</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((exercise) => (
              <li key={exercise.id}>
                <button
                  onClick={() => onSelect(exercise)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors active:bg-purple-50 hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">
                    {exercise.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {exercise.muscleGroups.map((mg) => (
                      <Badge key={mg} variant="default" className="text-[10px]">
                        {formatMuscleGroup(mg)}
                      </Badge>
                    ))}
                    {exercise.equipmentId && (
                      <Badge variant="secondary" className="text-[10px]">
                        {equipmentMap.get(exercise.equipmentId) ??
                          exercise.equipmentId}
                      </Badge>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
