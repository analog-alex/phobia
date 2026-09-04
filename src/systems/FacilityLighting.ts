import { PointLight } from "@babylonjs/core/Lights/pointLight";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import type { Scene } from "@babylonjs/core/scene";

/** Visible fixture (tube, beacon) that should dim in step with its light. */
export interface FacilityEmitter {
  size: Vector3;
  position: Vector3;
  material: Material;
}

interface LightSource {
  position: Vector3;
  color: Color3;
  intensity: number;
  range: number;
  flicker: boolean;
  /** Current flicker multiplier applied to intensity and the tube colour. */
  level: number;
  /** Seconds until the next flicker state change. */
  timer: number;
  /** Toggles left in the current flicker event (0 = steady). */
  togglesLeft: number;
  lit: boolean;
  dimLevel: number;
  /** Brightness reached while "off" during the current event. */
  dropLevel: number;
  /** Brown-out events sag slowly instead of blinking. */
  sag: boolean;
  tube?: { group: TubeGroup; index: number };
  slot: LightSlot | null;
  distanceSquared: number;
}

interface LightSlot {
  light: PointLight;
  source: LightSource | null;
  pending: LightSource | null;
  /** 0..1 activation fade so lights swell in instead of popping. */
  fade: number;
}

interface TubeGroup {
  material: Material;
  matrices: Matrix[];
  colors: Float32Array;
  mesh?: Mesh;
}

const RECOMPUTE_INTERVAL = 0.2;
const FADE_RATE = 1 / 0.28;

const random = (min: number, max: number): number =>
  min + Math.random() * (max - min);

/**
 * Nearest-N facility lighting.
 *
 * A fixed pool of `budget` point lights stays enabled and is retargeted to the
 * nearest light sources as the player moves. Keeping the enabled light count
 * constant matters because the level materials are frozen: Babylon compiles
 * the light count into the shader when a frozen material is first drawn and
 * never revisits it, so toggling lights on and off would either leave them
 * dark or leave stale light data bound. Sources that are not currently backed
 * by a light still animate their flicker through the tube fixtures.
 */
export class FacilityLighting {
  private readonly sources: LightSource[] = [];
  private readonly slots: LightSlot[] = [];
  private readonly tubeGroups = new Map<Material, TubeGroup>();
  private readonly nearest: LightSource[] = [];
  private budget = 0;
  private lightUpdateTimer = 0;
  private time = 0;

  constructor(
    private readonly scene: Scene,
    /** Receives fixtures that never flicker so the level can batch them. */
    private readonly batchStaticEmitter: (emitter: FacilityEmitter) => void
  ) {}

  /**
   * Sets how many point lights back this level. Returns true when the number
   * of enabled lights changed, in which case frozen materials must be told to
   * recompile.
   */
  setBudget(count: number): boolean {
    this.budget = count;
    this.lightUpdateTimer = 0;
    let changed = false;
    while (this.slots.length < count) {
      const light = new PointLight(
        `facility light slot ${this.slots.length}`,
        new Vector3(0, 3.8, 0),
        this.scene
      );
      light.intensity = 0;
      light.range = 10;
      light.setEnabled(false);
      this.slots.push({ light, source: null, pending: null, fade: 0 });
    }
    this.slots.forEach((slot, index) => {
      const enabled = index < count;
      if (slot.light.isEnabled() !== enabled) {
        slot.light.setEnabled(enabled);
        changed = true;
      }
      if (enabled) return;
      slot.light.intensity = 0;
      if (slot.source) slot.source.slot = null;
      slot.source = null;
      slot.pending = null;
      slot.fade = 0;
    });
    return changed;
  }

  getActiveCount(): number {
    let count = 0;
    for (const slot of this.slots) if (slot.light.intensity > 0.001) count += 1;
    return count;
  }

  add(
    position: Vector3,
    color: Color3,
    intensity: number,
    range: number,
    flicker: boolean,
    emitter?: FacilityEmitter
  ): void {
    const source: LightSource = {
      position,
      color,
      intensity,
      range,
      flicker,
      level: 1,
      timer: random(0.4, 3),
      togglesLeft: 0,
      lit: true,
      dimLevel: 1,
      dropLevel: 0.08,
      sag: false,
      slot: null,
      distanceSquared: Infinity,
    };
    if (emitter) {
      if (flicker) source.tube = this.registerTube(emitter);
      else this.batchStaticEmitter(emitter);
    }
    this.sources.push(source);
  }

  /** Builds the flickering fixture meshes. Call once all lights are added. */
  build(): void {
    this.tubeGroups.forEach((group, material) => {
      const mesh = CreateBox(
        `flicker fixtures ${material.name}`,
        { size: 1 },
        this.scene
      );
      mesh.material = material;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      const matrices = new Float32Array(group.matrices.length * 16);
      group.matrices.forEach((matrix, index) => {
        matrix.copyToArray(matrices, index * 16);
      });
      mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
      group.colors = new Float32Array(group.matrices.length * 4).fill(1);
      mesh.thinInstanceSetBuffer("color", group.colors, 4, false);
      mesh.thinInstanceRefreshBoundingInfo(true);
      group.mesh = mesh;
    });
  }

