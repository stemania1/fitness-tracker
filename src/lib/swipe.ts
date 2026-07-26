/**
 * Pure gesture helper: given the horizontal and vertical travel of a touch
 * (end minus start), decide whether it was a deliberate left/right swipe.
 * Ignores small movements and anything more vertical than horizontal (a
 * scroll), so it doesn't fire on taps or list scrolls.
 */
export function swipeDirection(
  dx: number,
  dy: number,
  threshold = 40
): "left" | "right" | null {
  if (Math.abs(dx) < threshold) return null
  if (Math.abs(dx) <= Math.abs(dy)) return null
  return dx < 0 ? "left" : "right"
}
