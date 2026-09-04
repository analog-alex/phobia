import { Constants } from "@babylonjs/core/Engines/constants";
import type { Material } from "@babylonjs/core/Materials/material";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { EnemyVariant } from "./Enemy";

/**
 * Upper bound on lights a lit material compiles for: the hemispheric fill,
 * the High-preset facility light budget and the muzzle flash. Babylon only
 * compiles for the lights actually enabled, so raising the cap costs nothing
 * until those lights exist.
 */
export const MAX_SIMULTANEOUS_LIGHTS = 6;

/**
 * Applies the shared runtime settings to a material imported from a GLB:
 * the light cap above and freezing, since imported materials never change.
 */
export function prepareImportedMaterial(material: Material): void {
  if ("maxSimultaneousLights" in material)
    (material as { maxSimultaneousLights: number }).maxSimultaneousLights =
      MAX_SIMULTANEOUS_LIGHTS;
  material.freeze();
}

export class MaterialLibrary {
  /**
   * Level surfaces are lit by the procedural environment map as well as the
   * facility point lights, so albedo values here are true base colours: the
   * ceramic panels sit near the clean grey of the concept art, and metals
   * carry a bright albedo because for PBR metals that colour is the specular
   * tint rather than a diffuse colour.
   */
  readonly wall = this.pbr(
    "ceramic panels",
    new Color3(0.5, 0.57, 0.575),
    0.04,
    0.52
  );
  readonly dark = this.pbr(
    "industrial metal",
    new Color3(0.1, 0.13, 0.14),
    0.62,
    0.42
  );
  /** Rough ceiling so point lights do not streak across it as highlights. */
  readonly ceiling = this.pbr(
    "ceiling panels",
    new Color3(0.09, 0.12, 0.13),
    0.15,
    0.78
  );
  readonly floor = this.pbr(
    "floor tiles",
    new Color3(0.17, 0.225, 0.235),
    0.08,
    0.38
  );
  readonly steel = this.pbr(
    "brushed steel",
    new Color3(0.56, 0.62, 0.63),
    0.86,
    0.3
  );
  readonly glass = this.pbr(
    "containment glass",
    new Color3(0.06, 0.24, 0.24),
    0,
    0.08
  );
  readonly cyan = this.emissive(
    "diagnostic cyan",
    new Color3(0.05, 1.25, 1.05)
  );
  readonly green = this.emissive(
    "diagnostic green",
    new Color3(0.08, 1.3, 0.42)
  );
  readonly sewage = this.emissive(
    "sewage channel",
    new Color3(0.16, 0.62, 0.22)
  );
  readonly red = this.emissive("emergency red", new Color3(1.5, 0.03, 0.015));
  readonly deadScreen = this.emissive(
    "dead screen",
    new Color3(0.42, 0.035, 0.02)
  );
  readonly lamp = this.emissive(
    "fluorescent lamp",
    new Color3(0.62, 1.15, 1.08)
  );
  readonly medkit = this.emissive("medkit glow", new Color3(0.1, 1.3, 0.45));
  readonly ammo = this.emissive("ammo glow", new Color3(1.1, 0.65, 0.05));
  readonly hazardYellow = this.pbr(
    "hazard yellow",
    new Color3(0.95, 0.58, 0.03),
    0.15,
    0.6
  );
  readonly hazardBlack = this.pbr(
    "hazard black",
    new Color3(0.015, 0.018, 0.018),
    0.2,
    0.7
  );
  readonly blood = this.pbr(
    "blood",
    new Color3(0.18, 0.005, 0.005),
    0.05,
    0.24
  );
  readonly gunmetal = this.pbr(
    "VX-9 gunmetal",
    new Color3(0.085, 0.12, 0.13),
    0.85,
    0.28
  );
  readonly grip = this.pbr(
    "VX-9 grip",
    new Color3(0.06, 0.075, 0.075),
    0.08,
    0.92
  );
  readonly organicImpact = this.pbr(
    "organic impact",
    new Color3(0.18, 0.01, 0.005),
    0.05,
    1,
    new Color3(0.35, 0.01, 0.005)
  );
  readonly hardImpact = this.pbr(
    "hard impact",
    new Color3(0.5, 0.36, 0.12),
    0.05,
    1,
    new Color3(0.8, 0.42, 0.05)
  );
  readonly acid = this.emissive("volatile acid", new Color3(1.4, 1.7, 0.02));
  /** Soft radial falloff shared by every billboard glow sprite. */
  private readonly glowTexture = this.radialTexture("glow sprite", 64, false);
  /** Radial core with spikes for the muzzle flash. */
  private readonly flashTexture = this.radialTexture(
    "muzzle flash sprite",
    128,
    true
  );
  readonly muzzleFlash = this.sprite(
    "muzzle flash",
    this.flashTexture,
    new Color3(1, 0.74, 0.38),
    true
  );
  readonly spark = this.sprite(
    "impact spark",
    this.glowTexture,
    new Color3(1, 0.66, 0.3),
    true
  );
  readonly acidSplash = this.sprite(
    "acid splash",
    this.glowTexture,
    new Color3(0.72, 0.95, 0.06),
    true
  );
  readonly bloodMist = this.sprite(
    "blood mist",
    this.glowTexture,
    new Color3(0.26, 0.012, 0.01),
    false
  );
  private readonly enemySets = new Map<
    EnemyVariant,
    {
      coat: PBRMaterial;
      pants: PBRMaterial;
      skin: PBRMaterial;
      tissue: PBRMaterial;
      eye: PBRMaterial;
      hair: PBRMaterial;
      glasses: PBRMaterial;
    }
  >();

