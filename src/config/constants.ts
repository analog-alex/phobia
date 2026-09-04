/**
 * Gameplay and tuning constants.
 * Keep values identical to original behavior.
 * Grouped for readability and reuse.
 * See AGENTS.md for performance/gameplay invariants.
 */

export const PLAYER = {
  /** Eye/camera height */
  HEIGHT: 2.75,
  /** Collision capsule radius */
  RADIUS: 0.42,
  /** Half height for ellipsoid */
  HALF_HEIGHT: 0.88,
  /** Movement speed (units/s) */
  MOVE_SPEED: 8.5,
  /** Sprint multiplier speed */
  SPRINT_SPEED: 13,
  /** Initial vertical velocity on jump */
  JUMP_VELOCITY: 7.2,
  /** Camera FOV (radians) */
  FOV: 1.05,
  /** Min Z clip */
  MIN_Z: 0.05,
  /** Mouse angular sensitivity */
  ANGULAR_SENSIBILITY: 1900,
  /** Inertia (0 = instant) */
  INERTIA: 0,
} as const;

export const PHYSICS = {
  /** 20 Hz ground check */
  GROUND_CHECK_HZ: 20,
  GROUND_CHECK_INTERVAL: 1 / 20,
  /** Downward ray length for ground probe */
  GROUND_RAY_LENGTH: 2.96,
  /** Max distance to consider grounded */
  GROUND_HIT_DISTANCE: 2.79,
  /** Gravity accel (units/s^2) */
  GRAVITY: 22,
  /** When grounded and falling, clamp vertical vel */
  GROUNDED_VERTICAL_CLAMP: -0.8,
  /** Delta cap per frame */
  MAX_DELTA: 0.033,
} as const;

