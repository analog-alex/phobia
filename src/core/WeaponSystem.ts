import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { WEAPON } from "../config/constants";
import type { MaterialLibrary } from "../core/MaterialLibrary";
import { smoothStep } from "../utils/math";

const xmbH2SidearmModelUrl = new URL(
  "../../assests/Meshy_AI_XMB_H2_Assault_Rifle_0703111155_balanced.glb",
  import.meta.url
).href;
const boltRifleModelUrl = new URL(
  "../../assests/Meshy_AI_Olive_Drab_Precision__0703114333_balanced.glb",
  import.meta.url
).href;

export type WeaponKind = "pistol" | "rifle";

interface WeaponPose {
  position: Vector3;
  rotation: Vector3;
}

interface WeaponProfile {
  kind: WeaponKind;
  displayName: string;
  emptyMessage: string;
  modelUrl: string;
  clipSize: number;
  startReserve: number;
  reloadDuration: number;
  damage: number;
  range: number;
  kickScale: number;
  muzzleOffset: Vector3;
  basePose: WeaponPose;
  modelScale: number;
  modelOffset: Vector3;
  modelRotation: Vector3;
}

interface WeaponState {
  clip: number;
  reserve: number;
  root?: TransformNode;
  profile: WeaponProfile;
}

const weaponProfiles: Record<WeaponKind, WeaponProfile> = {
  pistol: {
    kind: "pistol",
    displayName: "XMB H2 Rifle",
    emptyMessage: "Magazine empty",
    modelUrl: xmbH2SidearmModelUrl,
    clipSize: WEAPON.PISTOL.CLIP_SIZE,
    startReserve: WEAPON.PISTOL.START_RESERVE,
    reloadDuration: WEAPON.PISTOL.RELOAD_DURATION,
    damage: WEAPON.PISTOL.DAMAGE,
    range: WEAPON.PISTOL.RANGE,
    kickScale: 1,
    muzzleOffset: new Vector3(0, 0, 0.5),
    basePose: {
      position: new Vector3(
        WEAPON.PISTOL.POSITION.x,
        WEAPON.PISTOL.POSITION.y,
        WEAPON.PISTOL.POSITION.z
      ),
      rotation: new Vector3(
        WEAPON.PISTOL.ROTATION.x,
        WEAPON.PISTOL.ROTATION.y,
        WEAPON.PISTOL.ROTATION.z
      ),
    },
    modelScale: 0.88,
    modelOffset: new Vector3(0.02, -0.14, -0.18),
    modelRotation: new Vector3(0, -Math.PI / 2, 0),
  },
  rifle: {
    kind: "rifle",
    displayName: "A7 Bolt Rifle",
    emptyMessage: "Chamber empty",
    modelUrl: boltRifleModelUrl,
    clipSize: WEAPON.RIFLE.CLIP_SIZE,
    startReserve: WEAPON.RIFLE.START_RESERVE,
    reloadDuration: WEAPON.RIFLE.RELOAD_DURATION,
    damage: WEAPON.RIFLE.DAMAGE,
    range: WEAPON.RIFLE.RANGE,
    kickScale: 1.45,
    muzzleOffset: new Vector3(0, 0.01, 0.76),
    basePose: {
      position: new Vector3(
        WEAPON.RIFLE.POSITION.x,
        WEAPON.RIFLE.POSITION.y,
        WEAPON.RIFLE.POSITION.z
      ),
      rotation: new Vector3(
        WEAPON.RIFLE.ROTATION.x,
        WEAPON.RIFLE.ROTATION.y,
        WEAPON.RIFLE.ROTATION.z
      ),
    },
    modelScale: 0.88,
    modelOffset: new Vector3(0.02, -0.14, -0.18),
    modelRotation: new Vector3(0, -Math.PI / 2, 0),
  },
};

export interface WeaponCallbacks {
  onReloadComplete: () => void;
}

export class WeaponSystem {
  private activeKind: WeaponKind = "pistol";
  private muzzleLight?: PointLight;

