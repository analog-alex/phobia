import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import { WEAPON } from "../config/constants";
import type { MaterialLibrary } from "../core/MaterialLibrary";
import { smoothStep } from "../utils/math";

export interface WeaponCallbacks {
  onReloadComplete: () => void;
}

export class WeaponSystem {
  private weapon?: Mesh;
  private muzzleLight?: PointLight;

  private weaponKick = 0;
  private reloading = false;
  private reloadTime = 0;
  private muzzleFlashRemaining = 0;
  private muzzleFlashOff?: () => void;

  private clip: number;
  private reserve: number;

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialLibrary,
    private readonly callbacks: WeaponCallbacks,
    initialClip = WEAPON.CLIP_SIZE,
    initialReserve = WEAPON.START_RESERVE
  ) {
    this.clip = initialClip;
    this.reserve = initialReserve;
  }

  getClip(): number {
    return this.clip;
  }
  getReserve(): number {
    return this.reserve;
  }
  isReloading(): boolean {
    return this.reloading;
  }

  getMuzzleLight(): PointLight | undefined {
    return this.muzzleLight;
  }

  create(camera: UniversalCamera): void {
    const slide = CreateBox(
      "VX-9 slide",
      { width: 0.24, height: 0.19, depth: 0.7 },
      this.scene
    );
    slide.material = this.materials.gunmetal;
    const barrel = CreateBox(
      "VX-9 barrel",
      { width: 0.15, height: 0.14, depth: 0.3 },
      this.scene
    );
    barrel.position = new Vector3(0, -0.03, 0.43);
    barrel.material = this.materials.gunmetal;
    const root = Mesh.MergeMeshes([slide, barrel], true, true);
    if (!root) throw new Error("Failed to merge weapon geometry");
    root.parent = camera;
    root.position = new Vector3(
      WEAPON.POSITION.x,
      WEAPON.POSITION.y,
      WEAPON.POSITION.z
    );
    root.rotation = new Vector3(
      WEAPON.ROTATION.x,
      WEAPON.ROTATION.y,
      WEAPON.ROTATION.z
    );
    root.isPickable = false;

    const handle = CreateBox(
      "VX-9 grip",
      { width: 0.2, height: 0.44, depth: 0.25 },
      this.scene
    );
    handle.parent = root;
    handle.position = new Vector3(0, -0.28, -0.12);
    handle.rotation.x = -0.24;
    handle.material = this.materials.grip;
    handle.isPickable = false;

    this.muzzleLight = new PointLight(
      "muzzle flash",
      new Vector3(0, 0, 0.73),
      this.scene
    );
    this.muzzleLight.parent = root;
    this.muzzleLight.diffuse = new Color3(1, 0.42, 0.08);
    this.muzzleLight.range = 7;
    this.muzzleLight.intensity = 0;
    this.weapon = root;
  }

  update(delta: number, moving: boolean): void {
    if (!this.weapon) return;
    this.weaponKick = Math.max(0, this.weaponKick - delta * WEAPON.KICK_DECAY);
    if (this.muzzleFlashRemaining > 0) {
      this.muzzleFlashRemaining = Math.max(
        0,
        this.muzzleFlashRemaining - delta
      );
      if (this.muzzleFlashRemaining === 0 && this.muzzleLight) {
        this.muzzleLight.intensity = 0;
        this.muzzleFlashOff?.();
        this.muzzleFlashOff = undefined;
      }
    }
    const time = performance.now() * 0.008;
    const bob = moving ? Math.sin(time) * WEAPON.BOB_AMPLITUDE : 0;
    let reloadPose = 0;
    let magazineSnap = 0;
    if (this.reloading) {
      this.reloadTime = Math.min(
        WEAPON.RELOAD_DURATION,
        this.reloadTime + delta
      );
      const progress = this.reloadTime / WEAPON.RELOAD_DURATION;
      if (progress < 0.32) reloadPose = smoothStep(progress / 0.32);
      else if (progress < 0.68) {
        reloadPose = 1;
        magazineSnap = Math.sin(((progress - 0.32) / 0.36) * Math.PI);
      } else reloadPose = 1 - smoothStep((progress - 0.68) / 0.32);

      if (this.reloadTime >= WEAPON.RELOAD_DURATION) this.finishReload();
    }

    this.weapon.position.x = WEAPON.POSITION.x + reloadPose * 0.16;
    this.weapon.position.y =
      WEAPON.POSITION.y +
      bob -
      this.weaponKick * 0.08 -
      reloadPose * 0.29 -
      magazineSnap * 0.055;
    this.weapon.position.z = WEAPON.POSITION.z - reloadPose * 0.08;
    this.weapon.rotation.x =
      WEAPON.ROTATION.x +
      this.weaponKick * 0.24 +
      reloadPose * 0.46 -
      magazineSnap * 0.12;
    this.weapon.rotation.y = WEAPON.ROTATION.y - reloadPose * 0.34;
    this.weapon.rotation.z =
      WEAPON.ROTATION.z + reloadPose * 0.52 + magazineSnap * 0.09;
  }

  kick(): void {
    this.weaponKick = 1;
  }

  tryFire(): boolean {
    if (this.reloading) return false;
    if (this.clip <= 0) return false;
    this.clip -= 1;
    this.kick();
    return true;
  }

  tryReload(): boolean {
    if (this.reloading || this.clip === WEAPON.CLIP_SIZE || this.reserve === 0)
      return false;
    this.reloading = true;
    this.reloadTime = 0;
    this.weaponKick = 0;
    return true;
  }

  private finishReload(): void {
    const needed = WEAPON.CLIP_SIZE - this.clip;
    const loaded = Math.min(needed, this.reserve);
    this.clip += loaded;
    this.reserve -= loaded;
    this.reloading = false;
    this.reloadTime = 0;
    this.callbacks.onReloadComplete();
  }

  addReserve(amount: number): void {
    this.reserve += amount;
  }

  setAmmo(clip: number, reserve: number): void {
    this.clip = clip;
    this.reserve = reserve;
  }

  triggerMuzzle(
    on: () => void,
    off: () => void,
    durationMs = WEAPON.MUZZLE_FLASH_MS
  ): void {
    if (!this.muzzleLight) return;
    on();
    this.muzzleFlashOff = off;
    this.muzzleFlashRemaining = durationMs / 1000;
  }
}
