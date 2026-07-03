export class HUD {
  private readonly root = this.get("hud");
  private readonly health = this.get("health");
  private readonly healthBar = this.get("health-bar");
  private readonly weaponName = this.get("weapon-name");
  private readonly ammo = this.get("ammo");
  private readonly reserve = this.get("reserve");
  private readonly prompt = this.get("prompt");
  private readonly message = this.get("message");
  private readonly hitmarker = this.get("hitmarker");
  private readonly damageFlash = this.get("damage-flash");
  private readonly standingCrosshair = this.createStandingCrosshair();
  private messageTimer = 0;
  private hitmarkerTimer = 0;
  private crosshairTimer = 0;
  private damageFlashTimer = 0;
  private lastHealth = -1;
  private lastClip = -1;
  private lastReserve = -1;
  private lastPrompt = "";
  private lastWeaponName = "";

  show(): void {
    this.root.classList.remove("hidden");
    this.standingCrosshair.hidden = false;
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.standingCrosshair.hidden = true;
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
    this.standingCrosshair.style.transform =
      "translate(-50%, -50%) scale(1.55)";
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
      if (this.hitmarkerTimer === 0) this.hitmarker.classList.remove("visible");
    }
    if (this.crosshairTimer > 0) {
      this.crosshairTimer = Math.max(0, this.crosshairTimer - delta);
      if (this.crosshairTimer === 0)
        this.standingCrosshair.style.transform = "translate(-50%, -50%)";
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

  private createStandingCrosshair(): HTMLElement {
    const legacyCrosshair = document.getElementById("crosshair");
    legacyCrosshair?.remove();

    const crosshair = document.createElement("div");
    crosshair.id = "standing-crosshair";
    crosshair.setAttribute("aria-hidden", "true");
    crosshair.hidden = true;
    crosshair.style.position = "fixed";
    crosshair.style.top = "50%";
    crosshair.style.left = "50%";
    crosshair.style.zIndex = "2147483647";
    crosshair.style.width = "28px";
    crosshair.style.height = "28px";
    crosshair.style.pointerEvents = "none";
    crosshair.style.transform = "translate(-50%, -50%)";
    crosshair.style.transition = "transform 0.08s";

    const bars = [
      { left: "13px", top: "0", width: "2px", height: "8px" },
      { left: "13px", top: "20px", width: "2px", height: "8px" },
      { left: "0", top: "13px", width: "8px", height: "2px" },
      { left: "20px", top: "13px", width: "8px", height: "2px" },
    ];

    bars.forEach((barStyle) => {
      const bar = document.createElement("span");
      bar.style.position = "absolute";
      bar.style.left = barStyle.left;
      bar.style.top = barStyle.top;
      bar.style.width = barStyle.width;
      bar.style.height = barStyle.height;
      bar.style.background = "#ffffff";
      bar.style.boxShadow = "0 0 6px rgba(255, 255, 255, 0.95)";
      crosshair.append(bar);
    });

    document.body.append(crosshair);
    return crosshair;
  }
}