export const WEAPON = {
  /** Weapon bob amplitude */
  BOB_AMPLITUDE: 0.012,
  /** Bob phase rate while walking / sprinting (rad/s) */
  BOB_RATE: 9.4,
  BOB_RATE_SPRINT: 12.6,
  /** Look-sway offset per rad/s of camera turn, and its clamp */
  SWAY_SCALE: 0.009,
  SWAY_MAX: 0.045,
  /** Weapon kick decay rate */
  KICK_DECAY: 5.4,
  /** Muzzle flash duration (ms) */
  MUZZLE_FLASH_MS: 55,
  /** Muzzle flash intensity */
  MUZZLE_FLASH_INTENSITY: 7,
  /** Muzzle flash sprite size in view space */
  MUZZLE_FLASH_SIZE: 0.26,
  /** Kick crosshair timeout (ms) */
  KICK_CROSSHAIR_MS: 85,
  /**
   * How far the weapon drops out of the aiming pose while reloading. Tuned
   * against the view poses below: too deep and the whole rig leaves the frame.
   */
  RELOAD_DIP: 0.12,
  /**
   * On-pedestal size of a weapon awaiting pickup. Applied as a correction to
   * each profile's view `modelScale` so retuning the first-person framing does
   * not resize the pickups.
   */
  PICKUP_DISPLAY_SCALE: 0.99,
  /**
   * Shared first-person droid hand tuning. Per-weapon `HANDS` entries below
   * position one pair of these in that weapon's model space.
   */
  HANDS: {
    /** Uniform scale of the droid forearm model in weapon model space */
    SCALE: 0.42,
    /**
     * Each weapon's view pose is pulled close enough to the camera that the
     * forearms run off the bottom of the frame. The model ends in a flat cap,
     * so a pose that leaves that cut visible reads as a severed arm.
     */
    /**
     * The point on the hand model that the curled fingers close around.
     * Anchoring here lets each weapon's hand poses be written as the grip
     * position on the weapon rather than as a wrist position.
     */
    GRIP_PIVOT: { x: 0, y: 0, z: 0.61 },
  },
  XMB: {
    /** Clip size */
    CLIP_SIZE: 12,
    /** Starting reserve ammo */
    START_RESERVE: 48,
    /** Reload duration (seconds) */
    RELOAD_DURATION: 0.82,
    /** Pistol damage per hit */
    DAMAGE: 34,
    /** Raycast range for pistol shots */
    RANGE: 80,
    /** Weapon local position base */
    POSITION: { x: 0.26, y: -0.26, z: 0.78 },
    /** Weapon local rotation base */
    ROTATION: { x: -0.08, y: -0.04, z: 0.02 },
    /** Trigger and support hand placement in XMB model space */
    HANDS: {
      RIGHT: {
        POSITION: { x: -0.26, y: -0.22, z: -0.04 },
        FORWARD: { x: 0.93, y: 0.3, z: 0.2 },
        UP: { x: -0.3, y: 0.95, z: 0 },
      },
      LEFT: {
        POSITION: { x: 0.52, y: -0.1, z: 0 },
        FORWARD: { x: 0.4, y: 0.66, z: -0.64 },
        UP: { x: 1, y: 0, z: 0 },
      },
    },
  },
  RIFLE: {
    /** Bolt-action chamber size */
    CLIP_SIZE: 1,
    /** Starting reserve ammo */
    START_RESERVE: 10,
    /** Reload duration (seconds) */
    RELOAD_DURATION: 1.18,
    /** Rifle damage per hit */
    DAMAGE: 115,
    /** Raycast range for rifle shots */
    RANGE: 145,
    /** Weapon local position base */
    POSITION: { x: 0.26, y: -0.22, z: 0.78 },
    /** Weapon local rotation base */
    ROTATION: { x: -0.06, y: -0.08, z: 0.01 },
    /** Trigger and support hand placement in bolt rifle model space */
    HANDS: {
      RIGHT: {
        POSITION: { x: -0.58, y: -0.19, z: -0.04 },
        FORWARD: { x: 0.93, y: 0.3, z: 0.2 },
        UP: { x: -0.3, y: 0.95, z: 0 },
      },
      LEFT: {
        POSITION: { x: 0.22, y: -0.02, z: 0 },
        FORWARD: { x: 0.4, y: 0.66, z: -0.64 },
        UP: { x: 1, y: 0, z: 0 },
      },
    },
  },
} as const;

export const COMBAT = {
  /** Enemy melee damage (normal) */
  ENEMY_MELEE_DAMAGE: 16,
  /** Enemy melee damage (runner) */
  ENEMY_MELEE_DAMAGE_RUNNER: 12,
  /** Acid projectile hit damage */
  ACID_DAMAGE: 18,
  /** Health kit restore amount */
  HEALTH_KIT_RESTORE: 35,
  /** Ammo pickup amount */
  AMMO_PICKUP: 18,
  /** Max health */
  MAX_HEALTH: 100,
} as const;

export const ENEMY_AI = {
  /** 10 Hz decision tick */
  DECISION_TICK: 0.1,
  /** Normal speed */
  SPEED: 1.9,
  /** Runner speed */
  SPEED_RUNNER: 3.2,
  /** Melee range */
  MELEE_RANGE: 1.45,
  /** Detection / chase range */
  CHASE_RANGE: 30,
  /** Acid attack min range */
  ACID_MIN_RANGE: 4.5,
  /** Acid attack max range */
  ACID_MAX_RANGE: 20,
  /** Attack cooldowns (s) */
  COOLDOWN_NORMAL: 0.85,
  COOLDOWN_RUNNER: 0.55,
  COOLDOWN_ACID: 1.6,
  /** Base healths */
  HEALTH_INFECTED: 75,
  HEALTH_RUNNER: 55,
  /** Death tilt lerp duration factor */
  DEATH_LERP: 2.6,
} as const;

