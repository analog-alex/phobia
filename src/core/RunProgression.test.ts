import { describe, expect, test } from "bun:test";
import { RunProgression } from "./RunProgression";

describe("run progression", () => {
  test("starts unarmed in Waste Disposal", () => {
    const run = new RunProgression();
    expect(run.phase).toBe("waste");
    expect(run.hasWeapon).toBe(false);
    expect(run.allowsWeaponAction).toBe(false);
  });

  test.each([
    "xmb",
    "rifle",
  ] as const)("locks the first %s selection for the run", (kind) => {
    const run = new RunProgression();
    expect(run.selectWeapon(kind)).toBe(true);
    expect(run.hasWeapon).toBe(true);
    expect(run.selectWeapon(kind === "xmb" ? "rifle" : "xmb")).toBe(false);
    expect(run.selectedWeapon).toBe(kind);
  });

  test("keeps the waste elevator locked until its infected is dead", () => {
    const run = new RunProgression();
    expect(run.ascendWaste(false)).toBe(false);
    expect(run.phase).toBe("waste");
    expect(run.ascendWaste(true)).toBe(true);
    expect(run.phase).toBe("sector7");
  });

  test("requires Sector 7 to be clear before final extraction", () => {
    const run = new RunProgression();
    run.ascendWaste(true);
    expect(run.completeSector(1)).toBe(false);
    expect(run.completeSector(0)).toBe(true);
    expect(run.phase).toBe("complete");
  });
});
