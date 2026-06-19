/**
 * Pure math helpers extracted for reuse and testability.
 */

export function smoothStep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

/** Create normalized direction from origin to target (ignores Y) */
export function horizontalDirectionTo(
  from: { x: number; z: number },
  to: { x: number; z: number }
): { x: number; z: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}
