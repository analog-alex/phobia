export type QualityPreset = "auto" | "low" | "medium" | "high";
export type QualityTier = Exclude<QualityPreset, "auto">;

export interface QualitySettings {
  renderScale: number;
  antialiasing: "fxaa" | "msaa";
  samples: number;
  bloom: boolean;
  chromaticAberration: boolean;
  dynamicLights: number;
}

export const QUALITY_SETTINGS: Record<QualityTier, QualitySettings> = {
  low: {
    renderScale: 0.55,
    antialiasing: "fxaa",
    samples: 1,
    bloom: false,
    chromaticAberration: false,
    dynamicLights: 1,
  },
  medium: {
    renderScale: 0.7,
    antialiasing: "fxaa",
    samples: 1,
    bloom: false,
    chromaticAberration: false,
    dynamicLights: 2,
  },
  high: {
    renderScale: 0.78,
    antialiasing: "fxaa",
    samples: 1,
    bloom: true,
    chromaticAberration: false,
    dynamicLights: 3,
  },
};

const STORAGE_KEY = "phobia.graphicsPreset";
const TIERS: QualityTier[] = ["low", "medium", "high"];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class AdaptiveQualityController {
  private slowDuration = 0;
  private fastDuration = 0;
  private cooldown = 0;

  constructor(public tier: QualityTier = "low") {}

  update(
    frameMs: number,
    deltaSeconds: number,
    active: boolean
  ): QualityTier | null {
    if (!active) return null;
    this.cooldown = Math.max(0, this.cooldown - deltaSeconds);
    if (this.cooldown > 0) return null;

    if (frameMs > 18.5) {
      this.slowDuration += deltaSeconds;
      this.fastDuration = 0;
    } else if (frameMs < 15) {
      this.fastDuration += deltaSeconds;
      this.slowDuration = 0;
    } else {
      this.slowDuration = 0;
      this.fastDuration = 0;
    }

    if (this.slowDuration >= 2) return this.shift(-1);
    if (this.fastDuration >= 10) return this.shift(1);
    return null;
  }

  reset(tier: QualityTier): void {
    this.tier = tier;
    this.slowDuration = 0;
    this.fastDuration = 0;
    this.cooldown = 0;
  }

  private shift(direction: -1 | 1): QualityTier | null {
    const currentIndex = TIERS.indexOf(this.tier);
    if (currentIndex === -1) return null;
    const nextIndex = Math.max(
      0,
      Math.min(TIERS.length - 1, currentIndex + direction)
    );
    this.slowDuration = 0;
    this.fastDuration = 0;
    if (nextIndex === currentIndex) return null;
    this.tier = TIERS[nextIndex];
    this.cooldown = 8;
    return this.tier;
  }
}

export class QualityManager {
  private preset: QualityPreset;
  private readonly adaptive = new AdaptiveQualityController("low");

  constructor(
    private readonly applySettings: (
      tier: QualityTier,
      settings: QualitySettings
    ) => void,
    private readonly storage: StorageLike | undefined = typeof localStorage ===
    "undefined"
      ? undefined
      : localStorage
  ) {
    this.preset = this.readPreset();
  }

  initialize(): void {
    const tier = this.preset === "auto" ? this.adaptive.tier : this.preset;
    this.applySettings(tier, QUALITY_SETTINGS[tier]);
  }

  update(frameMs: number, deltaSeconds: number, active: boolean): void {
    if (this.preset !== "auto") return;
    const nextTier = this.adaptive.update(frameMs, deltaSeconds, active);
    if (nextTier) this.applySettings(nextTier, QUALITY_SETTINGS[nextTier]);
  }

  setPreset(preset: QualityPreset): void {
    this.preset = preset;
    this.storage?.setItem(STORAGE_KEY, preset);
    if (preset === "auto") {
      this.adaptive.reset("low");
      this.applySettings("low", QUALITY_SETTINGS.low);
      return;
    }
    this.adaptive.reset(preset);
    this.applySettings(preset, QUALITY_SETTINGS[preset]);
  }

  getPreset(): QualityPreset {
    return this.preset;
  }

  getTier(): QualityTier {
    return this.preset === "auto" ? this.adaptive.tier : this.preset;
  }

  private readPreset(): QualityPreset {
    const value = this.storage?.getItem(STORAGE_KEY);
    return value === "low" ||
      value === "medium" ||
      value === "high" ||
      value === "auto"
      ? value
      : "auto";
  }
}
