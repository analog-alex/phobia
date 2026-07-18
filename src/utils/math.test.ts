import { describe, expect, test } from "bun:test";
import { horizontalDistanceSquared } from "./math";

describe("horizontal distance", () => {
  test("ignores the camera height when checking a floor pickup", () => {
    const pickup = { x: 6, y: 0.3, z: 19 };
    const camera = { x: 6, y: 1.72, z: 19 };

    expect(horizontalDistanceSquared(pickup, camera)).toBe(0);
  });

  test("keeps the full collection radius on the floor plane", () => {
    const pickup = { x: 0, z: 0 };

    expect(horizontalDistanceSquared(pickup, { x: 1.4, z: 0 })).toBeLessThan(
      1.45 ** 2
    );
    expect(horizontalDistanceSquared(pickup, { x: 1.5, z: 0 })).toBeGreaterThan(
      1.45 ** 2
    );
  });
});
