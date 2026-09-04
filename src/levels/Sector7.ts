import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { LEVEL } from "../config/constants";
import {
  type MaterialLibrary,
  prepareImportedMaterial,
} from "../core/MaterialLibrary";
import { Batcher } from "../systems/Batcher";
import { FacilityLighting } from "../systems/FacilityLighting";
import type { PickupKind } from "../types";
import { createElevator } from "./ElevatorBuilder";
import type { EnemySpawn, FacilityLevel } from "./FacilityLevel";
import { PropModel } from "./PropModel";

const medkitModelUrl = new URL(
  "../../assests/Meshy_AI_Aether_Medkit_balanced.glb",
  import.meta.url
).href;
const ammoCrateModelUrl = new URL(
  "../../assests/Meshy_AI_ARMEX_Ammo_Crate_balanced.glb",
  import.meta.url
).href;
const analyzerModelUrl = new URL(
  "../../assests/Meshy_AI_Lab_Analyzer_balanced.glb",
  import.meta.url
).href;
const containmentPodModelUrl = new URL(
  "../../assests/Meshy_AI_Containment_Pod_balanced.glb",
  import.meta.url
).href;
const labArmModelUrl = new URL(
  "../../assests/Meshy_AI_Articulated_Lab_Arm_balanced.glb",
  import.meta.url
).href;
const damagedDroidModelUrl = new URL(
  "../../assests/Meshy_AI_Damaged_Security_Droid_balanced.glb",
  import.meta.url
).href;
const breachedContainmentModelUrl = new URL(
  "../../assests/Meshy_AI_Breached_Containment_balanced.glb",
  import.meta.url
).href;
const emergencyGearModelUrl = new URL(
  "../../assests/Meshy_AI_Emergency_Gear_balanced.glb",
  import.meta.url
).href;

export interface Pickup {
  kind: PickupKind;
  mesh: Mesh;
  active: boolean;
  baseY: number;
}

