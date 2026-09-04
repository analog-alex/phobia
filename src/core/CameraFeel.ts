import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { CAMERA_FEEL, PLAYER } from "../config/constants";

/**
 * Additive camera motion layered over mouse look: recoil that recovers,
 * a roll shudder when hurt and a sprint FOV stretch. Every effect is applied
 * as a delta and undone by the same path, so mouse aim is never fought and
 * pausing simply freezes it.
 */
export class CameraFeel {
  private recoil = 0;
  private shake = 0;
  private shakeTime = 0;

  constructor(private readonly camera: UniversalCamera) {}

  /** Pitches the view up by `amount` radians; it settles back over time. */
  kick(amount: number): void {
    this.recoil += amount;
    this.camera.rotation.x -= amount;
  }

  /** Adds a damage shudder (0..1). */
  hurt(strength: number): void {
    this.shake = Math.min(1, this.shake + strength);
    this.kick(-CAMERA_FEEL.RECOIL_PITCH * 0.8 * strength);
  }

  update(delta: number, sprinting: boolean): void {
    if (this.recoil !== 0) {
      const recovered =
        this.recoil * Math.min(1, delta * CAMERA_FEEL.RECOIL_RECOVERY);
      this.camera.rotation.x += recovered;
      this.recoil -= recovered;
      if (Math.abs(this.recoil) < 1e-5) this.recoil = 0;
    }

    if (this.shake > 0) {
      this.shakeTime += delta;
      this.shake = Math.max(
        0,
        this.shake - delta * CAMERA_FEEL.DAMAGE_SHAKE_DECAY * (0.4 + this.shake)
      );
      this.camera.rotation.z =
        Math.sin(this.shakeTime * CAMERA_FEEL.DAMAGE_SHAKE_FREQ) *
        this.shake *
        CAMERA_FEEL.DAMAGE_ROLL;
      if (this.shake === 0) this.camera.rotation.z = 0;
    }

    const fovTarget =
      PLAYER.FOV + (sprinting ? CAMERA_FEEL.SPRINT_FOV_BOOST : 0);
    const fov = this.camera.fov;
    if (Math.abs(fov - fovTarget) > 1e-4)
      this.camera.fov =
        fov +
        (fovTarget - fov) * Math.min(1, delta * CAMERA_FEEL.FOV_LERP_RATE);
  }
}
