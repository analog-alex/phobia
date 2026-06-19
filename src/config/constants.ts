/**
 * Gameplay and tuning constants.
 * Keep values identical to original behavior.
 * Grouped for readability and reuse.
 * See AGENTS.md for performance/gameplay invariants.
 */

export const PLAYER = {
  /** Eye/camera height */
  HEIGHT: 1.82,
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
  /** 30 Hz ground check */
  GROUND_CHECK_HZ: 30,
  GROUND_CHECK_INTERVAL: 1 / 30,
  /** Downward ray length for ground probe */
  GROUND_RAY_LENGTH: 2.03,
  /** Max distance to consider grounded */
  GROUND_HIT_DISTANCE: 1.86,
  /** Gravity accel (units/s^2) */
  GRAVITY: 22,
  /** When grounded and falling, clamp vertical vel */
  GROUNDED_VERTICAL_CLAMP: -0.8,
  /** Delta cap per frame */
  MAX_DELTA: 0.033,
} as const;

export const WEAPON = {
  /** Clip size */
  CLIP_SIZE: 12,
  /** Starting reserve ammo */
  START_RESERVE: 48,
  /** Reload duration (seconds) */
  RELOAD_DURATION: 0.82,
  /** Weapon bob amplitude */
  BOB_AMPLITUDE: 0.012,
  /** Weapon kick decay rate */
  KICK_DECAY: 5.4,
  /** Muzzle flash duration (ms) */
  MUZZLE_FLASH_MS: 42,
  /** Muzzle flash intensity */
  MUZZLE_FLASH_INTENSITY: 4,
  /** Raycast range for shots */
  FIRE_RANGE: 80,
  /** Kick crosshair timeout (ms) */
  KICK_CROSSHAIR_MS: 85,
  /** Weapon local position base */
  POSITION: { x: 0.42, y: -0.37, z: 0.95 },
  /** Weapon local rotation base */
  ROTATION: { x: -0.08, y: -0.04, z: 0.02 },
} as const;

export const COMBAT = {
  /** Pistol damage per hit */
  PISTOL_DAMAGE: 34,
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
  /** 20 Hz decision tick */
  DECISION_TICK: 0.05,
  /** Normal speed */
  SPEED: 1.45,
  /** Runner speed */
  SPEED_RUNNER: 2.5,
  /** Melee range */
  MELEE_RANGE: 1.45,
  /** Detection / chase range */
  CHASE_RANGE: 24,
  /** Acid attack min range */
  ACID_MIN_RANGE: 4.5,
  /** Acid attack max range */
  ACID_MAX_RANGE: 20,
  /** Attack cooldowns (s) */
  COOLDOWN_NORMAL: 1.15,
  COOLDOWN_RUNNER: 0.78,
  COOLDOWN_ACID: 2.15,
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
  /** Default render scale (medium) */
  DEFAULT_RENDER_SCALE: 0.8,
  /** Bloom threshold */
  BLOOM_THRESHOLD: 0.72,
  /** Chromatic aberration amount */
  CHROMATIC_AMOUNT: 5,
} as const;

/** Quality light budgets etc are in QualityManager. */
