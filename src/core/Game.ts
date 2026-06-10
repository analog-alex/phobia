import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import "@babylonjs/core/Collisions/collisionCoordinator";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { BloomEffect } from "@babylonjs/core/PostProcesses/bloomEffect";
import { ChromaticAberrationPostProcess } from "@babylonjs/core/PostProcesses/chromaticAberrationPostProcess";
import { FxaaPostProcess } from "@babylonjs/core/PostProcesses/fxaaPostProcess";
import { PostProcessRenderEffect } from "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderEffect";
import { PostProcessRenderPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipeline";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import { Scene } from "@babylonjs/core/scene";
import { Enemy } from "./Enemy";
import { Sector7 } from "../levels/Sector7";
import { AudioSystem } from "../systems/AudioSystem";
import { HUD } from "../ui/HUD";
import { Diagnostics } from "../ui/Diagnostics";
import { MaterialLibrary } from "./MaterialLibrary";
import { QualityManager, type QualityPreset, type QualitySettings, type QualityTier } from "../systems/QualityManager";

interface ImpactEntry {
  mesh: Mesh;
  expiresAt: number;
}

export class Game {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly hud = new HUD();
  private readonly audio = new AudioSystem();
  private readonly materials: MaterialLibrary;
  private readonly quality: QualityManager;
  private readonly keys = new Set<string>();
  private readonly enemies: Enemy[] = [];
  private readonly impacts: ImpactEntry[] = [];
  private readonly moveVector = new Vector3();
  private readonly groundRay = new Ray(Vector3.Zero(), Vector3.Down(), 2.03);
  private readonly pipeline: PostProcessRenderPipeline;
  private readonly bloom: BloomEffect;
  private readonly fxaa: FxaaPostProcess;
  private readonly chromaticAberration: ChromaticAberrationPostProcess;
  private readonly diagnostics: Diagnostics;
  private level?: Sector7;
  private weapon?: Mesh;
  private muzzleLight?: PointLight;
  private health = 100;
  private ammo = 12;
  private reserve = 48;
  private started = false;
  private paused = false;
  private ended = false;
  private reloading = false;
  private weaponKick = 0;
  private grounded = false;
  private verticalVelocity = 0;
  private groundCheckTimer = 0;
  private kills = 0;
  private startTime = 0;
  private currentSettings: QualitySettings;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false });
    this.scene = new Scene(this.engine);
    this.camera = new UniversalCamera("operative camera", new Vector3(0, 1.82, -36), this.scene);
    this.materials = new MaterialLibrary(this.scene);
    this.pipeline = new PostProcessRenderPipeline(this.engine, "performance-pipeline");
    this.bloom = new BloomEffect(this.scene, 0.5, 0.18, 42);
    this.fxaa = new FxaaPostProcess("fxaa", 1, null, undefined, this.engine);
    this.chromaticAberration = new ChromaticAberrationPostProcess("chromatic", 1280, 720, 1, null, undefined, this.engine);
    this.currentSettings = {
      renderScale: 0.8,
      antialiasing: "fxaa",
      samples: 1,
      bloom: true,
      chromaticAberration: false,
      dynamicLights: 4,
    };
    this.quality = new QualityManager((tier, settings) => this.applyQuality(tier, settings));
    this.diagnostics = new Diagnostics(
      this.engine,
      this.scene,
      this.quality,
      () => (this.level?.getActiveLightCount() ?? 0) + ((this.muzzleLight?.intensity ?? 0) > 0 ? 1 : 0),
    );
  }

  async initialize(): Promise<void> {
    this.configureCamera();
    this.configureLightingAndPostProcessing();
    this.level = new Sector7(this.scene, this.materials);
    this.level.enemySpawns.forEach(({ position, variant }) => {
      this.enemies.push(new Enemy(this.scene, position, variant, this.materials));
    });
    this.createWeapon();
    this.createImpactPool();
    this.bindEvents();
    this.hud.setHealth(this.health);
    this.hud.setAmmo(this.ammo, this.reserve);

    this.quality.initialize();
    this.updateQualityButtons();
    this.scene.onBeforeRenderObservable.add(() => this.update());
    this.scene.onAfterRenderObservable.add(() => {
      const frameMs = this.engine.getDeltaTime();
      this.diagnostics.update(frameMs, Math.min(0.033, frameMs / 1000));
    });
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }

  private configureCamera(): void {
    this.camera.minZ = 0.05;
    this.camera.fov = 1.05;
    this.camera.inertia = 0;
    this.camera.angularSensibility = 1900;
    this.camera.checkCollisions = true;
    this.camera.applyGravity = false;
    this.camera.ellipsoid = new Vector3(0.42, 0.88, 0.42);
    this.camera.ellipsoidOffset = new Vector3(0, -0.88, 0);
    this.camera.attachControl(this.canvas, true);
    this.camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
    this.scene.activeCamera = this.camera;
  }

  private configureLightingAndPostProcessing(): void {
    const ambient = new HemisphericLight("ambient spill", new Vector3(0, 1, 0), this.scene);
    ambient.diffuse = new Color3(0.3, 0.5, 0.48);
    ambient.groundColor = new Color3(0.045, 0.075, 0.08);
    ambient.intensity = 0.48;

    this.scene.imageProcessingConfiguration.contrast = 1.18;
    this.scene.imageProcessingConfiguration.exposure = 1.08;
    this.bloom.threshold = 0.72;
    this.chromaticAberration.aberrationAmount = 5;
    this.pipeline.addEffect(this.bloom);
    this.pipeline.addEffect(new PostProcessRenderEffect(this.engine, "fxaa", () => this.fxaa));
    this.pipeline.addEffect(new PostProcessRenderEffect(this.engine, "chromatic", () => this.chromaticAberration));
    this.scene.postProcessRenderPipelineManager.addPipeline(this.pipeline);
    this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(this.pipeline.name, this.camera, true);
  }

  private createWeapon(): void {
    const slide = CreateBox("VX-9 slide", { width: 0.24, height: 0.19, depth: 0.7 }, this.scene);
    slide.material = this.materials.gunmetal;
    const barrel = CreateBox("VX-9 barrel", { width: 0.15, height: 0.14, depth: 0.3 }, this.scene);
    barrel.position = new Vector3(0, -0.03, 0.43);
    barrel.material = this.materials.gunmetal;
    const root = Mesh.MergeMeshes([slide, barrel], true, true);
    if (!root) throw new Error("Failed to merge weapon geometry");
    root.parent = this.camera;
    root.position = new Vector3(0.42, -0.37, 0.95);
    root.rotation = new Vector3(-0.08, -0.04, 0.02);
    root.isPickable = false;

    const handle = CreateBox("VX-9 grip", { width: 0.2, height: 0.44, depth: 0.25 }, this.scene);
    handle.parent = root;
    handle.position = new Vector3(0, -0.28, -0.12);
    handle.rotation.x = -0.24;
    handle.material = this.materials.grip;
    handle.isPickable = false;

    this.muzzleLight = new PointLight("muzzle flash", new Vector3(0, 0, 0.73), this.scene);
    this.muzzleLight.parent = root;
    this.muzzleLight.diffuse = new Color3(1, 0.42, 0.08);
    this.muzzleLight.range = 7;
    this.muzzleLight.intensity = 0;
    this.weapon = root;
  }

  private bindEvents(): void {
    const startButton = document.getElementById("start-button");
    const restartButton = document.getElementById("restart-button");
    const pauseRestartButton = document.getElementById("pause-restart-button");
    const resumeButton = document.getElementById("resume-button");
    const startScreen = document.getElementById("start-screen");
    void startButton;
    void startScreen;

    restartButton?.addEventListener("click", () => window.location.reload());
    pauseRestartButton?.addEventListener("click", () => window.location.reload());
    resumeButton?.addEventListener("click", () => this.resume());
    document.querySelectorAll<HTMLButtonElement>("[data-quality]").forEach((button) => {
      button.addEventListener("click", () => {
        this.quality.setPreset(button.dataset.quality as QualityPreset);
        this.updateQualityButtons();
      });
    });
    document.addEventListener("pointerlockchange", () => {
      if (this.started && !this.ended && !this.paused && document.pointerLockElement !== this.canvas) {
        this.pause();
      }
    });
    this.canvas.addEventListener("click", () => {
      if (this.started && !this.paused && !this.ended && document.pointerLockElement !== this.canvas) {
        void this.canvas.requestPointerLock();
        void this.audio.resume();
      }
    });
    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.button === 0 && document.pointerLockElement === this.canvas) this.fire();
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
      if (event.code === "KeyR") this.reload();
      if (event.code === "KeyE") this.interact();
      if (event.code === "Space") this.jump();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
  }

  private update(): void {
    const delta = Math.min(0.033, this.engine.getDeltaTime() / 1000);
    const frameMs = this.engine.getDeltaTime();
    const active = this.started && !this.paused && !this.ended;
    this.quality.update(frameMs, delta, active);
    this.updateImpactPool();
    if (!active || !this.level) return;

    this.updateMovement(delta);
    this.level.update(delta, this.camera.position);
    this.updateWeapon(delta);
    this.updateEnemies(delta);
    this.updatePickups();
    this.updateExtractionPrompt();
  }

  private updateWeapon(delta: number): void {
    if (!this.weapon) return;
    this.weaponKick = Math.max(0, this.weaponKick - delta * 5.4);
    const moving = this.keys.has("KeyW") || this.keys.has("KeyA") || this.keys.has("KeyS") || this.keys.has("KeyD");
    const time = performance.now() * 0.008;
    const bob = moving ? Math.sin(time) * 0.012 : 0;
    this.weapon.position.y = -0.37 + bob - this.weaponKick * 0.08;
    this.weapon.rotation.x = -0.08 + this.weaponKick * 0.24;
  }

  private updateMovement(delta: number): void {
    const forwardInput = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const strafeInput = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const inputLength = Math.hypot(forwardInput, strafeInput);
    const yaw = this.camera.rotation.y;
    if (inputLength > 0) {
      const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 13 : 8.5;
      const normalizedForward = forwardInput / inputLength;
      const normalizedStrafe = strafeInput / inputLength;
      this.moveVector.set(
        (Math.sin(yaw) * normalizedForward + Math.cos(yaw) * normalizedStrafe) * speed * delta,
        0,
        (Math.cos(yaw) * normalizedForward - Math.sin(yaw) * normalizedStrafe) * speed * delta,
      );
      this.camera.cameraDirection.x = this.moveVector.x;
      this.camera.cameraDirection.z = this.moveVector.z;
    } else {
      this.camera.cameraDirection.x = 0;
      this.camera.cameraDirection.z = 0;
    }

    this.groundCheckTimer -= delta;
    if (this.groundCheckTimer <= 0) {
      this.groundCheckTimer = 1 / 30;
      this.groundRay.origin.copyFrom(this.camera.position);
      const hit = this.scene.pickWithRay(this.groundRay, (mesh) => Boolean(mesh.metadata?.collision));
      this.grounded = Boolean(hit?.hit && hit.distance <= 1.86);
    }
    if (this.grounded && this.verticalVelocity < 0) this.verticalVelocity = -0.8;
    else this.verticalVelocity -= 22 * delta;
    this.camera.cameraDirection.y = this.verticalVelocity * delta;
  }

  private updateEnemies(delta: number): void {
    this.enemies.forEach((enemy) => {
      enemy.update(delta, this.camera.position, (damage) => this.takeDamage(damage));
    });
  }

  private updatePickups(): void {
    if (!this.level) return;
    this.level.pickups.forEach((pickup) => {
      if (!pickup.active || Vector3.Distance(pickup.mesh.position, this.camera.position) > 1.45) return;
      if (pickup.kind === "health") {
        if (this.health >= 100) return;
        this.health = Math.min(100, this.health + 35);
        this.hud.setHealth(this.health);
        this.hud.flashMessage("Trauma kit acquired");
      } else {
        this.reserve += 18;
        this.hud.setAmmo(this.ammo, this.reserve);
        this.hud.flashMessage("VX-9 ammunition acquired");
      }
      pickup.active = false;
      pickup.mesh.setEnabled(false);
      this.audio.pickup();
    });
  }

  private updateExtractionPrompt(): void {
    if (!this.level) return;
    const distance = Vector3.Distance(this.level.extractionConsole.position, this.camera.position);
    if (distance > 2.6) {
      this.hud.setPrompt("");
      return;
    }
    const remaining = this.enemies.length - this.kills;
    this.hud.setPrompt(remaining > 0 ? `LOCKDOWN ACTIVE // ${remaining} HOSTILES REMAIN` : "[ E ] AUTHORIZE EXTRACTION");
  }

  private fire(): void {
    if (!this.started || this.paused || this.ended || this.reloading) return;
    if (this.ammo <= 0) {
      this.audio.empty();
      this.hud.flashMessage("Magazine empty", 700);
      return;
    }

    this.ammo -= 1;
    this.weaponKick = 1;
    this.hud.setAmmo(this.ammo, this.reserve);
    this.hud.kickCrosshair();
    this.audio.shoot();
    if (this.muzzleLight) {
      this.level?.setLightBudget(Math.max(1, this.currentSettings.dynamicLights - 1));
      this.muzzleLight.intensity = 4;
      window.setTimeout(() => {
        if (this.muzzleLight) this.muzzleLight.intensity = 0;
        this.level?.setLightBudget(this.currentSettings.dynamicLights);
      }, 42);
    }

    const ray = this.camera.getForwardRay(80);
    const hit = this.scene.pickWithRay(ray, (mesh) => mesh.isPickable && mesh.isEnabled());
    if (!hit?.hit || !hit.pickedMesh) return;
    const enemy = hit.pickedMesh.metadata?.enemy as Enemy | undefined;
    if (!enemy || enemy.isDead) {
      if (hit.pickedPoint) this.createImpact(hit.pickedPoint, false);
      return;
    }

    const killed = enemy.damage(34);
    this.hud.showHit();
    this.audio.hit();
    if (hit.pickedPoint) this.createImpact(hit.pickedPoint, true);
    if (killed) {
      this.kills += 1;
      this.hud.flashMessage(this.kills === this.enemies.length ? "Sector clear // Extraction unlocked" : "Infected neutralized");
    }
  }

  private reload(): void {
    if (this.reloading || this.ammo === 12 || this.reserve === 0) return;
    this.reloading = true;
    this.hud.flashMessage("Reloading", 800);
    this.audio.reload();
    window.setTimeout(() => {
      const needed = 12 - this.ammo;
      const loaded = Math.min(needed, this.reserve);
      this.ammo += loaded;
      this.reserve -= loaded;
      this.reloading = false;
      this.hud.setAmmo(this.ammo, this.reserve);
    }, 820);
  }

  private jump(): void {
    if (!this.grounded) return;
    this.grounded = false;
    this.verticalVelocity = 7.2;
  }

  private interact(): void {
    if (!this.level) return;
    const distance = Vector3.Distance(this.level.extractionConsole.position, this.camera.position);
    if (distance <= 2.6 && this.kills === this.enemies.length) this.finish(true);
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
    document.exitPointerLock();
    this.hud.hide();

    const endScreen = document.getElementById("end-screen");
    const title = document.getElementById("end-title");
    const copy = document.getElementById("end-copy");
    const eyebrow = document.getElementById("end-eyebrow");
    if (success) {
      const elapsed = Math.max(1, Math.round((performance.now() - this.startTime) / 1000));
      if (eyebrow) eyebrow.textContent = "SECTOR STATUS // CONTAINED";
      if (title) title.textContent = "EXTRACTION SECURED";
      if (copy) copy.textContent = `${this.kills} infected neutralized in ${elapsed} seconds.`;
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
    this.camera.detachControl();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    document.getElementById("pause-screen")?.classList.add("visible");
  }

  private resume(): void {
    if (!this.started || !this.paused || this.ended) return;
    this.paused = false;
    document.getElementById("pause-screen")?.classList.remove("visible");
    this.camera.attachControl(this.canvas, true);
    void this.audio.resume();
    void this.canvas.requestPointerLock();
  }

  private createImpact(position: Vector3, organic: boolean): void {
    const entry = this.impacts.find((impact) => !impact.mesh.isEnabled()) ?? this.impacts[0];
    entry.mesh.position.copyFrom(position);
    entry.mesh.material = organic ? this.materials.organicImpact : this.materials.hardImpact;
    entry.expiresAt = performance.now() + 1200;
    entry.mesh.setEnabled(true);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.paused = false;
    this.startTime = performance.now();
    document.getElementById("start-screen")?.classList.remove("visible");
    this.hud.show();
    void this.audio.resume();
    void this.canvas.requestPointerLock();
    this.hud.flashMessage("Emergency power online");
  }

  private createImpactPool(): void {
    for (let index = 0; index < 16; index += 1) {
      const mesh = CreateSphere(`impact-${index}`, { diameter: 0.09, segments: 5 }, this.scene);
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.impacts.push({ mesh, expiresAt: 0 });
    }
  }

  private updateImpactPool(): void {
    const now = performance.now();
    this.impacts.forEach((impact) => {
      if (impact.mesh.isEnabled() && impact.expiresAt <= now) impact.mesh.setEnabled(false);
    });
  }

  private applyQuality(_tier: QualityTier, settings: QualitySettings): void {
    this.currentSettings = settings;
    this.engine.setHardwareScalingLevel(1 / settings.renderScale);
    this.engine.resize();
    this.bloom._downscale.samples = settings.samples;
    this.scene.postProcessRenderPipelineManager[settings.bloom ? "enableEffectInPipeline" : "disableEffectInPipeline"](
      this.pipeline.name,
      "bloom",
      this.camera,
    );
    this.scene.postProcessRenderPipelineManager[settings.antialiasing === "fxaa" ? "enableEffectInPipeline" : "disableEffectInPipeline"](
      this.pipeline.name,
      "fxaa",
      this.camera,
    );
    this.scene.postProcessRenderPipelineManager[settings.chromaticAberration ? "enableEffectInPipeline" : "disableEffectInPipeline"](
      this.pipeline.name,
      "chromatic",
      this.camera,
    );
    this.level?.setLightBudget(settings.dynamicLights);
    this.updateQualityButtons();
  }

  private updateQualityButtons(): void {
    const preset = this.quality.getPreset();
    document.querySelectorAll<HTMLButtonElement>("[data-quality]").forEach((button) => {
      button.classList.toggle("active", button.dataset.quality === preset);
    });
    const status = document.getElementById("quality-status");
    if (status) status.textContent = preset === "auto" ? `Adaptive quality // ${this.quality.getTier()}` : `${preset} quality locked`;
  }
}
