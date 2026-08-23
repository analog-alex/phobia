import type { Material } from "@babylonjs/core/Materials/material";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Vector3 as BabylonVector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { LEVEL } from "../config/constants";
import type { MaterialLibrary } from "../core/MaterialLibrary";
import { createElevatorLabel } from "./ElevatorLabel";

type BatchBox = (
  name: string,
  size: Vector3,
  position: Vector3,
  material: Material
) => void;

interface ElevatorOptions {
  scene: Scene;
  materials: MaterialLibrary;
  z: number;
  label: string;
  accent: Material;
  batchBox: BatchBox;
  buttonX?: number;
}

export interface ElevatorHandle {
  button: Mesh;
  updateDoors(delta: number, open: boolean): void;
}

const DOOR_CLOSED_X = 1.84;
const DOOR_LERP_RATE = 2.4;

export function createElevator({
  scene,
  materials,
  z,
  label,
  accent,
  batchBox,
  buttonX = 4.38,
}: ElevatorOptions): ElevatorHandle {
  batchBox(
    "elevator backing",
    new BabylonVector3(12, 4.6, 0.62),
    new BabylonVector3(0, 2.2, z),
    materials.dark
  );
  const leftDoor = CreateBox(
    "left elevator door",
    { width: 3.62, height: 3.65, depth: 0.24 },
    scene
  );
  leftDoor.position.set(-DOOR_CLOSED_X, 1.86, z - 0.34);
  leftDoor.material = materials.steel;
  leftDoor.isPickable = false;

  const rightDoor = CreateBox(
    "right elevator door",
    { width: 3.62, height: 3.65, depth: 0.24 },
    scene
  );
  rightDoor.position.set(DOOR_CLOSED_X, 1.86, z - 0.34);
  rightDoor.material = materials.steel;
  rightDoor.isPickable = false;

  batchBox(
    "elevator center seal",
    new BabylonVector3(0.12, 3.7, 0.12),
    new BabylonVector3(0, 1.86, z - 0.5),
    materials.dark
  );
  for (const x of [-3.95, 3.95])
    batchBox(
      "elevator jamb",
      new BabylonVector3(0.48, 4.25, 0.42),
      new BabylonVector3(x, 2.1, z - 0.5),
      materials.dark
    );
  batchBox(
    "elevator header",
    new BabylonVector3(8.35, 0.45, 0.42),
    new BabylonVector3(0, 4.08, z - 0.5),
    materials.dark
  );
  for (const x of [-2.7, -0.9, 0.9, 2.7])
    batchBox(
      "elevator hazard",
      new BabylonVector3(1.38, 0.18, 0.06),
      new BabylonVector3(x, 0.35, z - 0.54),
      x === -2.7 || x === 0.9 ? materials.hazardYellow : materials.hazardBlack
    );
  batchBox(
    "elevator call screen",
    new BabylonVector3(0.42, 0.32, 0.04),
    new BabylonVector3(buttonX, 1.62, z - 0.75),
    accent
  );
  createElevatorLabel(scene, label, new BabylonVector3(0, 3.25, z - 0.57));

  const button = CreateBox(
    "elevator call panel",
    { width: 0.58, height: 0.9, depth: 0.18 },
    scene
  );
  button.position.set(buttonX, 1.48, z - 0.64);
  button.material = materials.steel;
  button.metadata = { extraction: true };
  button.isPickable = true;

  const updateDoors = (delta: number, open: boolean): void => {
    const offset = open ? LEVEL.ELEVATOR_DOOR_OPEN_OFFSET : 0;
    const rate = Math.min(1, delta * DOOR_LERP_RATE);
    leftDoor.position.x +=
      (-(DOOR_CLOSED_X + offset) - leftDoor.position.x) * rate;
    rightDoor.position.x +=
      (DOOR_CLOSED_X + offset - rightDoor.position.x) * rate;
  };

  return { button, updateDoors };
}
