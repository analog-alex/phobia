import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ENEMY_AI } from "../config/constants";
import type { EnemyVariant } from "../types";
import type { MaterialLibrary } from "./MaterialLibrary";

export type { EnemyVariant };

export class Enemy {
  readonly root: TransformNode;
  private readonly visualRoot: TransformNode;
  private health: number;
  private attackCooldown = 0;
  private animationTime = Math.random() * 10;
  private dying = 0;
  private dead = false;
  private readonly offset = new Vector3();
  private readonly direction = new Vector3();
  private decisionTimer = Math.random() * ENEMY_AI.DECISION_TICK;
  private distance = Infinity;
  private attackAnimation = 0;
  private readonly gaitOffset = Math.random() * Math.PI * 2;
  private readonly twitchOffset = Math.random() * Math.PI * 2;
  private readonly attackOrigin = new Vector3();

  constructor(
    scene: Scene,
    position: Vector3,
    private readonly variant: EnemyVariant,
    materials: MaterialLibrary
  ) {
    this.health = variant === "runner" ? 55 : 75; // from ENEMY_AI but kept literal for construction parity
    this.root = new TransformNode(`enemy-${variant}`, scene);
    this.root.position.copyFrom(position);
    this.visualRoot = new TransformNode(`enemy-visual-${variant}`, scene);
    this.visualRoot.parent = this.root;

    const { coat, pants, skin, tissue, eye, hair, glasses } =
      materials.enemy(variant);

    const runner = variant === "runner";
    const lean = runner ? -0.31 : -0.2;
    this.mergeParts([
      this.part(
        CreateBox(
          "torn torso",
          { width: 0.76, height: 0.98, depth: 0.42 },
          scene
        ),
        coat,
        new Vector3(0.03, 1.22, -0.04),
        new Vector3(lean, 0, -0.07)
      ),
      this.part(
        CreateBox(
          "left leg",
          { width: 0.28, height: 0.92, depth: 0.31 },
          scene
        ),
        pants,
        new Vector3(-0.2, 0.46, 0.03),
        new Vector3(0.08, 0, -0.04)
      ),
      this.part(
        CreateBox(
          "right leg",
          { width: 0.27, height: 0.88, depth: 0.3 },
          scene
        ),
        pants,
        new Vector3(0.21, 0.43, -0.02),
        new Vector3(-0.12, 0, 0.08)
      ),
      this.part(
        CreateBox(
          "torn shoulder",
          { width: 0.3, height: 0.32, depth: 0.44 },
          scene
        ),
        coat,
        new Vector3(-0.43, 1.54, -0.08),
        new Vector3(lean, 0, -0.18)
      ),
    ]);
    this.mergeParts([
      this.part(
        CreateSphere("infected head", { diameter: 0.5, segments: 8 }, scene),
        skin,
        new Vector3(-0.04, 1.94, -0.16),
        new Vector3(-0.18, 0.14, runner ? -0.18 : 0.16),
        new Vector3(0.93, 1.06, 0.9)
      ),
      this.part(
        CreateBox(
          "broken jaw",
          { width: 0.3, height: 0.16, depth: 0.24 },
          scene
        ),
        skin,
        new Vector3(-0.01, 1.78, -0.32),
        new Vector3(-0.34, 0.12, 0.08)
      ),
      this.part(
        CreateBox(
          "left upper arm",
          { width: 0.22, height: 0.68, depth: 0.23 },
          scene
        ),
        skin,
        new Vector3(-0.49, 1.3, -0.14),
        new Vector3(-0.72, 0, -0.18)
      ),
      this.part(
        CreateBox(
          "left forearm",
          { width: 0.2, height: 0.62, depth: 0.21 },
          scene
        ),
        skin,
        new Vector3(-0.48, 1.02, -0.53),
        new Vector3(-1.02, 0, 0.05)
      ),
      this.part(
        CreateBox(
          "right upper arm",
          { width: 0.23, height: 0.7, depth: 0.23 },
          scene
        ),
        skin,
        new Vector3(0.49, 1.31, -0.06),
        new Vector3(-0.3, 0, 0.16)
      ),
      this.part(
        CreateBox(
          "right forearm",
          { width: 0.2, height: 0.64, depth: 0.21 },
          scene
        ),
        skin,
        new Vector3(0.52, 0.91, -0.2),
        new Vector3(0.16, 0, -0.1)
      ),
      this.part(
        CreateSphere("swollen hand", { diameter: 0.25, segments: 6 }, scene),
        skin,
        new Vector3(-0.48, 0.83, -0.78),
        Vector3.Zero(),
        new Vector3(0.9, 1.2, 0.8)
      ),
    ]);
    this.mergeParts([
      this.part(
        CreateBox(
          "left lab-coat lapel",
          { width: 0.14, height: 0.5, depth: 0.055 },
          scene
        ),
        coat,
        new Vector3(-0.18, 1.4, -0.285),
        new Vector3(0, 0, -0.35)
      ),
      this.part(
        CreateBox(
          "right lab-coat lapel",
          { width: 0.14, height: 0.5, depth: 0.055 },
          scene
        ),
        coat,
        new Vector3(0.18, 1.4, -0.285),
        new Vector3(0, 0, 0.35)
      ),
      this.part(
        CreateBox(
          "torn coat tail",
          { width: 0.2, height: 0.35, depth: 0.16 },
          scene
        ),
        coat,
        new Vector3(-0.2, 0.83, -0.055),
        new Vector3(0.12, 0, -0.08)
      ),
      this.part(
        CreateBox(
          "torn coat tail",
          { width: 0.19, height: 0.31, depth: 0.16 },
          scene
        ),
        coat,
        new Vector3(0.22, 0.85, -0.04),
        new Vector3(-0.1, 0, 0.1)
      ),
    ]);
    this.mergeParts([
      this.part(
        CreateSphere("infected eye", { diameter: 0.075, segments: 6 }, scene),
        eye,
        new Vector3(-0.13, 1.99, -0.385)
      ),
      this.part(
        CreateSphere("infected eye", { diameter: 0.055, segments: 6 }, scene),
        eye,
        new Vector3(0.08, 1.97, -0.39)
      ),
      this.part(
        CreateSphere("facial lesion", { diameter: 0.11, segments: 6 }, scene),
        eye,
        new Vector3(0.16, 1.86, -0.37),
        Vector3.Zero(),
        new Vector3(1.1, 0.55, 0.35)
      ),
      this.part(
        CreateBox(
          "bloody mouth",
          { width: 0.21, height: 0.045, depth: 0.035 },
          scene
        ),
        eye,
        new Vector3(-0.01, 1.8, -0.455),
        new Vector3(0.08, 0, 0.08)
      ),
    ]);
    this.mergeParts([
      this.part(
        CreateSphere("chest wound", { diameter: 0.2, segments: 6 }, scene),
        tissue,
        new Vector3(-0.22, 1.35, -0.295),
        Vector3.Zero(),
        new Vector3(1.1, 0.75, 0.22)
      ),
      this.part(
        CreateSphere("shoulder wound", { diameter: 0.15, segments: 6 }, scene),
        tissue,
        new Vector3(0.39, 1.55, -0.22),
        Vector3.Zero(),
        new Vector3(0.95, 0.8, 0.22)
      ),
      this.part(
        CreateSphere("forearm wound", { diameter: 0.12, segments: 6 }, scene),
        tissue,
        new Vector3(-0.48, 1.08, -0.65),
        Vector3.Zero(),
        new Vector3(0.7, 0.85, 0.28)
      ),
    ]);
    this.mergeParts([
      this.part(
        CreateTorus(
          "left spectacle frame",
          { diameter: 0.17, thickness: 0.018, tessellation: 8 },
          scene
        ),
        glasses,
        new Vector3(-0.13, 2.0, -0.39),
        new Vector3(0, 0, -0.05),
        new Vector3(1.12, 0.82, 1)
      ),
      this.part(
        CreateTorus(
          "right spectacle frame",
          { diameter: 0.17, thickness: 0.018, tessellation: 8 },
          scene
        ),
        glasses,
        new Vector3(0.08, 1.98, -0.395),
        new Vector3(0, 0, 0.05),
        new Vector3(1.12, 0.82, 1)
      ),
      this.part(
        CreateBox(
          "spectacle bridge",
          { width: 0.08, height: 0.018, depth: 0.018 },
          scene
        ),
        glasses,
        new Vector3(-0.025, 1.99, -0.4)
      ),
      this.part(
        CreateCylinder(
          "hair tuft",
          { height: 0.19, diameter: 0.026, tessellation: 4 },
          scene
        ),
        hair,
        new Vector3(-0.17, 2.24, -0.13),
        new Vector3(-0.48, 0.05, 0.1)
      ),
      this.part(
        CreateCylinder(
          "hair tuft",
          { height: 0.2, diameter: 0.027, tessellation: 4 },
          scene
        ),
        hair,
        new Vector3(-0.06, 2.27, -0.13),
        new Vector3(-0.25, 0, -0.1)
      ),
      this.part(
        CreateCylinder(
          "hair tuft",
          { height: 0.17, diameter: 0.025, tessellation: 4 },
          scene
        ),
        hair,
        new Vector3(0.06, 2.25, -0.12),
        new Vector3(0.3, 0.1, 0.12)
      ),
      this.part(
        CreateBox(
          "matted side hair",
          { width: 0.16, height: 0.16, depth: 0.1 },
          scene
        ),
        hair,
        new Vector3(0.22, 2.04, -0.1),
        new Vector3(0.15, 0.22, -0.25)
      ),
    ]);
    if (variant === "acid") {
      this.mergeParts([
        this.part(
          CreateSphere("acid throat", { diameter: 0.32, segments: 7 }, scene),
          eye,
          new Vector3(0, 1.62, -0.27),
          Vector3.Zero(),
          new Vector3(1.1, 1.25, 0.72)
        ),
        this.part(
          CreateSphere("acid sac", { diameter: 0.38, segments: 7 }, scene),
          eye,
          new Vector3(0.3, 1.32, 0.13),
          Vector3.Zero(),
          new Vector3(0.8, 1.35, 0.7)
        ),
      ]);
    }
  }

