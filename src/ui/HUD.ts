import { TIMINGS } from "../config/constants";

const CROSSHAIR_BASE_GAP = 5;
const CROSSHAIR_MOVE_GAP = 3.5;
const CROSSHAIR_SPRINT_GAP = 7;
const CROSSHAIR_FIRE_GAP = 8;
const LOW_HEALTH_THRESHOLD = 35;

export class HUD {
  private readonly root = this.get("hud");
  private readonly health = this.get("health");
  private readonly healthBar = this.get("health-bar");
  private readonly weaponName = this.get("weapon-name");
  private readonly ammo = this.get("ammo");
  private readonly reserve = this.get("reserve");
  private readonly reloadBar = this.get("reload-bar");
  private readonly prompt = this.get("prompt");
  private readonly message = this.get("message");
  private readonly hitmarker = this.get("hitmarker");
  private readonly damageFlash = this.get("damage-flash");
  private readonly lowHealth = this.get("low-health");
  private readonly objective = this.get("objective").querySelector("b");
  private readonly standingCrosshair = this.createStandingCrosshair();
  private messageTimer = 0;
  private hitmarkerTimer = 0;
  private damageFlashTimer = 0;
  private fireSpread = 0;
  private moveSpread = 0;
  private moveSpreadTarget = 0;
  private lastGap = -1;
  private lastHealth = -1;
  private lastClip = -1;
  private lastReserve = -1;
  private lastPrompt = "";
  private lastWeaponName = "";
  private lowHealthActive = false;

  constructor() {
    this.installGrain();
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.standingCrosshair.hidden = false;
    document.body.classList.add("in-run");
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.standingCrosshair.hidden = true;
    document.body.classList.remove("in-run", "low-health");
    this.lowHealthActive = false;
  }

  setCrosshairVisible(visible: boolean): void {
    this.standingCrosshair.hidden = !visible;
  }

  setHealth(value: number): void {
    const safeValue = Math.max(0, Math.round(value));
    if (safeValue === this.lastHealth) return;
    this.lastHealth = safeValue;
    this.health.textContent = String(safeValue);
    this.healthBar.style.width = `${safeValue}%`;
    const low = safeValue < LOW_HEALTH_THRESHOLD;
    if (low !== this.lowHealthActive) {
      this.lowHealthActive = low;
      document.body.classList.toggle("low-health", low);
      this.lowHealth.classList.toggle("active", low);
    }
  }

  setAmmo(clip: number, reserve: number): void {
    if (clip === this.lastClip && reserve === this.lastReserve) return;
    this.lastClip = clip;
    this.lastReserve = reserve;
    this.ammo.textContent = String(clip).padStart(2, "0");
    this.reserve.textContent = `/ ${String(reserve).padStart(2, "0")}`;
    this.ammo.classList.toggle("empty", clip === 0);
  }

  setWeaponName(value: string): void {
    const label = value.toUpperCase();
    if (label === this.lastWeaponName) return;
    this.lastWeaponName = label;
    this.weaponName.textContent = label;
  }

  setPrompt(value: string): void {
    if (value === this.lastPrompt) return;
    this.lastPrompt = value;
    this.prompt.textContent = value;
    this.prompt.classList.toggle("visible", value.length > 0);
  }

  setObjective(value: string): void {
    if (this.objective) this.objective.textContent = value;
  }

  flashMessage(
    value: string,
    duration: number = TIMINGS.MESSAGE_DEFAULT_MS
  ): void {
    this.message.textContent = value;
    this.message.classList.add("visible");
    this.messageTimer = duration / 1000;
  }

  showHit(killed = false): void {
    this.hitmarker.classList.toggle("kill", killed);
    this.hitmarker.classList.add("visible");
    this.hitmarkerTimer = (killed ? 2.2 : 1) * (TIMINGS.HITMARKER_MS / 1000);
  }

  kickCrosshair(): void {
    this.fireSpread = 1;
  }

  /** Feeds player motion so the crosshair opens up while moving. */
  setMovement(moving: boolean, sprinting: boolean): void {
    this.moveSpreadTarget = sprinting
      ? CROSSHAIR_SPRINT_GAP
      : moving
        ? CROSSHAIR_MOVE_GAP
        : 0;
  }

  /**
   * Fills the reload meter over the reload duration with a single CSS
   * transition, so the per-frame update loop never touches the DOM for it.
   */
  startReload(durationSeconds: number): void {
    this.reloadBar.style.transition = "none";
    this.reloadBar.style.transform = "scaleX(0)";
    this.reloadBar.parentElement?.classList.add("active");
    // Force the reset to flush before the animated fill begins.
    void this.reloadBar.offsetWidth;
    this.reloadBar.style.transition = `transform ${durationSeconds}s linear`;
    this.reloadBar.style.transform = "scaleX(1)";
  }

  finishReload(): void {
    this.reloadBar.parentElement?.classList.remove("active");
  }

  flashDamage(): void {
    this.damageFlash.classList.add("active");
    this.damageFlashTimer = TIMINGS.DAMAGE_FLASH_MS / 1000;
  }

  update(delta: number): void {
    if (this.messageTimer > 0) {
      this.messageTimer = Math.max(0, this.messageTimer - delta);
      if (this.messageTimer === 0) this.message.classList.remove("visible");
    }
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - delta);
      if (this.hitmarkerTimer === 0) this.hitmarker.classList.remove("visible");
    }
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - delta);
      if (this.damageFlashTimer === 0)
        this.damageFlash.classList.remove("active");
    }

    this.fireSpread = Math.max(0, this.fireSpread - delta * 7.5);
    this.moveSpread +=
      (this.moveSpreadTarget - this.moveSpread) * Math.min(1, delta * 9);
    const gap =
      Math.round(
        (CROSSHAIR_BASE_GAP +
          this.moveSpread +
          this.fireSpread * CROSSHAIR_FIRE_GAP) *
          2
      ) / 2;
    if (gap !== this.lastGap) {
      this.lastGap = gap;
      this.standingCrosshair.style.setProperty("--gap", `${gap}px`);
    }
  }

  private get(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing HUD element: ${id}`);
    return element;
  }

  /**
   * Four bars that open and close around a dot. The spread is a CSS custom
   * property so a single style write moves every bar.
   */
  private createStandingCrosshair(): HTMLElement {
    const legacyCrosshair = document.getElementById("crosshair");
    legacyCrosshair?.remove();

    const crosshair = document.createElement("div");
    crosshair.id = "standing-crosshair";
    crosshair.setAttribute("aria-hidden", "true");
    crosshair.hidden = true;
    crosshair.style.setProperty("--gap", `${CROSSHAIR_BASE_GAP}px`);

    const bars = ["top", "bottom", "left", "right", "dot"];
    for (const bar of bars) {
      const span = document.createElement("span");
      span.className = `crosshair-${bar}`;
      crosshair.append(span);
    }

    document.body.append(crosshair);
    return crosshair;
  }

  /**
   * Film grain: a 96px noise tile generated once and drifted by CSS. Kept
   * faint so it reads as sensor noise on the droid's optics, not static.
   */
  private installGrain(): void {
    const grain = document.getElementById("grain");
    if (!grain) return;
    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(size, size);
    for (let index = 0; index < image.data.length; index += 4) {
      const value = 110 + Math.random() * 145;
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    grain.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
  }
}