export class Sector7 implements FacilityLevel {
  readonly pickups: Pickup[] = [];
  readonly enemySpawns: EnemySpawn[] = [
    { position: new Vector3(2.8, 0, -22), variant: "infected" },
    { position: new Vector3(-4.8, 0, -1), variant: "infected" },
    { position: new Vector3(4.5, 0, 8), variant: "runner" },
    { position: new Vector3(-4, 0, 33), variant: "infected" },
    { position: new Vector3(4.8, 0, 44), variant: "runner" },
    { position: new Vector3(0, 0, 61), variant: "acid" },
  ];
  readonly elevatorConsole: Mesh;
  private readonly batcher = new Batcher();
  private readonly lighting: FacilityLighting;
  private readonly slidingDoor: TransformNode;
  private readonly levelMeshes: AbstractMesh[];
  private elevatorDoors!: (delta: number, open: boolean) => void;
  private active = true;
  private lightBudget = 0;
  private time = 0;

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialLibrary
  ) {
    const firstMesh = scene.meshes.length;
    this.lighting = new FacilityLighting(scene, (emitter) =>
      this.batchBox("fixture", emitter.size, emitter.position, emitter.material)
    );

    this.createShell();
    this.createSecurityCheckpoint();
    this.createMainLab();
    this.createContainment();
    this.elevatorConsole = this.createExtraction();
    this.createCeilingLights();
    this.createBloodTrail();
    this.lighting.build();
    this.batcher.flush(scene);

    this.slidingDoor = new TransformNode("security bulkhead", scene);
    const leftDoor = this.dynamicBox(
      "bulkhead-left",
      new Vector3(4.2, 4.2, 0.38),
      new Vector3(-4.25, 2.05, -14),
      materials.dark,
      true
    );
    const rightDoor = this.dynamicBox(
      "bulkhead-right",
      new Vector3(4.2, 4.2, 0.38),
      new Vector3(4.25, 2.05, -14),
      materials.dark,
      true
    );
    leftDoor.parent = this.slidingDoor;
    rightDoor.parent = this.slidingDoor;

    this.createPickup("ammo", new Vector3(-5.6, 0.35, -6));
    this.createPickup("health", new Vector3(6, 0.3, 19));
    this.createPickup("ammo", new Vector3(-5.7, 0.35, 40));
    this.createPickup("health", new Vector3(5.8, 0.3, 54));
    // Enemy materials are created up front so every spawned infected shares the
    // frozen set instead of allocating materials during gameplay.
    materials.enemy("infected");
    materials.enemy("runner");
    materials.enemy("acid");
    this.materials.freeze();
    this.levelMeshes = scene.meshes.slice(firstMesh);
  }

  update(delta: number, playerPosition: Vector3): void {
    this.time += delta;
    this.lighting.update(delta, playerPosition);

    const doorTarget = playerPosition.z > -25 ? 4.6 : 0;
    this.slidingDoor.position.y +=
      (doorTarget - this.slidingDoor.position.y) * Math.min(1, delta * 2.2);

    const elevatorDoorsOpen =
      Vector3.DistanceSquared(this.elevatorConsole.position, playerPosition) <
      LEVEL.ELEVATOR_DOOR_TRIGGER_DISTANCE ** 2;
    this.elevatorDoors(delta, elevatorDoorsOpen);

    this.pickups.forEach((pickup, index) => {
      if (!pickup.active) return;
      pickup.mesh.rotation.y += delta * 1.4;
      pickup.mesh.position.y =
        pickup.baseY + Math.sin(this.time * 2.4 + index) * 0.035;
    });
  }

  setLightBudget(count: number): boolean {
    this.lightBudget = count;
    return this.lighting.setBudget(this.active ? count : 0);
  }

  setActive(active: boolean): boolean {
    if (active === this.active) return false;
    this.active = active;
    for (const mesh of this.levelMeshes) mesh.setEnabled(active);
    return this.lighting.setBudget(active ? this.lightBudget : 0);
  }

  getActiveLightCount(): number {
    return this.lighting.getActiveCount();
  }

  async loadPickupModels(): Promise<void> {
    await import("@babylonjs/loaders/glTF");
    const [healthModel, ammoModel] = await Promise.all([
      this.loadPickupModel(medkitModelUrl, "medkit"),
      this.loadPickupModel(ammoCrateModelUrl, "ammo crate"),
    ]);
    for (const pickup of this.pickups) {
      const container = pickup.kind === "health" ? healthModel : ammoModel;
      if (container) this.attachPickupModel(pickup, container);
    }
  }

  async loadPropModels(): Promise<void> {
    const [analyzer, pod, labArm, droid, breached, emergencyGear] =
      await Promise.all([
        PropModel.load(this.scene, analyzerModelUrl, "lab analyzer"),
        PropModel.load(this.scene, containmentPodModelUrl, "containment pod"),
        PropModel.load(this.scene, labArmModelUrl, "articulated lab arm"),
        PropModel.load(
          this.scene,
          damagedDroidModelUrl,
          "damaged security droid"
        ),
        PropModel.load(
          this.scene,
          breachedContainmentModelUrl,
          "breached containment equipment"
        ),
        PropModel.load(
          this.scene,
          emergencyGearModelUrl,
          "abandoned emergency gear"
        ),
      ]);

    const add = (
      model: PropModel | undefined,
      placements: Parameters<PropModel["instantiate"]>[0][]
    ): void => {
      if (!model) return;
      for (const placement of placements) {
        this.levelMeshes.push(...model.instantiate(placement, this.active));
      }
    };

    add(
      analyzer,
      [-7, 3, 13].map((z, index) => ({
        name: `lab analyzer ${index + 1}`,
        position: new Vector3(1.1, 1.54, z + 0.1),
        scaling: new Vector3(0.85, 0.42, 0.8),
        rotation: new Vector3(0, -0.08 + index * 0.07, 0),
      }))
    );
    add(labArm, [
      {
        name: "articulated lab arm 1",
        position: new Vector3(-2.4, 2.04, 4.2),
        scaling: new Vector3(0.75, 1.2, 0.9),
        rotation: new Vector3(0, 0.15, 0),
      },
      {
        name: "articulated lab arm 2",
        position: new Vector3(2.6, 2.04, 13.4),
        scaling: new Vector3(0.75, 1.2, 0.9),
        rotation: new Vector3(0, Math.PI + 0.2, 0),
      },
    ]);
    add(pod, [
      {
        name: "occupied containment pod 1",
        position: new Vector3(-5.6, 1.9, 31),
        scaling: new Vector3(1.9, 1.85, 1.8),
        rotation: new Vector3(0, Math.PI, 0),
      },
      {
        name: "occupied containment pod 2",
        position: new Vector3(5.6, 1.9, 31),
        scaling: new Vector3(1.9, 1.85, 1.8),
        rotation: new Vector3(0, Math.PI, 0),
      },
    ]);
    add(breached, [
      {
        name: "breached containment pod",
        position: new Vector3(0, 1.85, 31),
        scaling: new Vector3(1.7, 1.75, 2),
        rotation: new Vector3(0, Math.PI + 0.18, 0),
      },
    ]);
    add(droid, [
      {
        name: "damaged security droid remains",
        position: new Vector3(4.2, 0.72, -27.2),
        scaling: new Vector3(0.9, 0.9, 0.9),
        rotation: new Vector3(0.1, 0.35, Math.PI / 2),
      },
    ]);
    add(emergencyGear, [
      {
        name: "abandoned emergency gear 1",
        position: new Vector3(5.4, 0.4, 21.5),
        scaling: new Vector3(0.72, 0.72, 0.72),
        rotation: new Vector3(0, -0.45, 0),
      },
      {
        name: "abandoned emergency gear 2",
        position: new Vector3(-5.6, 0.4, 55),
        scaling: new Vector3(0.68, 0.68, 0.68),
        rotation: new Vector3(0, 0.75, 0),
      },
    ]);
  }

  private createShell(): void {
    const b = this.batcher;
    const zone = "world";
    b.batch(
      zone,
      new Vector3(18, 0.25, 122),
      new Vector3(0, -0.13, 20),
      this.materials.floor,
      true
    );
    b.batch(
      zone,
      new Vector3(18, 0.25, 122),
      new Vector3(0, 4.55, 20),
      this.materials.ceiling,
      true
    );
    b.batch(
      zone,
      new Vector3(0.3, 4.7, 122),
      new Vector3(-9, 2.25, 20),
      this.materials.wall,
      true
    );
    b.batch(
      zone,
      new Vector3(0.3, 4.7, 122),
      new Vector3(9, 2.25, 20),
      this.materials.wall,
      true
    );
    b.batch(
      zone,
      new Vector3(18, 4.7, 0.3),
      new Vector3(0, 2.25, -41),
      this.materials.wall,
      true
    );
    b.batch(
      zone,
      new Vector3(18, 4.7, 0.3),
      new Vector3(0, 2.25, 81),
      this.materials.wall,
      true
    );
    this.collider(
      "world floor",
      new Vector3(18, 0.25, 122),
      new Vector3(0, -0.13, 20),
      true
    );
    this.collider(
      "world ceiling",
      new Vector3(18, 0.25, 122),
      new Vector3(0, 4.55, 20),
      false
    );
    this.collider(
      "west collision",
      new Vector3(0.3, 4.7, 122),
      new Vector3(-9, 2.25, 20),
      true
    );
    this.collider(
      "east collision",
      new Vector3(0.3, 4.7, 122),
      new Vector3(9, 2.25, 20),
      true
    );
    this.collider(
      "start collision",
      new Vector3(18, 4.7, 0.3),
      new Vector3(0, 2.25, -41),
      true
    );
    this.collider(
      "end collision",
      new Vector3(18, 4.7, 0.3),
      new Vector3(0, 2.25, 81),
      true
    );

    for (let z = -39; z < 80; z += 4)
      b.batch(
        zone,
        new Vector3(17.7, 0.015, 0.025),
        new Vector3(0, 0.01, z),
        this.materials.dark
      );
    // Wall trim: a skirting rail, a waist-height seam and a floor guide light
    // strip give the long panels scale and pull the eye down the corridor.
    for (const x of [-8.82, 8.82]) {
      b.batch(
        zone,
        new Vector3(0.08, 0.32, 122),
        new Vector3(x, 0.16, 20),
        this.materials.dark
      );
      b.batch(
        zone,
        new Vector3(0.06, 0.05, 122),
        new Vector3(x, 1.18, 20),
        this.materials.dark
      );
      b.batch(
        zone,
        new Vector3(0.04, 0.035, 121),
        new Vector3(x < 0 ? -8.74 : 8.74, 0.36, 20),
        this.materials.cyan
      );
    }
    for (let z = -38; z < 80; z += 6) {
      b.batch(
        zone,
        new Vector3(0.16, 4.4, 0.22),
        new Vector3(-8.78, 2.25, z),
        this.materials.dark
      );
      b.batch(
        zone,
        new Vector3(0.16, 4.4, 0.22),
        new Vector3(8.78, 2.25, z),
        this.materials.dark
      );
    }
  }

  private createSecurityCheckpoint(): void {
    this.batchBox(
      "security-desk",
      new Vector3(6.8, 1.05, 1.25),
      new Vector3(-3.4, 0.52, -30),
      this.materials.steel,
      true
    );
    this.batchBox(
      "security-desk",
      new Vector3(6.2, 0.18, 1.32),
      new Vector3(-3.4, 1.02, -30),
      this.materials.dark
    );
    this.collider(
      "security desk collision",
      new Vector3(6.8, 1.05, 1.25),
      new Vector3(-3.4, 0.52, -30),
      true
    );
    this.monitor(new Vector3(-4.6, 1.62, -29.85), this.materials.cyan, -0.05);
    this.monitor(new Vector3(-2.7, 1.62, -29.85), this.materials.cyan, 0.06);
    this.batchBox(
      "security-window",
      new Vector3(7.2, 2.2, 0.14),
      new Vector3(4.7, 2.3, -35.5),
      this.materials.wall
    );
    this.batchBox(
      "signs",
      new Vector3(3.6, 0.42, 0.05),
      new Vector3(0, 3.7, -40.78),
      this.materials.cyan
    );
    this.hazardLine(-14.25);
  }

  private createMainLab(): void {
    for (const z of [-7, 3, 13])
      this.labBench(
        new Vector3(0, 0, z),
        z === 3 ? this.materials.green : this.materials.cyan
      );
    for (const x of [-6.8, 6.8]) {
      for (const z of [-8, 0, 8, 16]) {
        this.batchBox(
          "cabinets",
          new Vector3(2.8, 2.2, 0.58),
          new Vector3(x, 1.45, z),
          this.materials.wall
        );
        this.batchBox(
          "cabinet-glass",
          new Vector3(2.3, 1.55, 0.05),
          new Vector3(
            x + (x < 0 ? 0.31 : -0.31),
            1.55,
            z + (x < 0 ? 0.31 : -0.31)
          ),
          this.materials.glass
        );
      }
      this.collider(
        `cabinet collision ${x}`,
        new Vector3(2.9, 2.2, 25),
        new Vector3(x, 1.45, 4),
        true
      );
    }
    this.batchBox(
      "signs",
      new Vector3(0.05, 0.44, 4.3),
      new Vector3(-8.78, 3.55, 18),
      this.materials.cyan
    );
  }

  private createContainment(): void {
    this.hazardLine(24.5);
    for (const x of [-5.6, 0, 5.6]) {
      this.collider(
        `pod collision ${x}`,
        new Vector3(2.1, 3.6, 2.1),
        new Vector3(x, 1.8, 31),
        true
      );
    }
    this.labBench(new Vector3(-3.5, 0, 42), this.materials.green);
    this.labBench(new Vector3(3.5, 0, 47), this.materials.green);
    this.batchBox(
      "rubble",
      new Vector3(2.8, 0.45, 1.3),
      new Vector3(-6.7, 0.28, 50),
      this.materials.wall,
      false,
      0,
      0,
      0.34
    );
    this.batchBox(
      "rubble",
      new Vector3(2.4, 0.22, 3.2),
      new Vector3(5.8, 0.22, 52),
      this.materials.wall,
      false,
      0,
      0.58,
      0
    );
  }

  private createExtraction(): Mesh {
    this.hazardLine(57.5);
    this.collider(
      "lift collision",
      new Vector3(12, 4.4, 0.5),
      new Vector3(0, 2.2, 76),
      true
    );
    const elevator = createElevator({
      scene: this.scene,
      materials: this.materials,
      z: 76,
      label: "-07  //  RESEARCH SECTOR",
      accent: this.materials.cyan,
      batchBox: (name, size, position, material) =>
        this.batchBox(name, size, position, material),
    });
    this.elevatorDoors = elevator.updateDoors;
    return elevator.button;
  }

  private createCeilingLights(): void {
    // A handful of failing tubes: enough to unsettle, not a disco.
    const failing = new Set([
      "-4.8:-36",
      "4.8:-12",
      "-4.8:20",
      "4.8:44",
      "-4.8:60",
    ]);
    for (let z = -36; z < 76; z += 8) {
      for (const x of [-4.8, 4.8]) {
        this.batchBox(
          "light-housing",
          new Vector3(3.1, 0.12, 0.78),
          new Vector3(x, 4.38, z),
          this.materials.dark
        );
        // Point lights follow inverse-square falloff, so they hang well below
        // the fixture: high enough to stay out of view, low enough that the
        // floor and walls catch the pool instead of the ceiling panel.
        this.lighting.add(
          new Vector3(x, 3.25, z),
          new Color3(0.62, 0.86, 0.84),
          5.6,
          11,
          failing.has(`${x}:${z}`),
          {
            size: new Vector3(2.7, 0.05, 0.5),
            position: new Vector3(x, 4.3, z),
            material: this.materials.lamp,
          }
        );
      }
    }
    for (const z of [28, 48, 62]) {
      this.batchBox(
        "alarm-housing",
        new Vector3(0.7, 0.1, 0.7),
        new Vector3(0, 4.38, z),
        this.materials.dark
      );
      this.lighting.add(
        new Vector3(0, 3.35, z),
        new Color3(1, 0.04, 0.02),
        2.4,
        9,
        true,
        {
          size: new Vector3(0.46, 0.12, 0.46),
          position: new Vector3(0, 4.28, z),
          material: this.materials.red,
        }
      );
    }
  }

  private createBloodTrail(): void {
    const matrices: Matrix[] = [];
    for (let index = 0; index < 15; index += 1) {
      const radius = 0.18 + Math.random() * 0.34;
      matrices.push(
        Matrix.Compose(
          new Vector3(radius * 1.8, radius, radius),
          Quaternion.RotationYawPitchRoll(0, Math.PI / 2, 0),
          new Vector3(Math.sin(index * 1.8) * 1.2, 0.012, 17 + index * 2.5)
        )
      );
    }
    const stain = CreateDisc(
      "blood-smears",
      { radius: 1, tessellation: 10 },
      this.scene
    );
    stain.material = this.materials.blood;
    stain.isPickable = false;
    const buffer = new Float32Array(matrices.length * 16);
    for (let i = 0; i < matrices.length; i++) {
      matrices[i].copyToArray(buffer, i * 16);
    }
    stain.thinInstanceSetBuffer("matrix", buffer, 16, true);
    stain.thinInstanceRefreshBoundingInfo(true);
  }

  private labBench(position: Vector3, screen: Material): void {
    this.batchBox(
      "lab-benches",
      new Vector3(5.8, 0.22, 2.2),
      position.add(new Vector3(0, 1.05, 0)),
      this.materials.steel
    );
    for (const x of [-2.5, 2.5])
      this.batchBox(
        "bench-legs",
        new Vector3(0.18, 1, 1.8),
        position.add(new Vector3(x, 0.5, 0)),
        this.materials.dark
      );
    this.collider(
      `bench collision ${position.z}`,
      new Vector3(5.8, 1.05, 2.2),
      position.add(new Vector3(0, 0.52, 0)),
      true
    );
    this.monitor(position.add(new Vector3(-1.35, 1.56, 0)), screen, -0.12);
    for (const x of [-1.9, 1.9]) {
      this.batchBox(
        "sample-vials",
        new Vector3(0.34, 0.62, 0.34),
        position.add(new Vector3(x, 1.46, -0.4)),
        screen
      );
    }
  }

  private monitor(
    position: Vector3,
    screen: Material,
    rotationY: number
  ): void {
    this.batchBox(
      "monitors",
      new Vector3(1.35, 0.9, 0.18),
      position,
      this.materials.dark,
      false,
      0,
      rotationY
    );
    this.batchBox(
      "screens",
      new Vector3(1.08, 0.64, 0.025),
      position.add(new Vector3(0, 0, -0.105)),
      screen,
      false,
      0,
      rotationY
    );
  }

  private createPickup(kind: PickupKind, position: Vector3): void {
    const mesh = this.dynamicBox(
      kind,
      kind === "health"
        ? new Vector3(0.65, 0.38, 0.65)
        : new Vector3(0.75, 0.45, 0.48),
      position,
      kind === "health" ? this.materials.medkit : this.materials.ammo
    );
    mesh.metadata = { pickup: kind };
    mesh.isPickable = false;
    this.pickups.push({ kind, mesh, active: true, baseY: position.y });
  }

  private async loadPickupModel(
    modelUrl: string,
    label: string
  ): Promise<AssetContainer | undefined> {
    try {
      const container = await SceneLoader.LoadAssetContainerAsync(
        "",
        modelUrl,
        this.scene
      );
      container.materials.forEach(prepareImportedMaterial);
      return container;
    } catch (error) {
      console.warn(`Could not load ${label} model; using fallback`, error);
      return undefined;
    }
  }

  private attachPickupModel(pickup: Pickup, container: AssetContainer): void {
    const entries = container.instantiateModelsToScene(
      (sourceName) => `${pickup.kind}-pickup-${sourceName}`,
      false
    );
    if (entries.rootNodes.length === 0) return;

    const modelRoot = new TransformNode(
      `${pickup.kind} pickup model`,
      this.scene
    );
    modelRoot.parent = pickup.mesh;
    entries.rootNodes.forEach((node) => {
      node.parent = modelRoot;
    });

    let minY = Infinity;
    let maxDimension = 0;
    for (const mesh of modelRoot.getChildMeshes()) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      minY = Math.min(minY, bounds.minimumWorld.y - pickup.mesh.position.y);
      const size = bounds.maximumWorld.subtract(bounds.minimumWorld);
      maxDimension = Math.max(maxDimension, size.x, size.y, size.z);
      mesh.isPickable = false;
    }
    if (!Number.isFinite(minY) || maxDimension <= 0) {
      modelRoot.dispose();
      return;
    }

    const scale = 1 / maxDimension;
    modelRoot.scaling.setAll(scale);
    modelRoot.position.y = -pickup.baseY + 0.04 - minY * scale;
    modelRoot.rotation.y = 0.22;
    pickup.mesh.isVisible = false;
  }

  private hazardLine(z: number): void {
    for (let x = -8.5; x < 8.5; x += 1) {
      this.batchBox(
        "hazard",
        new Vector3(0.74, 0.025, 0.7),
        new Vector3(x + 0.5, 0.015, z),
        Math.round(x) % 2 === 0
          ? this.materials.hazardYellow
          : this.materials.hazardBlack,
        false,
        0,
        0.55
      );
    }
  }

  private batchBox(
    _name: string,
    size: Vector3,
    position: Vector3,
    material: Material,
    pickable = false,
    rotationX = 0,
    rotationY = 0,
    rotationZ = 0
  ): void {
    const zone =
      position.z < -14
        ? "security"
        : position.z < 24
          ? "lab"
          : position.z < 57
            ? "containment"
            : "extraction";
    this.batcher.batch(
      zone,
      size,
      position,
      material,
      pickable,
      rotationX,
      rotationY,
      rotationZ
    );
  }

  private dynamicBox(
    name: string,
    size: Vector3,
    position: Vector3,
    material: Material,
    collision = false
  ): Mesh {
    const mesh = CreateBox(
      name,
      { width: size.x, height: size.y, depth: size.z },
      this.scene
    );
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.checkCollisions = collision;
    mesh.isPickable = collision;
    return mesh;
  }

  private collider(
    name: string,
    size: Vector3,
    position: Vector3,
    pickable: boolean
  ): void {
    const mesh = CreateBox(
      name,
      { width: size.x, height: size.y, depth: size.z },
      this.scene
    );
    mesh.position.copyFrom(position);
    mesh.checkCollisions = true;
    mesh.isPickable = pickable;
    mesh.isVisible = false;
    mesh.metadata = { collision: true };
    mesh.freezeWorldMatrix();
  }
}
