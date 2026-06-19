import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import { PerfCounter } from "@babylonjs/core/Misc/perfCounter";
import type { Scene } from "@babylonjs/core/scene";
import type { QualityManager } from "../systems/QualityManager";

export class Diagnostics {
  private readonly root: HTMLElement;
  private readonly instrumentation: SceneInstrumentation;
  private readonly frameTimes: number[] = [];
  private visible = false;
  private elapsed = 0;

  constructor(
    private readonly engine: Engine,
    private readonly scene: Scene,
    private readonly quality: QualityManager,
    private readonly activeLights: () => number
  ) {
    const root = document.getElementById("diagnostics");
    if (!root) throw new Error("Missing diagnostics element");
    this.root = root;
    PerfCounter.Enabled = true;
    this.instrumentation = new SceneInstrumentation(scene);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.root.classList.toggle("visible", this.visible);
  }

  update(frameMs: number, delta: number): void {
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    if (!this.visible) return;
    this.elapsed += delta;
    if (this.elapsed < 0.25) return;
    this.elapsed = 0;

    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const average =
      this.frameTimes.reduce((sum, value) => sum + value, 0) /
      Math.max(1, this.frameTimes.length);
    const p95 =
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ??
      0;
    const scale = 1 / this.engine.getHardwareScalingLevel();
    this.root.textContent = [
      `FPS        ${this.engine.getFps().toFixed(0)}`,
      `FRAME AVG  ${average.toFixed(1)} ms`,
      `FRAME P95  ${p95.toFixed(1)} ms`,
      `DRAWS      ${this.instrumentation.drawCallsCounter.current}`,
      `MESHES     ${this.scene.getActiveMeshes().length}`,
      `TRIANGLES  ${Math.round(this.scene.getActiveIndices() / 3).toLocaleString()}`,
      `LIGHTS     ${this.activeLights()}`,
      `SCALE      ${Math.round(scale * 100)}%`,
      `QUALITY    ${this.quality.getPreset().toUpperCase()} / ${this.quality.getTier().toUpperCase()}`,
    ].join("\n");
  }
}
