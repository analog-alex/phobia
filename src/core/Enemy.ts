import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { MaterialLibrary } from "./MaterialLibrary";

export type EnemyVariant = "infected" | "runner";

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
  private decisionTimer = Math.random() * 0.05;
  private distance = Infinity;
  private attackAnimation = 0;
  private readonly gaitOffset = Math.random() * Math.PI * 2;
  private readonly twitchOffset = Math.random() * Math.PI * 2;

  constructor(
    scene: Scene,
    position: Vector3,
    private readonly variant: EnemyVariant,
    materials: MaterialLibrary,
  ) {
    this.health = variant === "runner" ? 55 : 75;
    this.root = new TransformNode(`enemy-${variant}`, scene);
    this.root.position.copyFrom(position);
    this.visualRoot = new TransformNode(`enemy-visual-${variant}`, scene);
    this.visualRoot.parent = this.root;

    const { uniform, skin, eye } = materials.enemy(variant);

    const runner = variant === "runner";
    const lean = runner ? -0.31 : -0.2;
    this.mergeParts([
      this.part(CreateBox("torn torso", { width: 0.76, height: 0.98, depth: 0.42 }, scene), uniform, new Vector3(0.03, 1.22, -0.04), new Vector3(lean, 0, -0.07)),
      this.part(CreateBox("left leg", { width: 0.28, height: 0.92, depth: 0.31 }, scene), uniform, new Vector3(-0.2, 0.46, 0.03), new Vector3(0.08, 0, -0.04)),
      this.part(CreateBox("right leg", { width: 0.27, height: 0.88, depth: 0.3 }, scene), uniform, new Vector3(0.21, 0.43, -0.02), new Vector3(-0.12, 0, 0.08)),
      this.part(CreateBox("torn shoulder", { width: 0.3, height: 0.32, depth: 0.44 }, scene), uniform, new Vector3(-0.43, 1.54, -0.08), new Vector3(lean, 0, -0.18)),
    ]);
    this.mergeParts([
      this.part(CreateSphere("infected head", { diameter: 0.5, segments: 8 }, scene), skin, new Vector3(-0.04, 1.94, -0.16), new Vector3(-0.18, 0.14, runner ? -0.18 : 0.16), new Vector3(0.93, 1.06, 0.9)),
      this.part(CreateBox("broken jaw", { width: 0.3, height: 0.16, depth: 0.24 }, scene), skin, new Vector3(-0.01, 1.78, -0.32), new Vector3(-0.34, 0.12, 0.08)),
      this.part(CreateBox("left upper arm", { width: 0.22, height: 0.68, depth: 0.23 }, scene), skin, new Vector3(-0.49, 1.3, -0.14), new Vector3(-0.72, 0, -0.18)),
      this.part(CreateBox("left forearm", { width: 0.2, height: 0.62, depth: 0.21 }, scene), skin, new Vector3(-0.48, 1.02, -0.53), new Vector3(-1.02, 0, 0.05)),
      this.part(CreateBox("right upper arm", { width: 0.23, height: 0.7, depth: 0.23 }, scene), skin, new Vector3(0.49, 1.31, -0.06), new Vector3(-0.3, 0, 0.16)),
      this.part(CreateBox("right forearm", { width: 0.2, height: 0.64, depth: 0.21 }, scene), skin, new Vector3(0.52, 0.91, -0.2), new Vector3(0.16, 0, -0.1)),
      this.part(CreateSphere("swollen hand", { diameter: 0.25, segments: 6 }, scene), skin, new Vector3(-0.48, 0.83, -0.78), Vector3.Zero(), new Vector3(0.9, 1.2, 0.8)),
    ]);
    this.mergeParts([
      this.part(CreateSphere("infected eye", { diameter: 0.075, segments: 6 }, scene), eye, new Vector3(-0.13, 1.99, -0.385)),
      this.part(CreateSphere("infected eye", { diameter: 0.055, segments: 6 }, scene), eye, new Vector3(0.08, 1.97, -0.39)),
      this.part(CreateSphere("facial lesion", { diameter: 0.11, segments: 6 }, scene), eye, new Vector3(0.16, 1.86, -0.37), Vector3.Zero(), new Vector3(1.1, 0.55, 0.35)),
      this.part(CreateBox("bloody mouth", { width: 0.21, height: 0.045, depth: 0.035 }, scene), eye, new Vector3(-0.01, 1.8, -0.455), new Vector3(0.08, 0, 0.08)),
    ]);
  }

  get isDead(): boolean {
    return this.dead;
  }

  update(delta: number, playerPosition: Vector3, onAttack: (damage: number) => void): void {
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
      this.decisionTimer += 0.05;
      playerPosition.subtractToRef(this.root.position, this.offset);
      this.distance = Math.hypot(this.offset.x, this.offset.z);
      if (this.distance > 0) this.direction.set(this.offset.x / this.distance, 0, this.offset.z / this.distance);
    }

    if (this.distance < 24 && this.distance > 1.45) {
      const speed = this.variant === "runner" ? 2.5 : 1.45;
      this.root.position.x += this.direction.x * speed * delta;
      this.root.position.z += this.direction.z * speed * delta;
      this.root.rotation.y = Math.atan2(this.direction.x, this.direction.z) + Math.PI;
      const gait = Math.sin(this.animationTime + this.gaitOffset);
      const shamble = Math.sin(this.animationTime * 0.5 + this.twitchOffset);
      this.visualRoot.position.y = Math.abs(gait) * (this.variant === "runner" ? 0.075 : 0.045);
      this.visualRoot.rotation.z = gait * (this.variant === "runner" ? 0.085 : 0.13) + shamble * 0.035;
      this.visualRoot.rotation.y = shamble * 0.04;
      this.visualRoot.rotation.x = (this.variant === "runner" ? -0.11 : -0.04) - this.attackAnimation * 0.28;
    } else if (this.distance <= 1.45 && this.attackCooldown === 0) {
      this.attackCooldown = this.variant === "runner" ? 0.78 : 1.15;
      this.attackAnimation = 1;
      onAttack(this.variant === "runner" ? 12 : 16);
    } else {
      const idleTwitch = Math.sin(this.animationTime * 0.72 + this.twitchOffset);
      this.visualRoot.rotation.z = idleTwitch * 0.035;
      this.visualRoot.rotation.y = idleTwitch * 0.025;
      this.visualRoot.rotation.x = -this.attackAnimation * 0.28;
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

  private part(
    mesh: Mesh,
    material: PBRMaterial,
    position: Vector3,
    rotation = Vector3.Zero(),
    scaling = Vector3.One(),
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
