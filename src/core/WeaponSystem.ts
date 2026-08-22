import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { PICKUPS, WEAPON } from "../config/constants";
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
const droidHandModelUrl = new URL(
  "../../assests/Meshy_AI_Droid_Grip_Hand_balanced.glb",
  import.meta.url
).href;

export type WeaponKind = "xmb" | "rifle";

interface WeaponPose {
  position: Vector3;
  rotation: Vector3;
}

/**
 * Placement of one droid hand in weapon model space.
 *
 * The hand model is unrigged and permanently closed, so it is posed by aiming
 * two of its local axes instead of bending fingers: `forward` is its local +Z
 * (wrist -> fist) and `up` is its local +Y, the channel the curled fingers wrap.
 * Aligning `up` with a grip therefore makes the fist close around that grip.
 */
interface HandPose {
  position: Vector3;
  forward: Vector3;
  up: Vector3;
}

interface WeaponHandPoses {
  right: HandPose;
  left: HandPose;
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
  handPoses: WeaponHandPoses;
}

interface WeaponState {
  clip: number;
  reserve: number;
  root?: TransformNode;
  /** Weapon model space node the droid hands are posed in. */
  assetRoot?: TransformNode;
  profile: WeaponProfile;
}

type Vec3Config = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

function toVector3(value: Vec3Config): Vector3 {
  return new Vector3(value.x, value.y, value.z);
}

function toHandPoses(config: {
  readonly RIGHT: { POSITION: Vec3Config; FORWARD: Vec3Config; UP: Vec3Config };
  readonly LEFT: { POSITION: Vec3Config; FORWARD: Vec3Config; UP: Vec3Config };
}): WeaponHandPoses {
  return {
    right: {
      position: toVector3(config.RIGHT.POSITION),
      forward: toVector3(config.RIGHT.FORWARD),
      up: toVector3(config.RIGHT.UP),
    },
    left: {
      position: toVector3(config.LEFT.POSITION),
      forward: toVector3(config.LEFT.FORWARD),
      up: toVector3(config.LEFT.UP),
    },
  };
}

/**
 * Euler rotation that aims the hand model's local +Z along `forward` and its
 * local +Y as close to `up` as a right angle allows.
 */
function handRotation(pose: HandPose): Vector3 {
  const forward = pose.forward.normalizeToNew();
  const up = pose.up
    .subtract(forward.scale(Vector3.Dot(pose.up, forward)))
    .normalize();
  const right = Vector3.Cross(up, forward).normalize();
  return Vector3.RotationFromAxis(right, up, forward);
}

const weaponProfiles: Record<WeaponKind, WeaponProfile> = {
  xmb: {
    kind: "xmb",
    displayName: "XMB H2 Rifle",
    emptyMessage: "Magazine empty",
    modelUrl: xmbH2SidearmModelUrl,
    clipSize: WEAPON.XMB.CLIP_SIZE,
    startReserve: WEAPON.XMB.START_RESERVE,
    reloadDuration: WEAPON.XMB.RELOAD_DURATION,
    damage: WEAPON.XMB.DAMAGE,
    range: WEAPON.XMB.RANGE,
    kickScale: 1,
    muzzleOffset: new Vector3(0, 0, 0.5),
    basePose: {
      position: new Vector3(
        WEAPON.XMB.POSITION.x,
        WEAPON.XMB.POSITION.y,
        WEAPON.XMB.POSITION.z
      ),
      rotation: new Vector3(
        WEAPON.XMB.ROTATION.x,
        WEAPON.XMB.ROTATION.y,
        WEAPON.XMB.ROTATION.z
      ),
    },
    modelScale: 0.6,
    modelOffset: new Vector3(0.02, -0.14, -0.18),
    modelRotation: new Vector3(0, -Math.PI / 2, 0),
    handPoses: toHandPoses(WEAPON.XMB.HANDS),
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
    modelScale: 0.6,
    modelOffset: new Vector3(0.02, -0.14, -0.18),
    modelRotation: new Vector3(0, -Math.PI / 2, 0),
    handPoses: toHandPoses(WEAPON.RIFLE.HANDS),
  },
};

export interface WeaponCallbacks {
  onReloadComplete: () => void;
}

export class WeaponSystem {
  private activeKind: WeaponKind = "xmb";
  private muzzleLight?: PointLight;
  private camera?: UniversalCamera;

