import { COMBAT } from "../config/constants";
import type { PickupKind } from "../types";

export type PickupReward =
  | { kind: "health"; health: number }
  | { kind: "ammo"; amount: number };

export function getPickupReward(
  kind: PickupKind,
  currentHealth: number
): PickupReward | undefined {
  if (kind === "ammo") return { kind, amount: COMBAT.AMMO_PICKUP };
  if (currentHealth >= COMBAT.MAX_HEALTH) return undefined;
  return {
    kind,
    health: Math.min(
      COMBAT.MAX_HEALTH,
      currentHealth + COMBAT.HEALTH_KIT_RESTORE
    ),
  };
}
