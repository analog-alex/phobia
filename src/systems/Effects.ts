import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { COMBAT, EFFECTS } from "../config/constants";
import type { MaterialLibrary } from "../core/MaterialLibrary";

export interface ImpactEntry {
  mesh: Mesh;
  expiresAt: number;
}

export interface AcidProjectile {
  mesh: Mesh;
  velocity: Vector3;
  nextPosition: Vector3;
  direction: Vector3;
  ray: Ray;
  active: boolean;
  age: number;
}

export interface EffectsCallbacks {
  createImpact: (position: Vector3, organic: boolean, acid?: boolean) => void;
  takeDamage: (amount: number) => void;
  onAcidThrowAudio: () => void;
}

export class Effects {
  private readonly impacts: ImpactEntry[] = [];
  private readonly acidProjectiles: AcidProjectile[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialLibrary
  ) {}

  createImpactPool(): void {
    for (let index = 0; index < EFFECTS.IMPACT_POOL; index += 1) {
      const mesh = CreateSphere(
        `impact-${index}`,
        { diameter: 0.09, segments: 5 },
        this.scene
      );
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.impacts.push({ mesh, expiresAt: 0 });
    }
  }

  createAcidProjectilePool(): void {
    for (let index = 0; index < EFFECTS.ACID_POOL; index += 1) {
      const core = CreateSphere(
        `acid-projectile-${index}`,
        { diameter: 0.25, segments: 6 },
        this.scene
      );
      core.material = this.materials.acid;
      core.scaling.set(0.8, 0.8, 1.65);
      core.isPickable = false;
      core.setEnabled(false);
      const direction = new Vector3(0, 0, 1);
      this.acidProjectiles.push({
        mesh: core,
        velocity: new Vector3(),
        nextPosition: new Vector3(),
        direction,
        ray: new Ray(new Vector3(), direction, 0),
        active: false,
        age: 0,
      });
    }
  }

  updateImpactPool(): void {
    const now = performance.now();
    this.impacts.forEach((impact) => {
      if (impact.mesh.isEnabled() && impact.expiresAt <= now)
        impact.mesh.setEnabled(false);
    });
  }

  createImpact(position: Vector3, organic: boolean, acid = false): void {
    const entry =
      this.impacts.find((impact) => !impact.mesh.isEnabled()) ??
      this.impacts[0];
    entry.mesh.position.copyFrom(position);
    entry.mesh.material = acid
      ? this.materials.acid
      : organic
        ? this.materials.organicImpact
        : this.materials.hardImpact;
    entry.mesh.scaling.setAll(acid ? 3.2 : 1);
    entry.expiresAt = performance.now() + EFFECTS.IMPACT_LIFETIME_MS;
    entry.mesh.setEnabled(true);
  }

  throwAcid(
    origin: Vector3,
    cameraPosition: Vector3,
    onThrow: (origin: Vector3) => void
  ): void {
    const projectile =
      this.acidProjectiles.find((entry) => !entry.active) ??
      this.acidProjectiles[0];
    const distance = Vector3.Distance(origin, cameraPosition);
    const flightTime = Math.max(
      EFFECTS.ACID_FLIGHT_MIN,
      Math.min(EFFECTS.ACID_FLIGHT_MAX, distance / EFFECTS.ACID_SPEED_DIV)
    );
    const gravity = EFFECTS.ACID_GRAVITY;
    projectile.mesh.position.copyFrom(origin);
    projectile.velocity.set(
      (cameraPosition.x - origin.x) / flightTime,
      (cameraPosition.y -
        0.35 -
        origin.y +
        0.5 * gravity * flightTime * flightTime) /
        flightTime,
      (cameraPosition.z - origin.z) / flightTime
    );
    projectile.active = true;
    projectile.age = 0;
    projectile.mesh.setEnabled(true);
    onThrow(origin);
  }

  updateAcidProjectiles(
    delta: number,
    cameraPosition: Vector3,
    callbacks: Pick<EffectsCallbacks, "createImpact" | "takeDamage">
  ): void {
    const gravity = EFFECTS.ACID_GRAVITY;
    this.acidProjectiles.forEach((projectile) => {
      if (!projectile.active) return;
      projectile.age += delta;
      projectile.velocity.y -= gravity * delta;
      projectile.nextPosition
        .copyFrom(projectile.velocity)
        .scaleInPlace(delta)
        .addInPlace(projectile.mesh.position);

      const travel = Vector3.Distance(
        projectile.mesh.position,
        projectile.nextPosition
      );
      projectile.nextPosition.subtractToRef(
        projectile.mesh.position,
        projectile.direction
      );
      projectile.direction.normalize();
      projectile.ray.origin.copyFrom(projectile.mesh.position);
      projectile.ray.length = travel;

      const hit = this.scene.pickWithRay(projectile.ray, (mesh) =>
        Boolean(
          (mesh as { metadata?: unknown }).metadata &&
            (
              (mesh as { metadata: { collision?: boolean } }).metadata as {
                collision?: boolean;
              }
            ).collision
        )
      );
      const playerDistance = Vector3.Distance(
        projectile.nextPosition,
        cameraPosition
      );

      if (hit?.hit && hit.pickedPoint) {
        callbacks.createImpact(hit.pickedPoint, false, true);
        this.disableAcidProjectile(projectile);
      } else if (playerDistance < EFFECTS.ACID_PLAYER_RADIUS) {
        callbacks.createImpact(projectile.nextPosition, false, true);
        callbacks.takeDamage(COMBAT.ACID_DAMAGE);
        this.disableAcidProjectile(projectile);
      } else if (projectile.age >= EFFECTS.ACID_MAX_AGE) {
        this.disableAcidProjectile(projectile);
      } else {
        projectile.mesh.position.copyFrom(projectile.nextPosition);
        projectile.mesh.rotation.x += delta * 8;
        projectile.mesh.rotation.z += delta * 11;
      }
    });
  }

  private disableAcidProjectile(projectile: AcidProjectile): void {
    projectile.active = false;
    projectile.mesh.setEnabled(false);
  }

  getAcidProjectiles(): readonly AcidProjectile[] {
    return this.acidProjectiles;
  }
}
