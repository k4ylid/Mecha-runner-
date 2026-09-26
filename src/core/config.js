// Shared tuning constants. Gameplay lives on the XY plane at z=0;
// the world treadmill-scrolls toward -X while the player holds near x=PLAYER_X.

export const PLAYER_X = -4.5; // player anchor on screen (left third)
export const GROUND_Y = 0; // top surface of the running deck
export const KILL_X = -34; // recycle anything past this
export const SPAWN_X = 46; // spawn just beyond view + margin

export const SPEED = {
  start: 9, // units/s at run start
  max: 27,
  // exponential approach: speed = max - (max-start)*exp(-t/T)
  rampT: 55, // ~seconds to feel fast (reaches ~80% of max at ~90s)
  warmupT: 7.5, // zero-failure grace at run start
  stumblePenalty: 0.55, // speed multiplier after a shielded hit
};

export const PHYS = {
  gravity: -58,
  jumpVel: 17.5, // ~2.6u apex, clears LOW_BARRIER
  jetVel: 14.5, // double-jump (jet boost)
  fastFall: -42,
  releaseDamp: 0.42, // early release cuts vy — variable jump height
  coyote: 0.1,
  buffer: 0.12,
  slideTime: 0.62,
  slideCooldown: 0.14,
  landHardVy: -26, // landing below this = heavier squash/dust
};

export const MECHA = {
  hitW: 0.95, // hitbox — deliberately smaller than the visual mech
  hitH: 2.15,
  hitHSlide: 1.05,
};

export const SCORE = {
  perMeter: 10,
  cell: 25,
  nearMiss: 40,
  milestone: 500, // every MILESTONE_EVERY meters
  milestoneEvery: 500,
  comboWindow: 3.2, // seconds between pickups/near-misses to hold combo
  comboMax: 8, // x1..x8 multiplier
};

export const POWERUPS = {
  shieldTime: 12,
  magnetRadius: 6.5,
  magnetTime: 10,
  surgeTime: 10, // x2 score
  jetTime: 6, // unlimited double-jumps feel — sustained glide window
};

export const QUALITY = {
  low: {
    label: 'LOW',
    pixelRatio: 1,
    bloom: false,
    gtao: false,
    msaa: 0,
    shadow: 0,
    particles: 0.35,
    cityDensity: 0.55,
  },
  med: {
    label: 'MEDIUM',
    pixelRatio: 1.5,
    bloom: true,
    gtao: false,
    msaa: 2,
    shadow: 1024,
    particles: 0.65,
    cityDensity: 0.8,
  },
  high: {
    label: 'HIGH',
    pixelRatio: 2,
    bloom: true,
    gtao: true,
    msaa: 4,
    shadow: 2048,
    particles: 1,
    cityDensity: 1,
  },
};

export const DEFAULT_BINDINGS = {
  jump: 'Space',
  slide: 'KeyS',
  pause: 'Escape',
};
// Secondary hard-coded alternates (always active alongside the remapped key).
export const ALT_BINDINGS = {
  jump: ['KeyW', 'ArrowUp', 'KeyK'],
  slide: ['ArrowDown', 'ShiftLeft', 'KeyJ'],
  pause: ['KeyP'],
};

export const STORAGE_KEYS = {
  settings: 'mecha-runner.settings.v1',
  bests: 'mecha-runner.bests.v1',
  missions: 'mecha-runner.missions.v1',
  lifetime: 'mecha-runner.lifetime.v1',
};