  private weaponKick = 0;
  private reloading = false;
  private reloadTime = 0;
  private muzzleFlashRemaining = 0;
  private muzzleFlashOff?: () => void;
  private acquired = false;
  private hands?: { right: TransformNode; left: TransformNode };
  private readonly weapons: Record<WeaponKind, WeaponState> = {
    xmb: {
      profile: weaponProfiles.xmb,
      clip: weaponProfiles.xmb.clipSize,
      reserve: weaponProfiles.xmb.startReserve,
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
    this.camera = camera;
    await Promise.all([
      ...(Object.keys(this.weapons) as WeaponKind[]).map(async (kind) => {
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
        root.setEnabled(this.acquired && kind === this.activeKind);
        state.root = root;
      }),
      // Hands are cosmetic: a failure here must not block the weapon itself.
      this.createHands().catch((error) => {
        console.warn("Could not load droid hands; showing weapon only", error);
      }),
    ]);

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

  hasWeapon(): boolean {
    return this.acquired;
  }

  placePickup(kind: WeaponKind, position: Vector3): void {
    const root = this.weapons[kind].root;
    if (!root || this.acquired) return;
    root.parent = null;
    root.position.copyFrom(position);
    root.position.y += 0.18;
    root.rotation.set(0.04, -0.35, -0.08);
    root.scaling.setAll(
      WEAPON.PICKUP_DISPLAY_SCALE / this.weapons[kind].profile.modelScale
    );
    root.setEnabled(true);
  }

  private updatePickupSpin(delta: number): void {
    for (const kind of Object.keys(this.weapons) as WeaponKind[]) {
      const root = this.weapons[kind].root;
      if (!root || !root.isEnabled()) continue;
      root.rotation.y += delta * PICKUPS.ROT_SPEED;
    }
  }

  acquire(kind: WeaponKind): void {
    if (this.acquired) return;
    this.activeKind = kind;
    this.acquired = true;
    const unchosen: WeaponKind = kind === "xmb" ? "rifle" : "xmb";
    this.weapons[unchosen].root?.setEnabled(false);
    const root = this.active.root;
    if (root && this.camera) {
      root.parent = this.camera;
      root.position.copyFrom(this.profile.basePose.position);
      root.rotation.copyFrom(this.profile.basePose.rotation);
      root.scaling.setAll(1);
      root.setEnabled(true);
    }
    this.attachHands();
    this.attachMuzzleLight();
  }

  /**
   * Builds one pair of droid hands, kept hidden until a weapon is acquired so
   * they never appear on a weapon still sitting on its pickup pedestal.
   */
  private async createHands(): Promise<void> {
    await import("@babylonjs/loaders/glTF");
    const container = await SceneLoader.LoadAssetContainerAsync(
      "",
      droidHandModelUrl,
      this.scene
    );
    container.addAllToScene();
    container.materials.forEach((material) => {
      material.freeze();
    });

    const source = new TransformNode("droid hand", this.scene);
    container.rootNodes.forEach((node) => {
      node.parent = source;
    });

    // Cloning shares geometry and materials, so the second hand is nearly free.
    const mirrored = source.clone("droid hand mirrored", null);
    if (!mirrored) throw new Error("Failed to clone droid hand");

    this.hands = {
      right: this.buildHandRoot("right", source),
      left: this.buildHandRoot("left", mirrored),
    };

    // A weapon picked up before the hands finished loading still gets them.
    if (this.acquired) this.attachHands();
  }

  private buildHandRoot(
    side: "right" | "left",
    model: TransformNode
  ): TransformNode {
    const root = new TransformNode(`${side} droid hand`, this.scene);
    // Offsetting by the grip pivot puts the fist's finger channel on the
    // root's origin, so each weapon's hand poses read as grip positions.
    const pivot = new TransformNode(`${side} droid hand pivot`, this.scene);
    pivot.parent = root;
    pivot.position.set(
      -WEAPON.HANDS.GRIP_PIVOT.x,
      -WEAPON.HANDS.GRIP_PIVOT.y,
      -WEAPON.HANDS.GRIP_PIVOT.z
    );
    model.parent = pivot;
    root.getChildMeshes().forEach((mesh) => {
      mesh.isPickable = false;
    });
    root.setEnabled(false);
    return root;
  }

  /** Poses the hand pair onto the acquired weapon and reveals it. */
  private attachHands(): void {
    const hands = this.hands;
    const assetRoot = this.active.assetRoot;
    if (!hands || !assetRoot) return;
    const scale = WEAPON.HANDS.SCALE;

    for (const side of ["right", "left"] as const) {
      const pose = this.profile.handPoses[side];
      const root = hands[side];
      root.parent = assetRoot;
      root.position.copyFrom(pose.position);
      root.rotation.copyFrom(handRotation(pose));
      // The left hand is the right hand mirrored across the weapon's long axis.
      root.scaling.set(side === "left" ? -scale : scale, scale, scale);
      root.setEnabled(true);
    }
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

    this.weapons[profile.kind].assetRoot = assetRoot;
    return root;
  }

  update(delta: number, moving: boolean): void {
    if (!this.acquired) {
      this.updatePickupSpin(delta);
      return;
    }
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
      reloadPose * WEAPON.RELOAD_DIP -
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