  update(delta: number, playerPosition: Vector3): void {
    this.time += delta;
    this.lightUpdateTimer -= delta;
    if (this.lightUpdateTimer <= 0) {
      this.lightUpdateTimer = RECOMPUTE_INTERVAL;
      this.recomputeActive(playerPosition);
    }

    let tubesDirty = false;
    for (const source of this.sources) {
      if (!source.flicker) continue;
      const previous = source.level;
      this.tickFlicker(source, delta);
      if (source.tube && previous !== source.level) {
        const { group, index } = source.tube;
        group.colors[index * 4] = source.level;
        group.colors[index * 4 + 1] = source.level;
        group.colors[index * 4 + 2] = source.level;
        tubesDirty = true;
      }
    }
    if (tubesDirty)
      this.tubeGroups.forEach((group) => {
        group.mesh?.thinInstanceBufferUpdated("color");
      });

    for (const slot of this.slots) {
      if (!slot.light.isEnabled()) continue;
      if (slot.pending) {
        slot.fade = Math.max(0, slot.fade - delta * FADE_RATE);
        if (slot.fade === 0 || !slot.source) {
          this.assign(slot, slot.pending);
          slot.pending = null;
        }
      } else if (slot.source) {
        slot.fade = Math.min(1, slot.fade + delta * FADE_RATE);
      }
      const source = slot.source;
      if (!source) {
        slot.light.intensity = 0;
        continue;
      }
      const fade = slot.fade * slot.fade * (3 - 2 * slot.fade);
      slot.light.intensity = source.intensity * source.level * fade;
    }
  }

  private registerTube(emitter: FacilityEmitter): {
    group: TubeGroup;
    index: number;
  } {
    let group = this.tubeGroups.get(emitter.material);
    if (!group) {
      group = {
        material: emitter.material,
        matrices: [],
        colors: new Float32Array(0),
      };
      this.tubeGroups.set(emitter.material, group);
    }
    group.matrices.push(
      Matrix.Compose(emitter.size, Quaternion.Identity(), emitter.position)
    );
    return { group, index: group.matrices.length - 1 };
  }

  private assign(slot: LightSlot, source: LightSource): void {
    if (slot.source) slot.source.slot = null;
    slot.source = source;
    source.slot = slot;
    slot.light.position.copyFrom(source.position);
    slot.light.diffuse.copyFrom(source.color);
    slot.light.range = source.range;
    slot.fade = 0;
  }

  /**
   * Dying-fluorescent behaviour: a steady hum with a faint high-frequency
   * shimmer, interrupted by random dropouts, stutter bursts and brown-outs.
   */
  private tickFlicker(source: LightSource, delta: number): void {
    source.timer -= delta;
    if (source.timer <= 0) {
      if (source.togglesLeft > 0) {
        source.togglesLeft -= 1;
        source.lit = !source.lit;
        if (source.lit) {
          source.dimLevel = 1;
          source.timer = random(0.05, 0.18);
        } else {
          source.timer = source.sag ? random(0.25, 0.6) : random(0.03, 0.12);
        }
      } else {
        source.lit = true;
        source.dimLevel = 1;
        source.timer = random(0.45, 3.6);
        const roll = Math.random();
        if (roll < 0.5) {
          // Single dropout.
          source.togglesLeft = 2;
        } else if (roll < 0.8) {
          // Stutter burst.
          source.togglesLeft = 4 + 2 * Math.floor(random(0, 3));
        } else {
          // Brown-out sag.
          source.togglesLeft = 2;
        }
        // Brown-outs sag for longer; dropouts go nearly dark.
        source.sag = roll >= 0.8;
        source.dropLevel = source.sag ? random(0.45, 0.7) : random(0.02, 0.16);
      }
    }
    const buzz = 0.955 + 0.045 * Math.sin(this.time * 61 + source.position.z);
    const target = source.lit ? source.dimLevel : source.dropLevel;
    source.level = target * buzz;
  }

  private recomputeActive(playerPosition: Vector3): void {
    const active = Math.min(this.budget, this.slots.length);
    if (active === 0) return;
    for (const source of this.sources)
      source.distanceSquared = Vector3.DistanceSquared(
        source.position,
        playerPosition
      );
    this.nearest.length = 0;
    for (const source of this.sources) {
      // Insertion into a tiny sorted list beats sorting the whole array.
      if (
        this.nearest.length === active &&
        source.distanceSquared >=
          this.nearest[this.nearest.length - 1].distanceSquared
      )
        continue;
      let index = this.nearest.length;
      while (
        index > 0 &&
        this.nearest[index - 1].distanceSquared > source.distanceSquared
      )
        index -= 1;
      this.nearest.splice(index, 0, source);
      if (this.nearest.length > active) this.nearest.pop();
    }

    // Slots whose source dropped out of the nearest set hand it over to a
    // source that gained a place; the crossfade happens in update().
    for (let index = 0; index < active; index += 1) {
      const slot = this.slots[index];
      if (slot.pending && !this.nearest.includes(slot.pending))
        slot.pending = null;
      const current = slot.pending ?? slot.source;
      if (current && this.nearest.includes(current)) continue;
      const incoming = this.nearest.find(
        (source) =>
          !source.slot && !this.slots.some((other) => other.pending === source)
      );
      if (!incoming) continue;
      if (!slot.source) {
        this.assign(slot, incoming);
        slot.pending = null;
      } else slot.pending = incoming;
    }
  }
}
