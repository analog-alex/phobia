import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { COMBAT, EFFECTS } from "../config/constants";
import type { MaterialLibrary } from "../core/MaterialLibrary";

type ImpactKind = "hard" | "organic" | "acid";

interface ImpactStyle {
  /** Seconds the sprite lives. */
  life: number;
  startScale: number;
  endScale: number;
  startVisibility: number;
}

/**
 * Impact presets. Sparks are bright and shrink fast, blood puffs out and
 * fades, acid splashes bloom wide.
 */
const IMPACT_STYLES: Record<ImpactKind, ImpactStyle> = {
  hard: { life: 0.16, startScale: 0.5, endScale: 0.16, startVisibility: 1 },
  organic: {
    life: 0.42,
    startScale: 0.32,
    endScale: 0.82,
    startVisibility: 0.95,
  },
  acid: { life: 0.5, startScale: 0.4, endScale: 1.15, startVisibility: 0.85 },
};

export interface ImpactEntry {
  mesh: Mesh;
  /** Seconds elapsed; the entry is free when age >= life. */
  age: number;
  life: number;
  style: ImpactStyle;
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
  createImpact: (
    position: Vector3,
    organic: boolean,
    acid?: boolean,
    towards?: Vector3
  ) => void;
  takeDamage: (amount: number) => void;
  onAcidThrowAudio: () => void;
}

export class Effects {
  private readonly impacts: ImpactEntry[] = [];
  private readonly acidProjectiles: AcidProjectile[] = [];
  private readonly impactOffset = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialLibrary
  ) {}

  createImpactPool(): void {
    for (let index = 0; index < EFFECTS.IMPACT_POOL; index += 1) {
      const mesh = CreatePlane(`impact-${index}`, { size: 1 }, this.scene);
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.impacts.push({
        mesh,
        age: Infinity,
        life: 0,
        style: IMPACT_STYLES.hard,
      });
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
      // A soft glow halo sells the projectile as luminous, caustic bile.
      const halo = CreatePlane(`acid-halo-${index}`, { size: 1 }, this.scene);
      halo.material = this.materials.acidSplash;
      halo.billboardMode = Mesh.BILLBOARDMODE_ALL;
      halo.isPickable = false;
      halo.parent = core;
      // Compensates for the core's stretched scale so the halo stays round.
      halo.scaling.set(0.95, 0.95, 0.46);
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

  updateImpactPool(delta: number): void {
    for (const impact of this.impacts) {
      if (impact.age >= impact.life) continue;
      impact.age += delta;
      if (impact.age >= impact.life) {
        impact.mesh.setEnabled(false);
        continue;
      }
      const t = impact.age / impact.life;
      const eased = 1 - (1 - t) * (1 - t);
      const scale =
        impact.style.startScale +
        (impact.style.endScale - impact.style.startScale) * eased;
      impact.mesh.scaling.set(scale, scale, scale);
      impact.mesh.visibility = impact.style.startVisibility * (1 - t * t);
    }
  }

  /**
   * Spawns a pooled impact sprite. `towards` nudges the sprite off the hit
   * surface (usually back along the shot) so the billboard is not half
   * buried in the wall it hit.
   */
  createImpact(
    position: Vector3,
    organic: boolean,
    acid = false,
    towards?: Vector3
  ): void {
    const entry = this.pickReusableImpact();
    const kind: ImpactKind = acid ? "acid" : organic ? "organic" : "hard";
    entry.style = IMPACT_STYLES[kind];
    entry.life = entry.style.life;
    entry.age = 0;
    entry.mesh.position.copyFrom(position);
    if (towards) entry.mesh.position.addInPlace(towards);
    entry.mesh.material = acid
      ? this.materials.acidSplash
      : organic
        ? this.materials.bloodMist
        : this.materials.spark;
    entry.mesh.rotation.z = Math.random() * Math.PI * 2;
    entry.mesh.scaling.setAll(entry.style.startScale);
    entry.mesh.visibility = entry.style.startVisibility;
    entry.mesh.setEnabled(true);
  }

  throwAcid(
    origin: Vector3,
    cameraPosition: Vector3,
    onThrow: (origin: Vector3) => void
  ): void {
    const projectile = this.pickReusableProjectile();
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
        this.impactOffset.copyFrom(projectile.direction).scaleInPlace(-0.12);
        callbacks.createImpact(hit.pickedPoint, false, true, this.impactOffset);
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

  private pickReusableImpact(): ImpactEntry {
    let oldest = this.impacts[0];
    for (const impact of this.impacts) {
      if (impact.age >= impact.life) return impact;
      if (impact.age / impact.life > oldest.age / oldest.life) oldest = impact;
    }
    return oldest;
  }

  private pickReusableProjectile(): AcidProjectile {
    const inactive = this.acidProjectiles.find((entry) => !entry.active);
    if (inactive) return inactive;
    return this.acidProjectiles.reduce((oldest, entry) =>
      entry.age > oldest.age ? entry : oldest
    );
  }

  getAcidProjectiles(): readonly AcidProjectile[] {
    return this.acidProjectiles;
  }
}
