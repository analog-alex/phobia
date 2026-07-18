import type { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { MaterialLibrary } from "../core/MaterialLibrary";
import { Batcher } from "../systems/Batcher";
import { FacilityLighting } from "../systems/FacilityLighting";
import { createElevator } from "./ElevatorBuilder";
import type { FacilityLevel } from "./FacilityLevel";
import { PropModel } from "./PropModel";

const compactorModelUrl = new URL(
  "../../assests/Meshy_AI_Facility_Waste_Compactor_balanced.glb",
  import.meta.url
).href;
const drumClusterModelUrl = new URL(
  "../../assests/Meshy_AI_Chemical_Drum_Cluster_balanced.glb",
  import.meta.url
).href;

export class WasteDisposal implements FacilityLevel {
  readonly spawn = new Vector3(0, 2.75, -116);
  readonly enemySpawn = new Vector3(-4.2, 0, -75);
  readonly enemySpawns = [
    { position: this.enemySpawn, variant: "infected" as const },
  ];
  readonly xmbPickup: Mesh;
  readonly boltPickup: Mesh;
  readonly elevatorConsole: Mesh;
  private readonly batcher = new Batcher();
  private readonly lighting: FacilityLighting;
  private readonly levelMeshes: AbstractMesh[];
  private active = true;
  private lightBudget = 0;

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialLibrary
  ) {
    const firstMesh = scene.meshes.length;
    this.lighting = new FacilityLighting(scene);
    this.createShell();
    this.createWasteLine();
    this.createSecurityStation();
    this.elevatorConsole = this.createElevator();
    this.createLights();
    this.batcher.flush(scene);
    this.xmbPickup = this.box(
      "XMB H2 pickup",
      new Vector3(1.05, 0.22, 0.42),
      new Vector3(-5.7, 1.18, -50.3),
      materials.ammo
    );
    this.xmbPickup.isVisible = false;
    this.xmbPickup.isPickable = false;
    this.boltPickup = this.box(
      "A7 bolt rifle pickup",
      new Vector3(1.05, 0.22, 0.42),
      new Vector3(6.4, 1.18, -50.3),
      materials.ammo
    );
    this.boltPickup.isVisible = false;
    this.boltPickup.isPickable = false;
    this.levelMeshes = scene.meshes.slice(firstMesh);
  }

  async loadPropModels(): Promise<void> {
    const [compactor, drums] = await Promise.all([
      PropModel.load(this.scene, compactorModelUrl, "waste compactor"),
      PropModel.load(this.scene, drumClusterModelUrl, "chemical drum cluster"),
    ]);

    if (compactor) {
      [-110, -96, -82, -68].forEach((z, index) => {
        const x = z % 4 === 0 ? -5.8 : 5.8;
        this.levelMeshes.push(
          ...compactor.instantiate(
            {
              name: `waste compactor ${index + 1}`,
              position: new Vector3(x, 0.9, z),
              scaling: new Vector3(2.3, 0.95, 2),
              rotation: new Vector3(0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0),
            },
            this.active
          )
        );
      });
    }

    if (drums) {
      [-104, -90, -76, -62].forEach((z, index) => {
        const x = z % 4 === 0 ? 6.8 : -6.8;
        this.levelMeshes.push(
          ...drums.instantiate(
            {
              name: `chemical drum cluster ${index + 1}`,
              position: new Vector3(x, 0.7, z),
              scaling: new Vector3(1.2, 0.82, 0.9),
              rotation: new Vector3(0, index * 0.67, 0),
            },
            this.active
          )
        );
      });
    }
  }

  update(delta: number, playerPosition: Vector3): void {
    this.lighting.update(delta, playerPosition);
  }

  setLightBudget(count: number): void {
    this.lightBudget = count;
    this.lighting.setBudget(this.active ? count : 0);
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    for (const mesh of this.levelMeshes) mesh.setEnabled(active);
    this.lighting.setBudget(active ? this.lightBudget : 0);
  }

  getActiveLightCount(): number {
    return this.lighting.getActiveCount();
  }

  private createShell(): void {
    this.batch(
      "shell",
      new Vector3(18, 0.3, 76),
      new Vector3(0, -0.15, -82),
      this.materials.floor,
      true
    );
    this.batch(
      "shell",
      new Vector3(18, 0.3, 76),
      new Vector3(0, 4.55, -82),
      this.materials.dark,
      true
    );
    this.batch(
      "shell",
      new Vector3(0.3, 4.7, 76),
      new Vector3(-9, 2.25, -82),
      this.materials.dark,
      true
    );
    this.batch(
      "shell",
      new Vector3(0.3, 4.7, 76),
      new Vector3(9, 2.25, -82),
      this.materials.dark,
      true
    );
    this.batch(
      "shell",
      new Vector3(18, 4.7, 0.3),
      new Vector3(0, 2.25, -120),
      this.materials.dark,
      true
    );
    this.batch(
      "shell",
      new Vector3(18, 4.7, 0.3),
      new Vector3(0, 2.25, -44),
      this.materials.dark,
      true
    );
    for (let z = -117; z < -46; z += 6) {
      this.batch(
        "rib",
        new Vector3(0.2, 4.4, 0.32),
        new Vector3(-8.72, 2.2, z),
        this.materials.steel
      );
      this.batch(
        "rib",
        new Vector3(0.2, 4.4, 0.32),
        new Vector3(8.72, 2.2, z),
        this.materials.steel
      );
    }
  }

  private createWasteLine(): void {
    for (const z of [-110, -96, -82, -68]) {
      const position = new Vector3(z % 4 === 0 ? -5.8 : 5.8, 0.85, z);
      this.collider(
        "waste compactor collision",
        new Vector3(4.8, 1.7, 3.2),
        position
      );
      this.batch(
        "warning",
        new Vector3(4.2, 0.12, 2.6),
        new Vector3(position.x, 0.04, z),
        this.materials.hazardYellow
      );
    }
    for (const z of [-104, -90, -76, -62]) {
      this.collider(
        "chemical drum cluster collision",
        new Vector3(2.3, 1.4, 1.8),
        new Vector3(z % 4 === 0 ? 6.8 : -6.8, 0.7, z)
      );
    }
    this.batch(
      "sewage channel",
      new Vector3(4.8, 0.05, 38),
      new Vector3(0, 0.025, -77),
      this.materials.green
    );
    this.batch(
      "channel rail",
      new Vector3(0.16, 0.8, 38),
      new Vector3(-2.55, 0.42, -77),
      this.materials.steel,
      true
    );
    this.batch(
      "channel rail",
      new Vector3(0.16, 0.8, 38),
      new Vector3(2.55, 0.42, -77),
      this.materials.steel,
      true
    );
  }

  private createSecurityStation(): void {
    this.batch(
      "security desk",
      new Vector3(6.4, 1.05, 1.3),
      new Vector3(-4.3, 0.52, -102),
      this.materials.steel,
      true
    );
    this.batch(
      "dead screen",
      new Vector3(1.4, 0.9, 0.16),
      new Vector3(-5.1, 1.55, -101.8),
      this.materials.red
    );
    this.batch(
      "blood",
      new Vector3(2.6, 0.025, 1.1),
      new Vector3(-3.9, 0.02, -99.8),
      this.materials.blood
    );
  }

  private createElevator(): Mesh {
    const console = createElevator({
      scene: this.scene,
      materials: this.materials,
      z: -45,
      label: "-08  //  WASTE DISPOSAL",
      accent: this.materials.green,
      batchBox: (name, size, position, material) =>
        this.batch(name, size, position, material),
      buttonX: 4.35,
    });
    this.batch(
      "rifle pedestal",
      new Vector3(2.4, 1, 1.4),
      new Vector3(-5.7, 0.5, -50.3),
      this.materials.steel,
      true
    );
    this.batch(
      "rifle marker",
      new Vector3(1.8, 0.04, 1),
      new Vector3(-5.7, 1.02, -50.3),
      this.materials.hazardYellow
    );
    this.batch(
      "bolt rifle pedestal",
      new Vector3(2.4, 1, 1.4),
      new Vector3(6.4, 0.5, -50.3),
      this.materials.steel,
      true
    );
    this.batch(
      "bolt rifle marker",
      new Vector3(1.8, 0.04, 1),
      new Vector3(6.4, 1.02, -50.3),
      this.materials.hazardYellow
    );
    return console;
  }

  private createLights(): void {
    for (let z = -114; z <= -50; z += 8) {
      this.batch(
        "work light",
        new Vector3(2.6, 0.08, 0.46),
        new Vector3(z % 16 === 0 ? -5 : 5, 4.32, z),
        this.materials.lamp
      );
      this.lighting.add(
        new Vector3(z % 16 === 0 ? -5 : 5, 3.8, z),
        new Color3(0.22, 0.72, 0.5),
        0.9,
        10,
        z % 24 === 0
      );
    }
    this.lighting.add(
      new Vector3(0, 3.7, -75),
      new Color3(1, 0.04, 0.01),
      0.55,
      11,
      true
    );
  }

  private batch(
    name: string,
    size: Vector3,
    position: Vector3,
    material: Material,
    collision = false
  ): void {
    this.batcher.batch("waste", size, position, material, collision);
    if (collision) this.collider(`${name} collider`, size, position);
  }

  private box(
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
    return mesh;
  }

  private collider(name: string, size: Vector3, position: Vector3): void {
    const mesh = this.box(name, size, position, this.materials.dark, true);
    mesh.isVisible = false;
    mesh.isPickable = true;
    mesh.freezeWorldMatrix();
  }
}
