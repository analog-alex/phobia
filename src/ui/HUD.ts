export class HUD {
  private readonly root = this.get("hud");
  private readonly health = this.get("health");
  private readonly healthBar = this.get("health-bar");
  private readonly ammo = this.get("ammo");
  private readonly reserve = this.get("reserve");
  private readonly prompt = this.get("prompt");
  private readonly message = this.get("message");
  private readonly hitmarker = this.get("hitmarker");
  private readonly crosshair = this.get("crosshair");
  private readonly damageFlash = this.get("damage-flash");
  private messageTimer = 0;
  private hitmarkerTimer = 0;
  private crosshairTimer = 0;
  private damageFlashTimer = 0;
  private lastHealth = -1;
  private lastClip = -1;
  private lastReserve = -1;
  private lastPrompt = "";

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  setHealth(value: number): void {
    const safeValue = Math.max(0, Math.round(value));
    if (safeValue === this.lastHealth) return;
    this.lastHealth = safeValue;
    this.health.textContent = String(safeValue);
    this.healthBar.style.width = `${safeValue}%`;
    this.healthBar.style.background =
      safeValue < 35 ? "var(--red)" : "var(--green)";
  }

  setAmmo(clip: number, reserve: number): void {
    if (clip === this.lastClip && reserve === this.lastReserve) return;
    this.lastClip = clip;
    this.lastReserve = reserve;
    this.ammo.textContent = String(clip).padStart(2, "0");
    this.reserve.textContent = `/ ${String(reserve).padStart(2, "0")}`;
  }

  setPrompt(value: string): void {
    if (value === this.lastPrompt) return;
    this.lastPrompt = value;
    this.prompt.textContent = value;
  }

  flashMessage(value: string, duration = 1800): void {
    this.message.textContent = value;
    this.message.classList.add("visible");
    this.messageTimer = duration / 1000;
  }

  showHit(): void {
    this.hitmarker.classList.add("visible");
    this.hitmarkerTimer = 0.08;
  }

  kickCrosshair(): void {
    this.crosshair.classList.add("kick");
    this.crosshairTimer = 0.085;
  }

  flashDamage(): void {
    this.damageFlash.classList.add("active");
    this.damageFlashTimer = 0.09;
  }

  update(delta: number): void {
    if (this.messageTimer > 0) {
      this.messageTimer = Math.max(0, this.messageTimer - delta);
      if (this.messageTimer === 0) this.message.classList.remove("visible");
    }
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - delta);
      if (this.hitmarkerTimer === 0)
        this.hitmarker.classList.remove("visible");
    }
    if (this.crosshairTimer > 0) {
      this.crosshairTimer = Math.max(0, this.crosshairTimer - delta);
      if (this.crosshairTimer === 0) this.crosshair.classList.remove("kick");
    }
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer = Math.max(0, this.damageFlashTimer - delta);
      if (this.damageFlashTimer === 0)
        this.damageFlash.classList.remove("active");
    }
  }

  private get(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing HUD element: ${id}`);
    return element;
  }
}