  constructor(private readonly scene: Scene) {
    this.glass.alpha = 0.32;
    this.glass.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  }

  enemy(variant: EnemyVariant): {
    coat: PBRMaterial;
    pants: PBRMaterial;
    skin: PBRMaterial;
    tissue: PBRMaterial;
    eye: PBRMaterial;
    hair: PBRMaterial;
    glasses: PBRMaterial;
  } {
    const cached = this.enemySets.get(variant);
    if (cached) return cached;
    const set = {
      coat: this.pbr(
        `torn lab coat-${variant}`,
        variant === "acid"
          ? new Color3(0.46, 0.48, 0.35)
          : new Color3(0.7, 0.72, 0.67),
        0.05,
        0.88
      ),
      pants: this.pbr(
        `lab trousers-${variant}`,
        new Color3(0.055, 0.07, 0.075),
        0.03,
        0.92
      ),
      skin: this.pbr(
        `skin-${variant}`,
        variant === "runner"
          ? new Color3(0.31, 0.12, 0.075)
          : variant === "acid"
            ? new Color3(0.34, 0.42, 0.08)
            : new Color3(0.25, 0.31, 0.19),
        0,
        1
      ),
      eye:
        variant === "acid"
          ? this.pbr(
              "acid infected tissue",
              new Color3(0.6, 0.72, 0.01),
              0,
              0.6,
              new Color3(1.3, 1.55, 0.01)
            )
          : this.pbr(
              "infected tissue",
              new Color3(0.34, 0.008, 0.004),
              0,
              0.76,
              new Color3(1.15, 0.018, 0.008)
            ),
      tissue: this.pbr(
        `exposed tissue-${variant}`,
        new Color3(0.24, 0.012, 0.008),
        0,
        0.7,
        new Color3(0.16, 0.004, 0.002)
      ),
      hair: this.pbr(
        `matted hair-${variant}`,
        new Color3(0.012, 0.016, 0.014),
        0.05,
        0.96
      ),
      glasses: this.pbr(
        `broken spectacles-${variant}`,
        new Color3(0.12, 0.075, 0.035),
        0.65,
        0.34
      ),
    };
    this.enemySets.set(variant, set);
    return set;
  }

  freeze(): void {
    for (const material of this.scene.materials) {
      material.freeze();
    }
  }

  private pbr(
    name: string,
    color: Color3,
    metallic: number,
    roughness: number,
    emissive?: Color3
  ): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.metallic = metallic;
    material.roughness = roughness;
    material.maxSimultaneousLights = MAX_SIMULTANEOUS_LIGHTS;
    if (emissive) material.emissiveColor = emissive;
    return material;
  }

  private emissive(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color.scale(0.15);
    material.emissiveColor = color;
    material.disableLighting = true;
    return material;
  }

  /**
   * Unlit alpha sprite for pooled billboard effects. Additive sprites read as
   * light (sparks, muzzle flash, acid); blended ones read as matter (blood).
   */
  private sprite(
    name: string,
    texture: DynamicTexture,
    color: Color3,
    additive: boolean
  ): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.diffuseColor = Color3.Black();
    material.emissiveColor = color;
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    material.alphaMode = additive
      ? Constants.ALPHA_ADD
      : Constants.ALPHA_COMBINE;
    return material;
  }

  /**
   * Draws a white radial gradient with alpha falloff (optionally with four
   * soft spikes) into a small dynamic texture.
   */
  private radialTexture(
    name: string,
    size: number,
    spikes: boolean
  ): DynamicTexture {
    const texture = new DynamicTexture(
      name,
      { width: size, height: size },
      this.scene,
      true
    );
    texture.hasAlpha = true;
    const context = texture.getContext() as CanvasRenderingContext2D;
    const center = size / 2;
    context.clearRect(0, 0, size, size);
    if (spikes) {
      context.save();
      context.translate(center, center);
      for (let index = 0; index < 4; index += 1) {
        const spike = context.createLinearGradient(0, 0, center, 0);
        spike.addColorStop(0, "rgba(255,255,255,0.85)");
        spike.addColorStop(0.35, "rgba(255,255,255,0.3)");
        spike.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = spike;
        context.beginPath();
        context.moveTo(0, -size * 0.035);
        context.lineTo(center * 0.98, 0);
        context.lineTo(0, size * 0.035);
        context.closePath();
        context.fill();
        context.rotate(Math.PI / 2 + (index % 2 === 0 ? 0.18 : -0.18));
      }
      context.restore();
    }
    const radial = context.createRadialGradient(
      center,
      center,
      0,
      center,
      center,
      center
    );
    radial.addColorStop(0, "rgba(255,255,255,1)");
    radial.addColorStop(0.18, "rgba(255,255,255,0.92)");
    radial.addColorStop(0.45, "rgba(255,255,255,0.32)");
    radial.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = radial;
    context.fillRect(0, 0, size, size);
    texture.update(false);
    return texture;
  }
}
