/**
 * Shared entity contracts and tags.
 * Replaces ad-hoc stringly-typed metadata where practical.
 * Keep lightweight for Babylon metadata.
 */

import type { Enemy } from "../core/Enemy";

export type PickupKind = "health" | "ammo";

export type EnemyVariant = "infected" | "runner" | "acid";
export type EnemyModel = "explorer";

/** Discriminated tags for mesh.metadata (kept simple for perf + Babylon pick) */
export type EntityMetadata =
  | { enemy: Enemy }
  | { pickup: PickupKind }
  | { collision: true }
  | { extraction: true }
  | { corpse: true };

/** Narrow type guards for metadata */
export function isEnemyMetadata(m: unknown): m is { enemy: Enemy } {
  return !!m && typeof m === "object" && "enemy" in m;
}

export function isPickupMetadata(m: unknown): m is { pickup: PickupKind } {
  return !!m && typeof m === "object" && "pickup" in m;
}

export function isCollisionMetadata(m: unknown): m is { collision: true } {
  return (
    !!m &&
    typeof m === "object" &&
    "collision" in m &&
    (m as { collision: unknown }).collision === true
  );
}

export function isExtractionMetadata(m: unknown): m is { extraction: true } {
  return (
    !!m &&
    typeof m === "object" &&
    "extraction" in m &&
    (m as { extraction: unknown }).extraction === true
  );
}
