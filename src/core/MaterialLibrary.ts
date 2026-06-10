import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { EnemyVariant } from "./Enemy";

export class MaterialLibrary {
  readonly wall = this.pbr("ceramic panels", new Color3(0.42, 0.53, 0.54), 0.12, 0.7);
  readonly dark = this.pbr("industrial metal", new Color3(0.07, 0.11, 0.12), 0.58, 0.48);
  readonly floor = this.pbr("floor tiles", new Color3(0.16, 0.23, 0.24), 0.2, 0.58);
  readonly steel = this.pbr("brushed steel", new Color3(0.32, 0.4, 0.41), 0.72, 0.35);
  readonly glass = this.pbr("containment glass", new Color3(0.05, 0.25, 0.25), 0.05, 0.12);
  readonly cyan = this.emissive("diagnostic cyan", new Color3(0.05, 1.25, 1.05));
  readonly green = this.emissive("diagnostic green", new Color3(0.08, 1.3, 0.42));
  readonly red = this.emissive("emergency red", new Color3(1.5, 0.03, 0.015));
  readonly lamp = this.emissive("fluorescent lamp", new Color3(0.62, 1.15, 1.08));
  readonly medkit = this.emissive("medkit glow", new Color3(0.1, 1.3, 0.45));
  readonly ammo = this.emissive("ammo glow", new Color3(1.1, 0.65, 0.05));
  readonly hazardYellow = this.pbr("hazard yellow", new Color3(0.95, 0.58, 0.03), 0.15, 0.6);
  readonly hazardBlack = this.pbr("hazard black", new Color3(0.015, 0.018, 0.018), 0.2, 0.7);
  readonly blood = this.pbr("blood", new Color3(0.18, 0.005, 0.005), 0.05, 0.24);
  readonly gunmetal = this.pbr("VX-9 gunmetal", new Color3(0.085, 0.12, 0.13), 0.85, 0.28);
  readonly grip = this.pbr("VX-9 grip", new Color3(0.06, 0.075, 0.075), 0.08, 0.92);
  readonly organicImpact = this.pbr("organic impact", new Color3(0.18, 0.01, 0.005), 0.05, 1, new Color3(0.35, 0.01, 0.005));
  readonly hardImpact = this.pbr("hard impact", new Color3(0.5, 0.36, 0.12), 0.05, 1, new Color3(0.8, 0.42, 0.05));
  private readonly enemySets = new Map<EnemyVariant, { uniform: PBRMaterial; skin: PBRMaterial; eye: PBRMaterial }>();

  constructor(private readonly scene: Scene) {
    this.glass.alpha = 0.32;
    this.glass.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  }

  enemy(variant: EnemyVariant): { uniform: PBRMaterial; skin: PBRMaterial; eye: PBRMaterial } {
    const cached = this.enemySets.get(variant);
    if (cached) return cached;
    const set = {
      uniform: this.pbr(
        `uniform-${variant}`,
        variant === "runner" ? new Color3(0.115, 0.16, 0.12) : new Color3(0.105, 0.14, 0.145),
        0.05,
        0.94,
      ),
      skin: this.pbr(
        `skin-${variant}`,
        variant === "runner" ? new Color3(0.31, 0.12, 0.075) : new Color3(0.25, 0.31, 0.19),
        0,
        1,
      ),
      eye: this.pbr("infected tissue", new Color3(0.34, 0.008, 0.004), 0, 0.76, new Color3(1.15, 0.018, 0.008)),
    };
    this.enemySets.set(variant, set);
    return set;
  }

  freeze(): void {
    this.scene.materials.forEach((material) => material.freeze());
  }

  private pbr(name: string, color: Color3, metallic: number, roughness: number, emissive?: Color3): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    material.albedoColor = color;
    material.metallic = metallic;
    material.roughness = roughness;
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
}
