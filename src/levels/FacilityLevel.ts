import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { EnemyVariant } from "../types";

export interface EnemySpawn {
  position: Vector3;
  variant: EnemyVariant;
}

export interface FacilityLevel {
  readonly elevatorConsole: Mesh;
  readonly enemySpawns: readonly EnemySpawn[];
  update(delta: number, playerPosition: Vector3): void;
  setActive(active: boolean): void;
  setLightBudget(count: number): void;
  getActiveLightCount(): number;
}
