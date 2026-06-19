import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import { PHYSICS, PLAYER } from "../config/constants";

export class PlayerController {
  private readonly moveVector = new Vector3();
  private readonly groundRay = new Ray(
    Vector3.Zero(),
    Vector3.Down(),
    PHYSICS.GROUND_RAY_LENGTH
  );

  private grounded = false;
  private verticalVelocity = 0;
  private groundCheckTimer = 0;

  readonly camera: UniversalCamera;

  constructor(
    camera: UniversalCamera,
    private readonly scene: Scene
  ) {
    this.camera = camera;
    this.configureCamera();
  }

  private configureCamera(): void {
    this.camera.minZ = PLAYER.MIN_Z;
    this.camera.fov = PLAYER.FOV;
    this.camera.inertia = PLAYER.INERTIA;
    this.camera.angularSensibility = PLAYER.ANGULAR_SENSIBILITY;
    this.camera.checkCollisions = true;
    this.camera.applyGravity = false;
    this.camera.ellipsoid = new Vector3(
      PLAYER.RADIUS,
      PLAYER.HALF_HEIGHT,
      PLAYER.RADIUS
    );
    this.camera.ellipsoidOffset = new Vector3(0, -PLAYER.HALF_HEIGHT, 0);
  }

  attachControl(canvas: HTMLCanvasElement): void {
    this.camera.attachControl(canvas, true);
    this.camera.inputs.removeByType("FreeCameraKeyboardMoveInput");
  }

  detachControl(): void {
    this.camera.detachControl();
  }

  jump(): void {
    if (!this.grounded) return;
    this.grounded = false;
    this.verticalVelocity = PLAYER.JUMP_VELOCITY;
  }

  updateMovement(delta: number, keys: ReadonlySet<string>): void {
    const forwardInput = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
    const strafeInput = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
    const inputLength = Math.hypot(forwardInput, strafeInput);
    const yaw = this.camera.rotation.y;

    if (inputLength > 0) {
      const speed =
        keys.has("ShiftLeft") || keys.has("ShiftRight")
          ? PLAYER.SPRINT_SPEED
          : PLAYER.MOVE_SPEED;
      const nf = forwardInput / inputLength;
      const ns = strafeInput / inputLength;
      this.moveVector.set(
        (Math.sin(yaw) * nf + Math.cos(yaw) * ns) * speed * delta,
        0,
        (Math.cos(yaw) * nf - Math.sin(yaw) * ns) * speed * delta
      );
      this.camera.cameraDirection.x = this.moveVector.x;
      this.camera.cameraDirection.z = this.moveVector.z;
    } else {
      this.camera.cameraDirection.x = 0;
      this.camera.cameraDirection.z = 0;
    }

    this.groundCheckTimer -= delta;
    if (this.groundCheckTimer <= 0) {
      this.groundCheckTimer = PHYSICS.GROUND_CHECK_INTERVAL;
      this.groundRay.origin.copyFrom(this.camera.position);
      const hit = this.scene.pickWithRay(this.groundRay, (mesh) =>
        Boolean(
          (mesh as { metadata?: unknown }).metadata &&
            (
              (mesh as { metadata: { collision?: boolean } }).metadata as {
                collision?: boolean;
              }
            ).collision
        )
      );
      this.grounded = Boolean(
        hit?.hit && hit.distance <= PHYSICS.GROUND_HIT_DISTANCE
      );
    }

    if (this.grounded && this.verticalVelocity < 0)
      this.verticalVelocity = PHYSICS.GROUNDED_VERTICAL_CLAMP;
    else this.verticalVelocity -= PHYSICS.GRAVITY * delta;

    this.camera.cameraDirection.y = this.verticalVelocity * delta;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  /** For potential external reset (e.g. future spawn) */
  resetVertical(): void {
    this.verticalVelocity = 0;
  }
}
