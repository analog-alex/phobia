import { PointLight } from "@babylonjs/core/Lights/pointLight";
import type { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export interface FacilityLight {
  light: PointLight;
  baseIntensity: number;
  flicker: boolean;
  index: number;
}

export class FacilityLighting {
  private readonly lights: FacilityLight[] = [];
  private readonly active = new Set<FacilityLight>();
  private budget = 4;
  private lightUpdateTimer = 0;
  private time = 0;

  constructor(private readonly scene: Scene) {}

  setBudget(count: number): void {
    this.budget = count;
    this.lightUpdateTimer = 0;
  }

  getActiveCount(): number {
    return this.active.size;
  }

  add(
    position: Vector3,
    color: Color3,
    intensity: number,
    range: number,
    flicker: boolean
  ): void {
    const light = new PointLight("facility light", position, this.scene);
    light.diffuse = color;
    light.range = range;
    light.intensity = 0;
    light.setEnabled(false);
    this.lights.push({
      light,
      baseIntensity: intensity,
      flicker,
      index: this.lights.length,
    });
  }

  update(delta: number, playerPosition: Vector3): void {
    this.time += delta;
    this.lightUpdateTimer -= delta;
    if (this.lightUpdateTimer <= 0) {
      this.lightUpdateTimer = 0.2;
      this.recomputeActive(playerPosition);
    }
    this.active.forEach((entry) => {
      const pulse =
        !entry.flicker ||
        Math.sin(this.time * (13 + entry.index * 0.37)) > -0.78;
      entry.light.intensity = pulse ? entry.baseIntensity : 0.04;
    });
  }

  private recomputeActive(playerPosition: Vector3): void {
    const nearest = [...this.lights]
      .sort(
        (a, b) =>
          Vector3.DistanceSquared(a.light.position, playerPosition) -
          Vector3.DistanceSquared(b.light.position, playerPosition)
      )
      .slice(0, this.budget);
    const next = new Set(nearest);
    this.active.forEach((entry) => {
      if (next.has(entry)) return;
      entry.light.intensity = 0;
      entry.light.setEnabled(false);
    });
    for (const entry of nearest) {
      entry.light.setEnabled(true);
    }
    this.active.clear();
    for (const entry of nearest) {
      this.active.add(entry);
    }
  }
}
