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
    window.clearTimeout(this.messageTimer);
    this.message.textContent = value;
    this.message.classList.add("visible");
    this.messageTimer = window.setTimeout(
      () => this.message.classList.remove("visible"),
      duration
    );
  }

  showHit(): void {
    this.hitmarker.classList.add("visible");
    window.setTimeout(() => this.hitmarker.classList.remove("visible"), 80);
  }

  kickCrosshair(): void {
    this.crosshair.classList.add("kick");
    window.setTimeout(() => this.crosshair.classList.remove("kick"), 85);
  }

  flashDamage(): void {
    this.damageFlash.classList.add("active");
    window.setTimeout(() => this.damageFlash.classList.remove("active"), 90);
  }

  private get(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing HUD element: ${id}`);
    return element;
  }
}