  get isDead(): boolean {
    return this.dead;
  }

  update(
    delta: number,
    playerPosition: Vector3,
    onAttack: (damage: number) => void,
    onRangedAttack: (origin: Vector3) => void
  ): void {
    if (this.dead) {
      if (this.dying < 1) {
        this.dying = Math.min(1, this.dying + delta * 2.6);
        this.root.rotation.z = Scalar.Lerp(0, 1.46, this.dying);
        this.root.position.y = Scalar.Lerp(0, 0.22, this.dying);
      }
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.attackAnimation = Math.max(0, this.attackAnimation - delta * 3.4);
    this.animationTime += delta * (this.variant === "runner" ? 9 : 5);
    this.decisionTimer -= delta;
    if (this.decisionTimer <= 0) {
      this.decisionTimer += ENEMY_AI.DECISION_TICK;
      playerPosition.subtractToRef(this.root.position, this.offset);
      this.distance = Math.hypot(this.offset.x, this.offset.z);
      if (this.distance > 0)
        this.direction.set(
          this.offset.x / this.distance,
          0,
          this.offset.z / this.distance
        );
    }

    const acidInRange =
      this.variant === "acid" && this.distance >= 4.5 && this.distance < 20;
    if (acidInRange && this.attackCooldown === 0) {
      this.attackCooldown = 2.15;
      this.attackAnimation = 1;
      this.root.rotation.y =
        Math.atan2(this.direction.x, this.direction.z) + Math.PI;
      this.attackOrigin.set(
        this.root.position.x,
        this.root.position.y + 1.72,
        this.root.position.z
      );
      onRangedAttack(this.attackOrigin);
    } else if (this.distance < 24 && this.distance > 1.45 && !acidInRange) {
      const speed = this.variant === "runner" ? 2.5 : 1.45;
      this.root.position.x += this.direction.x * speed * delta;
      this.root.position.z += this.direction.z * speed * delta;
      this.root.rotation.y =
        Math.atan2(this.direction.x, this.direction.z) + Math.PI;
      const gait = Math.sin(this.animationTime + this.gaitOffset);
      const shamble = Math.sin(this.animationTime * 0.5 + this.twitchOffset);
      this.visualRoot.position.y =
        Math.abs(gait) * (this.variant === "runner" ? 0.075 : 0.045);
      this.visualRoot.rotation.z =
        gait * (this.variant === "runner" ? 0.085 : 0.13) + shamble * 0.035;
      this.visualRoot.rotation.y = shamble * 0.04;
      this.visualRoot.rotation.x =
        (this.variant === "runner" ? -0.11 : -0.04) -
        this.attackAnimation * 0.28;
    } else if (this.distance <= 1.45 && this.attackCooldown === 0) {
      this.attackCooldown = this.variant === "runner" ? 0.78 : 1.15;
      this.attackAnimation = 1;
      onAttack(this.variant === "runner" ? 12 : 16);
    } else {
      const idleTwitch = Math.sin(
        this.animationTime * 0.72 + this.twitchOffset
      );
      this.visualRoot.rotation.z = idleTwitch * 0.035;
      this.visualRoot.rotation.y = idleTwitch * 0.025;
      this.visualRoot.rotation.x =
        -this.attackAnimation * (this.variant === "acid" ? 0.48 : 0.28);
    }
  }

  damage(amount: number): boolean {
    if (this.dead) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      this.root.getChildMeshes().forEach((mesh) => {
        mesh.metadata = { corpse: true };
      });
      return true;
    }
    return false;
  }

