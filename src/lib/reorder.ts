/**
 * Move an item within a list from one index to another, returning a new array.
 * Used by drag-and-drop reordering (template exercises). Pure + tested.
 */
export function reorderList<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = arr.slice()
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= next.length ||
    to >= next.length
  ) {
    return next
  }
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
