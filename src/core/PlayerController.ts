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
  private verticalOffset = 0;
  private groundCheckTimer = 0;
  private jumpBufferTimer = 0;
  private movementInputAttached = false;
  private airborne = false;
  private landingImpulse = 0;

  readonly camera: UniversalCamera;

  constructor(
    camera: UniversalCamera,
    private readonly scene: Scene,
    private readonly getKeys: () => ReadonlySet<string>,
    private readonly isMovementEnabled: () => boolean
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
    if (!this.movementInputAttached) {
      this.camera.inputs.add({
        camera: this.camera,
        attachControl: () => undefined,
        detachControl: () => undefined,
        getClassName: () => "PhobiaPlayerMovementInput",
        getSimpleName: () => "phobiaPlayerMovement",
        checkInputs: () => this.checkMovementInput(),
      });
      this.movementInputAttached = true;
    }
  }

  detachControl(): void {
    this.camera.detachControl();
  }

  syncCameraHeight(): void {
    this.camera.position.y = PLAYER.HEIGHT + this.verticalOffset;
  }

  jump(): void {
    this.jumpBufferTimer = 0.14;
  }

  private consumeJump(): void {
    if (!this.grounded || this.jumpBufferTimer <= 0) return;
    this.grounded = false;
    this.jumpBufferTimer = 0;
    this.verticalVelocity = PLAYER.JUMP_VELOCITY;
  }

  private checkMovementInput(): void {
    if (!this.isMovementEnabled()) {
      this.camera.cameraDirection.set(0, 0, 0);
      return;
    }
    const delta = Math.min(0.033, this.scene.getEngine().getDeltaTime() / 1000);
    this.updateMovement(delta, this.getKeys());
  }

  private updateMovement(delta: number, keys: ReadonlySet<string>): void {
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
    if (this.groundCheckTimer <= 0 && this.verticalOffset <= 0) {
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
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - delta);
    this.consumeJump();

    if (this.grounded && this.verticalVelocity < 0) {
      this.verticalVelocity = PHYSICS.GROUNDED_VERTICAL_CLAMP;
      this.verticalOffset = 0;
    } else {
      this.verticalVelocity -= PHYSICS.GRAVITY * delta;
      this.verticalOffset += this.verticalVelocity * delta;
      if (this.verticalOffset > 0.02) this.airborne = true;
      if (this.verticalVelocity <= 0 && this.verticalOffset <= 0) {
        if (this.airborne)
          this.landingImpulse = Math.min(1, -this.verticalVelocity / 9);
        this.airborne = false;
        this.verticalOffset = 0;
        this.verticalVelocity = PHYSICS.GROUNDED_VERTICAL_CLAMP;
        this.grounded = true;
      }
    }
    this.syncCameraHeight();
    this.camera.cameraDirection.y = 0;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  /** Returns the 0..1 landing impulse for a touchdown this frame, then clears it. */
  consumeLanding(): number {
    const impulse = this.landingImpulse;
    this.landingImpulse = 0;
    return impulse;
  }

  /** For potential external reset (e.g. future spawn) */
  resetVertical(): void {
    this.verticalOffset = 0;
    this.verticalVelocity = 0;
    this.syncCameraHeight();
  }
}