export const PICKUPS = {
  /** Collection radius */
  COLLECT_RADIUS: 1.45,
  /** Bob amplitude */
  BOB_AMPLITUDE: 0.035,
  /** Bob frequency multiplier */
  BOB_FREQ: 2.4,
  /** Rotation speed (rad/s) */
  ROT_SPEED: 1.4,
} as const;

export const LEVEL = {
  /** Extraction interact distance */
  EXTRACTION_DISTANCE: 2.6,
  /** Sliding door Z threshold */
  DOOR_Z_THRESHOLD: -25,
  /** Door open Y target */
  DOOR_OPEN_Y: 4.6,
  /** Elevator door proximity-trigger radius */
  ELEVATOR_DOOR_TRIGGER_DISTANCE: 6,
  /** Elevator door slide-open offset (added to each door's closed X) */
  ELEVATOR_DOOR_OPEN_OFFSET: 1.85,
} as const;

export const EFFECTS = {
  /** Impact pool size */
  IMPACT_POOL: 16,
  /** Acid projectile pool size */
  ACID_POOL: 6,
  /** Impact lifetime (ms) */
  IMPACT_LIFETIME_MS: 1200,
  /** Acid gravity */
  ACID_GRAVITY: 12,
  /** Acid flight time clamp */
  ACID_FLIGHT_MIN: 0.65,
  ACID_FLIGHT_MAX: 1.3,
  /** Acid speed divisor */
  ACID_SPEED_DIV: 12,
  /** Player hit radius for acid */
  ACID_PLAYER_RADIUS: 0.72,
  /** Acid lifetime max (s) */
  ACID_MAX_AGE: 3,
} as const;

export const TIMINGS = {
  /** HUD message default (ms) */
  MESSAGE_DEFAULT_MS: 1800,
  /** Hitmarker visible (ms) */
  HITMARKER_MS: 80,
  /** Damage flash (ms) */
  DAMAGE_FLASH_MS: 90,
  /** Start idle callback timeout fallback */
  IDLE_PRELOAD_FALLBACK: 500,
} as const;

export const GRAPHICS = {
  /** Bloom threshold (display space, after tone mapping) */
  BLOOM_THRESHOLD: 0.74,
  /** Bloom weight added back onto the frame */
  BLOOM_WEIGHT: 0.34,
  /** Bloom blur kernel */
  BLOOM_KERNEL: 56,
  /** Bloom render target scale */
  BLOOM_SCALE: 0.5,
  /** Chromatic aberration amount */
  CHROMATIC_AMOUNT: 5,
  /** Image processing exposure (ACES tone mapping) */
  EXPOSURE: 1.28,
  /** Image processing contrast */
  CONTRAST: 1.1,
  /** Scene-wide environment (IBL) intensity */
  ENVIRONMENT_INTENSITY: 0.75,
  /** Hemispheric fill intensity; kept low because IBL supplies most fill */
  AMBIENT_INTENSITY: 0.4,
  /** Waste Disposal runs dimmer than the research sector */
  AMBIENT_WASTE_SCALE: 0.75,
  /** Exponential-squared fog density */
  FOG_DENSITY: 0.0082,
} as const;

export const CAMERA_FEEL = {
  /** Extra FOV while sprinting (radians added to PLAYER.FOV) */
  SPRINT_FOV_BOOST: 0.075,
  /** FOV interpolation rate (per second) */
  FOV_LERP_RATE: 6,
  /** Camera pitch kick per shot (radians), scaled by the weapon kick scale */
  RECOIL_PITCH: 0.012,
  /** Recoil recovery rate (per second) */
  RECOIL_RECOVERY: 9,
  /** Camera roll shake amplitude when taking damage (radians) */
  DAMAGE_ROLL: 0.035,
  /** Damage shake decay rate (per second) */
  DAMAGE_SHAKE_DECAY: 5,
  /** Damage shake oscillation frequency (rad/s) */
  DAMAGE_SHAKE_FREQ: 34,
} as const;

/** Quality light budgets etc are in QualityManager. */