  private weaponKick = 0;
  private reloading = false;
  private reloadTime = 0;
  private muzzleFlashRemaining = 0;
  private muzzleFlashOff?: () => void;
  private readonly weapons: Record<WeaponKind, WeaponState> = {
    pistol: {
      profile: weaponProfiles.pistol,
      clip: weaponProfiles.pistol.clipSize,
      reserve: weaponProfiles.pistol.startReserve,
    },
    rifle: {
      profile: weaponProfiles.rifle,
      clip: weaponProfiles.rifle.clipSize,
      reserve: weaponProfiles.rifle.startReserve,
    },
  };

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialLibrary,
    private readonly callbacks: WeaponCallbacks
  ) {}

  getClip(): number {
    return this.active.clip;
  }
  getReserve(): number {
    return this.active.reserve;
  }
  getDamage(): number {
    return this.profile.damage;
  }
  getRange(): number {
    return this.profile.range;
  }
  getEmptyMessage(): string {
    return this.profile.emptyMessage;
  }
  getDisplayName(): string {
    return this.profile.displayName;
  }
  isReloading(): boolean {
    return this.reloading;
  }

  getMuzzleLight(): PointLight | undefined {
    return this.muzzleLight;
  }

  async create(camera: UniversalCamera): Promise<void> {
    await Promise.all(
      (Object.keys(this.weapons) as WeaponKind[]).map(async (kind) => {
        const state = this.weapons[kind];
        const root = await this.createModelWeapon(camera, state.profile).catch(
          (error) => {
            console.warn(
              `Could not load ${state.profile.displayName} model; using fallback`,
              error
            );
            return this.createFallbackWeapon(camera, state.profile);
          }
        );
        root.setEnabled(kind === this.activeKind);
        state.root = root;
      })
    );

    this.muzzleLight = new PointLight(
      "muzzle flash",
      this.profile.muzzleOffset.clone(),
      this.scene
    );
    this.muzzleLight.diffuse = new Color3(1, 0.42, 0.08);
    this.muzzleLight.range = 7;
    this.muzzleLight.intensity = 0;
    this.attachMuzzleLight();
  }

  switchWeapon(): WeaponKind {
    if (this.reloading) return this.activeKind;
    const next: WeaponKind = this.activeKind === "pistol" ? "rifle" : "pistol";
    this.muzzleFlashOff?.();
    this.muzzleFlashOff = undefined;
    this.muzzleFlashRemaining = 0;
    if (this.muzzleLight) this.muzzleLight.intensity = 0;
    this.weaponKick = 0;
    this.reloadTime = 0;
    this.weapons[this.activeKind].root?.setEnabled(false);
    this.activeKind = next;
    this.active.root?.setEnabled(true);
    this.attachMuzzleLight();
    return this.activeKind;
  }

  private createFallbackWeapon(
    camera: UniversalCamera,
    profile: WeaponProfile
  ): TransformNode {
    const slide = CreateBox(
      `${profile.displayName} fallback body`,
      {
        width: profile.kind === "rifle" ? 0.18 : 0.24,
        height: profile.kind === "rifle" ? 0.16 : 0.19,
        depth: profile.kind === "rifle" ? 1.12 : 0.7,
      },
      this.scene
    );
    slide.material = this.materials.gunmetal;
    const barrel = CreateBox(
      `${profile.displayName} fallback barrel`,
      {
        width: profile.kind === "rifle" ? 0.08 : 0.15,
        height: profile.kind === "rifle" ? 0.08 : 0.14,
        depth: profile.kind === "rifle" ? 0.55 : 0.3,
      },
      this.scene
    );
    barrel.position = new Vector3(
      0,
      -0.03,
      profile.kind === "rifle" ? 0.72 : 0.43
    );
    barrel.material = this.materials.gunmetal;
    const root = Mesh.MergeMeshes([slide, barrel], true, true);
    if (!root) throw new Error("Failed to merge weapon geometry");
    root.parent = camera;
    root.position.copyFrom(profile.basePose.position);
    root.rotation.copyFrom(profile.basePose.rotation);
    root.isPickable = false;

    const handle = CreateBox(
      `${profile.displayName} fallback grip`,
      { width: 0.2, height: 0.44, depth: 0.25 },
      this.scene
    );
    handle.parent = root;
    handle.position = new Vector3(0, -0.28, -0.12);
    handle.rotation.x = -0.24;
    handle.material = this.materials.grip;
    handle.isPickable = false;
    return root;
  }

  private async createModelWeapon(
    camera: UniversalCamera,
    profile: WeaponProfile
  ): Promise<TransformNode> {
    await import("@babylonjs/loaders/glTF");
    const container = await SceneLoader.LoadAssetContainerAsync(
      "",
      profile.modelUrl,
      this.scene
    );
    container.addAllToScene();
    container.materials.forEach((material) => {
      material.freeze();
    });

    const root = new TransformNode(profile.displayName, this.scene);
    root.parent = camera;
    root.position.copyFrom(profile.basePose.position);
    root.rotation.copyFrom(profile.basePose.rotation);

    const modelRoot = new TransformNode(
      `${profile.displayName} model`,
      this.scene
    );
    modelRoot.parent = root;
    modelRoot.rotation.copyFrom(profile.modelRotation);
    modelRoot.scaling.setAll(profile.modelScale);

    const assetRoot = new TransformNode(
      `${profile.displayName} asset`,
      this.scene
    );
    assetRoot.parent = modelRoot;
    assetRoot.position.copyFrom(profile.modelOffset);

    container.rootNodes.forEach((node) => {
      node.parent = assetRoot;
    });

    root.getChildMeshes().forEach((mesh) => {
      mesh.isPickable = false;
    });

    return root;
  }

  update(delta: number, moving: boolean): void {
    const root = this.active.root;
    if (!root) return;
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
    const profile = this.profile;
    let reloadPose = 0;
    let magazineSnap = 0;
    if (this.reloading) {
      this.reloadTime = Math.min(
        profile.reloadDuration,
        this.reloadTime + delta
      );
      const progress = this.reloadTime / profile.reloadDuration;
      if (progress < 0.32) reloadPose = smoothStep(progress / 0.32);
      else if (progress < 0.68) {
        reloadPose = 1;
        magazineSnap = Math.sin(((progress - 0.32) / 0.36) * Math.PI);
      } else reloadPose = 1 - smoothStep((progress - 0.68) / 0.32);

      if (this.reloadTime >= profile.reloadDuration) this.finishReload();
    }

    root.position.x = profile.basePose.position.x + reloadPose * 0.16;
    root.position.y =
      profile.basePose.position.y +
      bob -
      this.weaponKick * 0.08 * profile.kickScale -
      reloadPose * 0.29 -
      magazineSnap * 0.055;
    root.position.z = profile.basePose.position.z - reloadPose * 0.08;
    root.rotation.x =
      profile.basePose.rotation.x +
      this.weaponKick * 0.24 * profile.kickScale +
      reloadPose * 0.46 -
      magazineSnap * 0.12;
    root.rotation.y = profile.basePose.rotation.y - reloadPose * 0.34;
    root.rotation.z =
      profile.basePose.rotation.z + reloadPose * 0.52 + magazineSnap * 0.09;
  }

  kick(): void {
    this.weaponKick = 1;
  }

  tryFire(): boolean {
    if (this.reloading) return false;
    if (this.active.clip <= 0) return false;
    this.active.clip -= 1;
    this.kick();
    return true;
  }

  tryReload(): boolean {
    if (
      this.reloading ||
      this.active.clip === this.profile.clipSize ||
      this.active.reserve === 0
    )
      return false;
    this.reloading = true;
    this.reloadTime = 0;
    this.weaponKick = 0;
    return true;
  }

  private finishReload(): void {
    const needed = this.profile.clipSize - this.active.clip;
    const loaded = Math.min(needed, this.active.reserve);
    this.active.clip += loaded;
    this.active.reserve -= loaded;
    this.reloading = false;
    this.reloadTime = 0;
    this.callbacks.onReloadComplete();
  }

  addReserve(amount: number): void {
    this.active.reserve += amount;
  }

  setAmmo(clip: number, reserve: number): void {
    this.active.clip = clip;
    this.active.reserve = reserve;
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

  private attachMuzzleLight(): void {
    if (!this.muzzleLight || !this.active.root) return;
    this.muzzleLight.parent = this.active.root;
    this.muzzleLight.position.copyFrom(this.profile.muzzleOffset);
  }

  private get active(): WeaponState {
    return this.weapons[this.activeKind];
  }

  private get profile(): WeaponProfile {
    return this.active.profile;
  }
}
