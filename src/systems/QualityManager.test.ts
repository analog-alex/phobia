import { describe, expect, test } from "bun:test";
import {
  AdaptiveQualityController,
  QUALITY_SETTINGS,
  QualityManager,
} from "./QualityManager";

describe("quality presets", () => {
  test("map to the planned render settings", () => {
    expect(QUALITY_SETTINGS.high).toMatchObject({
      renderScale: 0.78,
      samples: 1,
      dynamicLights: 3,
    });
    expect(QUALITY_SETTINGS.medium).toMatchObject({
      renderScale: 0.7,
      bloom: false,
      dynamicLights: 2,
    });
    expect(QUALITY_SETTINGS.low).toMatchObject({
      renderScale: 0.55,
      bloom: false,
      dynamicLights: 1,
    });
  });
});

describe("adaptive quality", () => {
  test("downgrades after two sustained slow seconds", () => {
    const controller = new AdaptiveQualityController("medium");
    expect(controller.update(20, 1, true)).toBeNull();
    expect(controller.update(20, 1, true)).toBe("low");
  });

  test("upgrades after ten sustained fast seconds", () => {
    const controller = new AdaptiveQualityController("medium");
    for (let second = 0; second < 9; second += 1)
      expect(controller.update(12, 1, true)).toBeNull();
    expect(controller.update(12, 1, true)).toBe("high");
    expect(controller.tier).toBe("high");
  });

  test("ignores paused frames and enforces cooldown", () => {
    const controller = new AdaptiveQualityController("medium");
    expect(controller.update(30, 10, false)).toBeNull();
    expect(controller.tier).toBe("medium");
    controller.update(30, 1, true);
    expect(controller.update(30, 1, true)).toBe("low");
    for (let second = 0; second < 7; second += 1)
      expect(controller.update(10, 1, true)).toBeNull();
    expect(controller.tier).toBe("low");
  });
});

test("manual selection persists and overrides auto", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
  const applied: string[] = [];
  const manager = new QualityManager((tier) => applied.push(tier), storage);
  manager.initialize();
  manager.setPreset("high");
  manager.update(30, 10, true);
  expect(values.get("phobia.graphicsPreset")).toBe("high");
  expect(applied).toEqual(["low", "high"]);
});
