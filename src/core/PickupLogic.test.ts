import { describe, expect, test } from "bun:test";
import { getPickupReward } from "./PickupLogic";

describe("pickup rewards", () => {
  test("ammo crates add 18 reserve rounds", () => {
    expect(getPickupReward("ammo", 100)).toEqual({
      kind: "ammo",
      amount: 18,
    });
  });

  test("health kits restore 35 health up to the maximum", () => {
    expect(getPickupReward("health", 40)).toEqual({
      kind: "health",
      health: 75,
    });
    expect(getPickupReward("health", 80)).toEqual({
      kind: "health",
      health: 100,
    });
  });

  test("health kits remain available while health is already full", () => {
    expect(getPickupReward("health", 100)).toBeUndefined();
  });
});
