import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import "@babylonjs/core/Collisions/collisionCoordinator";

import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { BloomEffect } from "@babylonjs/core/PostProcesses/bloomEffect";
import { ChromaticAberrationPostProcess } from "@babylonjs/core/PostProcesses/chromaticAberrationPostProcess";
import { FxaaPostProcess } from "@babylonjs/core/PostProcesses/fxaaPostProcess";
import { PostProcessRenderEffect } from "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderEffect";
import { PostProcessRenderPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipeline";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import { Scene } from "@babylonjs/core/scene";
import { COMBAT, LEVEL, PLAYER, WEAPON } from "../config/constants";
import { Sector7 } from "../levels/Sector7";
import { WasteDisposal } from "../levels/WasteDisposal";
import { AudioSystem } from "../systems/AudioSystem";
import { Effects } from "../systems/Effects";
import {
  QualityManager,
  type QualityPreset,
  type QualitySettings,
  type QualityTier,
} from "../systems/QualityManager";
import { isEnemyMetadata } from "../types";
import { Diagnostics } from "../ui/Diagnostics";
import { HUD } from "../ui/HUD";
import { horizontalDistanceSquared } from "../utils/math";
import { Enemy } from "./Enemy";
import { MaterialLibrary } from "./MaterialLibrary";
import { getPickupReward } from "./PickupLogic";
import { PlayerController } from "./PlayerController";
import { RunProgression } from "./RunProgression";
import type { WeaponKind } from "./WeaponSystem";
import { WeaponSystem } from "./WeaponSystem";

const zombieModelUrl = new URL(
  "../../assests/Meshy_AI__0626205329_animated_balanced.glb",
  import.meta.url
).href;
const acidZombieModelUrl = new URL(
  "../../assests/Meshy_AI_Neon_Plague_Chemist_0626210338_balanced.glb",
  import.meta.url
).href;

export class Game {
  private readonly engine: Engine;
  private readonly scene: Scene;
  readonly camera: UniversalCamera;
  private readonly hud = new HUD();
  private readonly audio = new AudioSystem();
  private readonly materials: MaterialLibrary;
  private readonly quality: QualityManager;
  private readonly keys = new Set<string>();
  private readonly enemies: Enemy[] = [];
  private readonly sectorEnemies: Enemy[] = [];
  private readonly pipeline: PostProcessRenderPipeline;
  private readonly bloom: BloomEffect;
  private readonly fxaa: FxaaPostProcess;
  private readonly chromaticAberration: ChromaticAberrationPostProcess;
  private readonly diagnostics: Diagnostics;
  private readonly player: PlayerController;
  private readonly effects: Effects;
  private readonly weaponSys: WeaponSystem;
  private readonly progression = new RunProgression();
  private readonly onEnemyDamage = (damage: number): void =>
    this.takeDamage(damage);
  private readonly onAcidSound = (): void => this.audio.acidThrow();
  private readonly onAcidThrow = (origin: Vector3): void =>
    this.effects.throwAcid(origin, this.camera.position, this.onAcidSound);
  private readonly acidCallbacks = {
    createImpact: (position: Vector3, organic: boolean, acid = false) =>
      this.effects.createImpact(position, organic, acid),
    takeDamage: (damage: number) => this.takeDamage(damage),
  };

  private level?: Sector7;
  private wasteLevel?: WasteDisposal;
  private wasteEnemy?: Enemy;
  private weaponChoices: ReadonlyArray<{
    kind: WeaponKind;
    trigger: Mesh;
  }> = [];
  private health: number = COMBAT.MAX_HEALTH;
  private kills = 0;
  private startTime = 0;
  private lastFrameMs = 0;
  private currentSettings: QualitySettings;
  private started = false;
  private paused = false;
  private ended = false;
  private gameplayCursorHidden = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      stencil: true,
      preserveDrawingBuffer: false,
    });
    this.scene = new Scene(this.engine);
    this.materials = new MaterialLibrary(this.scene);
    this.pipeline = new PostProcessRenderPipeline(
      this.engine,
      "performance-pipeline"
    );
    this.bloom = new BloomEffect(this.scene, 0.5, 0.18, 42);
    this.fxaa = new FxaaPostProcess("fxaa", 1, null, undefined, this.engine);
    this.chromaticAberration = new ChromaticAberrationPostProcess(
      "chromatic",
      1280,
      720,
      1,
      null,
      undefined,
      this.engine
    );
    this.currentSettings = {
      renderScale: 0.8,
      antialiasing: "fxaa",
      samples: 1,
      bloom: true,
      chromaticAberration: false,
      dynamicLights: 4,
    };
    this.quality = new QualityManager((tier, settings) =>
      this.applyQuality(tier, settings)
    );
    this.effects = new Effects(this.scene, this.materials);
    const cam = new UniversalCamera(
      "operative camera",
      new Vector3(0, PLAYER.HEIGHT, -116),
      this.scene
    );
    this.player = new PlayerController(
      cam,
      this.scene,
      () => this.keys,
      () => this.isGameplayActive()
    );
    this.camera = this.player.camera;
    this.weaponSys = new WeaponSystem(this.scene, this.materials, {
      onReloadComplete: () =>
        this.hud.setAmmo(this.weaponSys.getClip(), this.weaponSys.getReserve()),
    });
    this.diagnostics = new Diagnostics(
      this.engine,
      this.scene,
      this.quality,
      () =>
        (this.progression.phase === "waste"
          ? (this.wasteLevel?.getActiveLightCount() ?? 0)
          : (this.level?.getActiveLightCount() ?? 0)) +
        ((this.weaponSys.getMuzzleLight()?.intensity ?? 0) > 0 ? 1 : 0)
    );
  }

  async initialize(): Promise<void> {
    // Camera configured inside PlayerController
    this.canvas.style.cursor = "none";
    this.player.attachControl(this.canvas);
    this.scene.activeCamera = this.camera;
    this.configureLightingAndPostProcessing();
    this.quality.initialize();
    this.updateQualityButtons();
    this.wasteLevel = new WasteDisposal(this.scene, this.materials);
    this.level = new Sector7(this.scene, this.materials);
    this.level.setActive(false);
    this.level.setLightBudget(this.currentSettings.dynamicLights);
    this.wasteLevel.setLightBudget(this.currentSettings.dynamicLights);
    const [zombieModel, acidZombieModel] = await Promise.all([
      this.loadEnemyModel(zombieModelUrl, "zombie"),
      this.loadEnemyModel(acidZombieModelUrl, "acid zombie"),
      this.level.loadPickupModels(),
      this.wasteLevel.loadPropModels(),
      this.level.loadPropModels(),
    ]);
    this.level.enemySpawns.forEach(({ position, variant }) => {
      const enemy = new Enemy(this.scene, position, variant, this.materials);
      this.enemies.push(enemy);
      this.sectorEnemies.push(enemy);
      enemy.root.setEnabled(false);
      const model =
        variant === "acid" ? (acidZombieModel ?? zombieModel) : zombieModel;
      if (model) enemy.replaceWithModel(model);
    });
    this.wasteEnemy = new Enemy(
      this.scene,
      this.wasteLevel.enemySpawn,
      "infected",
      this.materials
    );
    this.enemies.push(this.wasteEnemy);
    if (zombieModel) this.wasteEnemy.replaceWithModel(zombieModel);
    await this.weaponSys.create(this.camera);
    this.weaponSys.placePickup("xmb", this.wasteLevel.xmbPickup.position);
    this.weaponSys.placePickup("rifle", this.wasteLevel.boltPickup.position);
    this.weaponChoices = [
      { kind: "xmb", trigger: this.wasteLevel.xmbPickup },
      { kind: "rifle", trigger: this.wasteLevel.boltPickup },
    ];
    this.effects.createImpactPool();
    this.effects.createAcidProjectilePool();
    this.bindEvents();
    this.hud.setHealth(this.health);
    this.hud.setWeaponName(this.weaponSys.getDisplayName());
    this.hud.setAmmo(this.weaponSys.getClip(), this.weaponSys.getReserve());
    this.scene.onBeforeRenderObservable.add(() => this.update());
    this.scene.onAfterRenderObservable.add(() => {
      this.diagnostics.update(
        this.lastFrameMs,
        Math.min(0.033, this.lastFrameMs / 1000)
      );
    });
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }

  private configureLightingAndPostProcessing(): void {
    const ambient = new HemisphericLight(
      "ambient spill",
      new Vector3(0, 1, 0),
      this.scene
    );
    ambient.diffuse = new Color3(0.3, 0.5, 0.48);
    ambient.groundColor = new Color3(0.045, 0.075, 0.08);
    ambient.intensity = 0.48;

    this.scene.imageProcessingConfiguration.contrast = 1.18;
    this.scene.imageProcessingConfiguration.exposure = 1.08;
    this.bloom.threshold = 0.72;
    this.chromaticAberration.aberrationAmount = 5;
    this.pipeline.addEffect(this.bloom);
    this.pipeline.addEffect(
      new PostProcessRenderEffect(this.engine, "fxaa", () => this.fxaa)
    );
    this.pipeline.addEffect(
      new PostProcessRenderEffect(
        this.engine,
        "chromatic",
        () => this.chromaticAberration
      )
    );
    this.scene.postProcessRenderPipelineManager.addPipeline(this.pipeline);
    this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(
      this.pipeline.name,
      this.camera,
      true
    );
  }

  private async loadEnemyModel(
    modelUrl: string,
    label: string
  ): Promise<AssetContainer | undefined> {
    try {
      await import("@babylonjs/loaders/glTF");
      const container = await SceneLoader.LoadAssetContainerAsync(
        "",
        modelUrl,
        this.scene
      );
      container.materials.forEach((material) => {
        material.freeze();
      });
      return container;
    } catch (error) {
      console.warn(`Could not load ${label} model; using fallback`, error);
      return undefined;
    }
  }

  private bindEvents(): void {
    const restartButton = document.getElementById("restart-button");
    const pauseRestartButton = document.getElementById("pause-restart-button");
    const resumeButton = document.getElementById("resume-button");
    restartButton?.addEventListener("click", () => window.location.reload());
    pauseRestartButton?.addEventListener("click", () =>
      window.location.reload()
    );
    resumeButton?.addEventListener("click", () => this.resume());
    document
      .querySelectorAll<HTMLButtonElement>("[data-quality]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          this.quality.setPreset(button.dataset.quality as QualityPreset);
          this.updateQualityButtons();
        });
      });
    document.addEventListener("pointerlockchange", () => {
      if (
        this.started &&
        !this.ended &&
        !this.paused &&
        document.pointerLockElement !== this.canvas
      ) {
        this.pause();
      }
    });
    this.canvas.addEventListener("click", () => {
      if (
        this.started &&
        !this.paused &&
        !this.ended &&
        document.pointerLockElement !== this.canvas
      ) {
        this.setGameplayCursorHidden(true);
        this.requestPointerLock();
        void this.audio.resume();
      }
    });
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button === 0 && document.pointerLockElement === this.canvas)
        this.fire();
    });

    window.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (!this.started || this.ended) return;
      if (event.code === "F3") {
        event.preventDefault();
        this.diagnostics.toggle();
        return;
      }
      if (event.code === "Escape") {
        event.preventDefault();
        if (this.paused) this.resume();
        else this.pause();
        return;
      }
      if (this.paused) return;
      if (
        event.code === "KeyR" ||
        event.code === "KeyE" ||
        event.code === "Space"
      )
        event.preventDefault();
      if (event.code === "KeyR") this.reload();
      if (event.code === "KeyE") this.interact();
      if (event.code === "Space" && !event.repeat) this.jump();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
  }

  private update(): void {
    const frameMs = this.engine.getDeltaTime();
    const delta = Math.min(0.033, frameMs / 1000);
    this.lastFrameMs = frameMs;
    const active = this.isGameplayActive();
    this.setGameplayCursorHidden(active);
    this.quality.update(frameMs, delta, active);
    if (!active || !this.level) return;
    this.hud.update(delta);
    this.audio.update(delta);
    this.effects.updateImpactPool();
    this.player.syncCameraHeight();

    const moving =
      this.keys.has("KeyW") ||
      this.keys.has("KeyA") ||
      this.keys.has("KeyS") ||
      this.keys.has("KeyD");
    this.activeLevel?.update(delta, this.camera.position);
    this.weaponSys.update(delta, moving);
    this.updateEnemies(delta);
    if (this.progression.phase === "sector7")
      this.effects.updateAcidProjectiles(
        delta,
        this.camera.position,
        this.acidCallbacks
      );
    this.updatePickups();
    this.updateWeaponPickup();
    this.updateExtractionPrompt();
  }

  private isGameplayActive(): boolean {
    return this.started && !this.paused && !this.ended;
  }

  private updateEnemies(delta: number): void {
    if (this.progression.phase === "waste") {
      if (this.wasteEnemy) this.updateEnemy(this.wasteEnemy, delta);
      return;
    }
    for (const enemy of this.sectorEnemies) this.updateEnemy(enemy, delta);
  }

  private updateEnemy(enemy: Enemy, delta: number): void {
    enemy.update(
      delta,
      this.camera.position,
      this.onEnemyDamage,
      this.onAcidThrow
    );
  }

  private updatePickups(): void {
    if (!this.level || this.progression.phase !== "sector7") return;
    for (const pickup of this.level.pickups) {
      if (
        !pickup.active ||
        horizontalDistanceSquared(pickup.mesh.position, this.camera.position) >
          1.45 ** 2
      )
        continue;
      const reward = getPickupReward(pickup.kind, this.health);
      if (!reward) continue;
      if (reward.kind === "health") {
        this.health = reward.health;
        this.hud.setHealth(this.health);
        this.hud.flashMessage("Trauma kit acquired");
      } else {
        this.weaponSys.addReserve(reward.amount);
        this.hud.setAmmo(this.weaponSys.getClip(), this.weaponSys.getReserve());
        this.hud.flashMessage(
          `${this.weaponSys.getDisplayName()} ammunition acquired`
        );
      }
      pickup.active = false;
      pickup.mesh.setEnabled(false);
      this.audio.pickup();
    }
  }

  private updateWeaponPickup(): void {
    if (!this.wasteLevel || this.weaponSys.hasWeapon()) return;
    let choice: (typeof this.weaponChoices)[number] | undefined;
    for (const candidate of this.weaponChoices) {
      if (
        Vector3.DistanceSquared(
          candidate.trigger.position,
          this.camera.position
        ) <=
        2.15 ** 2
      ) {
        choice = candidate;
        break;
      }
    }
    if (!choice) return;
    if (!this.progression.selectWeapon(choice.kind)) return;
    this.weaponSys.acquire(choice.kind);
    this.wasteLevel.xmbPickup.setEnabled(false);
    this.wasteLevel.boltPickup.setEnabled(false);
    this.hud.setWeaponName(this.weaponSys.getDisplayName());
    this.hud.setAmmo(this.weaponSys.getClip(), this.weaponSys.getReserve());
    this.hud.flashMessage(
      `${this.weaponSys.getDisplayName()} selected // Left click to fire`,
      2600
    );
    this.hud.setObjective("Clear the disposal bay and reach the lift");
    this.audio.pickup();
  }

  private updateExtractionPrompt(): void {
    if (!this.level) return;
    if (this.progression.phase === "waste" && this.wasteLevel) {
      const distanceSquared = Vector3.DistanceSquared(
        this.wasteLevel.elevatorConsole.position,
        this.camera.position
      );
      if (distanceSquared > LEVEL.EXTRACTION_DISTANCE ** 2) {
        this.hud.setPrompt("");
        return;
      }
      this.hud.setPrompt(
        this.wasteEnemy?.isDead
          ? "[ E ] ASCEND TO SECTOR 7"
          : "ELEVATOR INTERLOCK // INFECTED IN DISPOSAL BAY"
      );
      return;
    }
    const distanceSquared = Vector3.DistanceSquared(
      this.level.elevatorConsole.position,
      this.camera.position
    );
    if (distanceSquared > LEVEL.EXTRACTION_DISTANCE ** 2) {
      this.hud.setPrompt("");
      return;
    }
    const remaining = this.enemies.length - this.kills;
    this.hud.setPrompt(
      remaining > 0
        ? `LOCKDOWN ACTIVE // ${remaining} HOSTILES REMAIN`
        : "[ E ] AUTHORIZE EXTRACTION"
    );
  }

  private fire(): void {
    if (
      !this.started ||
      this.paused ||
      this.ended ||
      this.weaponSys.isReloading() ||
      !this.progression.allowsWeaponAction
    )
      return;
    if (this.weaponSys.getClip() <= 0) {
      this.audio.empty();
      this.hud.flashMessage(this.weaponSys.getEmptyMessage(), 700);
      return;
    }

    if (!this.weaponSys.tryFire()) return;
    this.hud.setAmmo(this.weaponSys.getClip(), this.weaponSys.getReserve());
    this.hud.kickCrosshair();
    this.audio.shoot();

    const muzzle = this.weaponSys.getMuzzleLight();
    if (muzzle) {
      this.activeLevel?.setLightBudget(
        Math.max(1, this.currentSettings.dynamicLights - 1)
      );
      this.weaponSys.triggerMuzzle(
        () => (muzzle.intensity = WEAPON.MUZZLE_FLASH_INTENSITY),
        () => {
          if (muzzle) muzzle.intensity = 0;
          this.activeLevel?.setLightBudget(this.currentSettings.dynamicLights);
        }
      );
    }

    const ray = this.camera.getForwardRay(this.weaponSys.getRange());
    const hit = this.scene.pickWithRay(
      ray,
      (mesh) => mesh.isPickable && mesh.isEnabled()
    );
    if (!hit?.hit || !hit.pickedMesh) return;

    const meta = hit.pickedMesh.metadata;
    const enemy = isEnemyMetadata(meta) ? meta.enemy : undefined;
    if (!enemy || enemy.isDead) {
      if (hit.pickedPoint) this.effects.createImpact(hit.pickedPoint, false);
      return;
    }

    const killed = enemy.damage(this.weaponSys.getDamage());
    this.hud.showHit();
    this.audio.hit();
    if (hit.pickedPoint) this.effects.createImpact(hit.pickedPoint, true);
    if (killed) {
      this.kills += 1;
      this.hud.flashMessage(
        this.kills === this.enemies.length
          ? "Sector clear // Extraction unlocked"
          : "Infected neutralized"
      );
    }
  }

  private reload(): void {
    if (!this.progression.allowsWeaponAction) return;
    if (this.weaponSys.tryReload()) {
      this.hud.flashMessage("Reloading", 800);
      this.audio.reload();
    }
  }

  private jump(): void {
    this.player.jump();
  }

  private interact(): void {
    if (!this.level) return;
    if (this.progression.phase === "waste" && this.wasteLevel) {
      const distanceSquared = Vector3.DistanceSquared(
        this.wasteLevel.elevatorConsole.position,
        this.camera.position
      );
      if (
        distanceSquared <= LEVEL.EXTRACTION_DISTANCE ** 2 &&
        this.progression.ascendWaste(this.wasteEnemy?.isDead ?? false)
      ) {
        this.camera.position.set(0, PLAYER.HEIGHT, -36);
        this.hud.setPrompt("");
        this.hud.flashMessage("LEVEL 07 // INITIAL BREACH", 2400);
        this.hud.setObjective("Reach the extraction lift");
        this.wasteLevel.setActive(false);
        this.level.setActive(true);
        for (const enemy of this.sectorEnemies) enemy.root.setEnabled(true);
      }
      return;
    }
    const distanceSquared = Vector3.DistanceSquared(
      this.level.elevatorConsole.position,
      this.camera.position
    );
    if (
      distanceSquared <= LEVEL.EXTRACTION_DISTANCE ** 2 &&
      this.progression.completeSector(this.enemies.length - this.kills)
    )
      this.finish(true);
  }

  private takeDamage(amount: number): void {
    if (this.paused || this.ended) return;
    this.health = Math.max(0, this.health - amount);
    this.hud.setHealth(this.health);
    this.hud.flashDamage();
    this.audio.enemyAttack();
    if (this.health === 0) this.finish(false);
  }

  private finish(success: boolean): void {
    this.ended = true;
    this.started = false;
    this.setGameplayCursorHidden(false);
    document.exitPointerLock();
    this.hud.hide();

    const endScreen = document.getElementById("end-screen");
    const title = document.getElementById("end-title");
    const copy = document.getElementById("end-copy");
    const eyebrow = document.getElementById("end-eyebrow");
    if (success) {
      const elapsed = Math.max(
        1,
        Math.round((performance.now() - this.startTime) / 1000)
      );
      if (eyebrow) eyebrow.textContent = "SECTOR STATUS // CONTAINED";
      if (title) title.textContent = "EXTRACTION SECURED";
      if (copy)
        copy.textContent = `${this.kills} infected neutralized in ${elapsed} seconds.`;
      this.audio.success();
    } else {
      if (eyebrow) eyebrow.textContent = "BIOMETRIC SIGNAL LOST";
      if (title) title.textContent = "OPERATIVE DECEASED";
      if (copy) copy.textContent = "Sector 7 remains under emergency lockdown.";
    }
    endScreen?.classList.add("visible");
  }

  private pause(): void {
    if (!this.started || this.paused || this.ended) return;
    this.paused = true;
    this.keys.clear();
    this.setGameplayCursorHidden(false);
    this.camera.detachControl();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    document.getElementById("pause-screen")?.classList.add("visible");
  }

  private resume(): void {
    if (!this.started || !this.paused || this.ended) return;
    this.paused = false;
    this.setGameplayCursorHidden(true);
    document.getElementById("pause-screen")?.classList.remove("visible");
    this.camera.attachControl(this.canvas, true);
    void this.audio.resume();
    this.requestPointerLock();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.paused = false;
    this.setGameplayCursorHidden(true);
    this.startTime = performance.now();
    document.getElementById("start-screen")?.classList.remove("visible");
    this.hud.show();
    void this.audio.resume();
    this.requestPointerLock();
    this.hud.setWeaponName("UNARMED");
    this.hud.setAmmo(0, 0);
    this.hud.setObjective("Choose one weapon beside the lift");
    this.hud.flashMessage("LEVEL 08 // WASTE DISPOSAL", 2400);
  }

  private requestPointerLock(): void {
    void this.canvas.requestPointerLock().catch(() => undefined);
  }

  private setGameplayCursorHidden(hidden: boolean): void {
    if (hidden === this.gameplayCursorHidden) return;
    this.gameplayCursorHidden = hidden;
    document.body.classList.toggle("gameplay-active", hidden);
    const cursor = hidden ? "none" : "";
    this.canvas.style.cursor = cursor;
    document.body.style.cursor = cursor;
    document.documentElement.style.cursor = cursor;
  }

  private applyQuality(_tier: QualityTier, settings: QualitySettings): void {
    this.currentSettings = settings;
    this.engine.setHardwareScalingLevel(1 / settings.renderScale);
    this.engine.resize();
    this.bloom._downscale.samples = settings.samples;
    this.scene.postProcessRenderPipelineManager[
      settings.bloom ? "enableEffectInPipeline" : "disableEffectInPipeline"
    ](this.pipeline.name, "bloom", this.camera);
    this.scene.postProcessRenderPipelineManager[
      settings.antialiasing === "fxaa"
        ? "enableEffectInPipeline"
        : "disableEffectInPipeline"
    ](this.pipeline.name, "fxaa", this.camera);
    this.scene.postProcessRenderPipelineManager[
      settings.chromaticAberration
        ? "enableEffectInPipeline"
        : "disableEffectInPipeline"
    ](this.pipeline.name, "chromatic", this.camera);
    this.level?.setLightBudget(settings.dynamicLights);
    this.wasteLevel?.setLightBudget(settings.dynamicLights);
    this.updateQualityButtons();
  }

  private get activeLevel(): Sector7 | WasteDisposal | undefined {
    return this.progression.phase === "waste" ? this.wasteLevel : this.level;
  }

  private updateQualityButtons(): void {
    const preset = this.quality.getPreset();
    document
      .querySelectorAll<HTMLButtonElement>("[data-quality]")
      .forEach((button) => {
        button.classList.toggle("active", button.dataset.quality === preset);
      });
    const status = document.getElementById("quality-status");
    if (status)
      status.textContent =
        preset === "auto"
          ? `Adaptive quality // ${this.quality.getTier()}`
          : `${preset} quality locked`;
  }
}
