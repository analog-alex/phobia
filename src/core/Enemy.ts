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

    this.mergeParts([
      this.part(CreateBox("torso", { width: 0.72, height: 1.05, depth: 0.38 }, scene), uniform, new Vector3(0, 1.2, 0)),
      this.part(CreateBox("leg", { width: 0.27, height: 0.95, depth: 0.3 }, scene), uniform, new Vector3(-0.2, 0.45, 0)),
      this.part(CreateBox("leg", { width: 0.27, height: 0.95, depth: 0.3 }, scene), uniform, new Vector3(0.2, 0.45, 0)),
    ]);
    this.mergeParts([
      this.part(CreateSphere("head", { diameter: 0.48, segments: 8 }, scene), skin, new Vector3(0, 1.96, 0.02)),
      this.part(CreateBox("arm", { width: 0.22, height: 0.95, depth: 0.22 }, scene), skin, new Vector3(-0.5, 1.25, 0.05), -1.05),
      this.part(CreateBox("arm", { width: 0.22, height: 0.95, depth: 0.22 }, scene), skin, new Vector3(0.5, 1.25, 0.05), -1.05),
    ]);
    this.mergeParts([
      this.part(CreateSphere("eye", { diameter: 0.07, segments: 6 }, scene), eye, new Vector3(-0.1, 2.01, -0.22)),
      this.part(CreateSphere("eye", { diameter: 0.07, segments: 6 }, scene), eye, new Vector3(0.1, 2.01, -0.22)),
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
      this.visualRoot.position.y = Math.abs(Math.sin(this.animationTime)) * 0.045;
    } else if (this.distance <= 1.45 && this.attackCooldown === 0) {
      this.attackCooldown = this.variant === "runner" ? 0.78 : 1.15;
      onAttack(this.variant === "runner" ? 12 : 16);
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

  private part(mesh: Mesh, material: PBRMaterial, position: Vector3, rotationX = 0): Mesh {
    mesh.position.copyFrom(position);
    mesh.rotation.x = rotationX;
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