  async replaceWithModel(modelUrl: string): Promise<void> {
    try {
      await import("@babylonjs/loaders/glTF");
      const result = await SceneLoader.ImportMeshAsync(
        "",
        "",
        modelUrl,
        this.root.getScene()
      );
      const roots = result.meshes.filter((mesh) => !mesh.parent);
      if (roots.length === 0)
        throw new Error("Model did not contain a root mesh");

      this.visualRoot.getChildMeshes().forEach((mesh) => mesh.dispose());

      const modelRoot = new TransformNode(
        "explorer infected",
        this.root.getScene()
      );
      modelRoot.parent = this.visualRoot;
      roots.forEach((mesh) => {
        mesh.parent = modelRoot;
      });

      let minY = Infinity;
      let maxY = -Infinity;
      modelRoot.getChildMeshes().forEach((mesh) => {
        mesh.computeWorldMatrix(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        minY = Math.min(minY, bounds.minimumWorld.y);
        maxY = Math.max(maxY, bounds.maximumWorld.y);
        mesh.isPickable = true;
        mesh.metadata = { enemy: this };
      });
      const height = maxY - minY;
      if (!Number.isFinite(height) || height <= 0) {
        modelRoot.dispose();
        throw new Error("Model had no renderable bounds");
      }
      const scale = 2.15 / height;
      modelRoot.scaling.setAll(scale);
      modelRoot.position.y = -minY * scale;
      modelRoot.rotation.y = Math.PI;
    } catch (error) {
      console.warn("Could not load explorer infected model", error);
    }
  }

  private part(
    mesh: Mesh,
    material: PBRMaterial,
    position: Vector3,
    rotation = Vector3.Zero(),
    scaling = Vector3.One()
  ): Mesh {
    mesh.position.copyFrom(position);
    mesh.rotation.copyFrom(rotation);
    mesh.scaling.copyFrom(scaling);
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  }

  private mergeParts(parts: Mesh[]): void {
    const merged = Mesh.MergeMeshes(parts, true, true);
    if (!merged) throw new Error("Failed to merge enemy geometry");
    merged.parent = this.visualRoot;
    merged.isPickable = true;
    merged.metadata = { enemy: this };
  }
}
