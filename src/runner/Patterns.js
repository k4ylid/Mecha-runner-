// Obstacle pattern library. Each pattern is a list of placements relative to
// its start x. Patterns declare a difficulty tier; the track only picks
// patterns whose tier <= current difficulty tier.
//
// Verbs (variety is the point):
//   jump    — low barrier / laser-high / gap / low drone
//   slide   — overhead beam / laser-low / high drone
//   double  — tall block (needs jet boost or precise jump)
//   thread  — mixed sequences requiring jump->slide chains
//
// Y coordinates are absolute world y (roofs sit at y=0 unless noted);
// obstacle y = floorYAt(dx) resolved at stamp time by the caller unless
// the placement sets `absY`.

export const PATTERNS = [
  // ---------- tier 0: calibration (nearly impossible to fail) ----------
  {
    id: 'calib_barrier',
    tier: 0,
    len: 14,
    minGapAfter: 8,
    items: [
      { type: 'cell', dx: 2, dy: 1.4 }, { type: 'cell', dx: 4, dy: 2.1 },
      { type: 'cell', dx: 6, dy: 2.4 }, { type: 'cell', dx: 8, dy: 2.1 },
      { type: 'cell', dx: 10, dy: 1.4 },
      { type: 'barrier', dx: 7 },
    ],
  },
  {
    id: 'cells_flat',
    tier: 0,
    len: 12,
    items: [0, 1, 2, 3, 4].map((i) => ({ type: 'cell', dx: 2 + i * 2, dy: 0.7 })),
  },
  {
    id: 'warmup_empty',
    tier: 0,
    len: 16,
    items: [],
  },

  // ---------- tier 1: single verbs ----------
  {
    id: 'single_barrier',
    tier: 1,
    len: 10,
    items: [
      { type: 'barrier', dx: 5 },
      { type: 'cell', dx: 3.4, dy: 1.6 }, { type: 'cell', dx: 5, dy: 2.2 }, { type: 'cell', dx: 6.6, dy: 1.6 },
    ],
  },
  {
    id: 'laser_high',
    tier: 1,
    len: 10,
    items: [
      { type: 'laserHigh', dx: 5 },
      { type: 'cell', dx: 5, dy: 2.3 },
    ],
  },
  {
    id: 'overhead_beam',
    tier: 1,
    len: 10,
    items: [
      { type: 'beam', dx: 5 },
      { type: 'cell', dx: 3.5, dy: 0.5 }, { type: 'cell', dx: 5, dy: 0.5 }, { type: 'cell', dx: 6.5, dy: 0.5 },
    ],
  },
  {
    id: 'drone_high',
    tier: 1,
    len: 11,
    items: [{ type: 'droneHigh', dx: 6 }],
  },
  {
    id: 'tall_block',
    tier: 1,
    len: 12,
    items: [
      { type: 'block', dx: 6 },
      { type: 'cell', dx: 4.4, dy: 2.0 }, { type: 'cell', dx: 6, dy: 3.6 }, { type: 'cell', dx: 7.6, dy: 2.0 },
    ],
  },
  {
    id: 'gap_small',
    tier: 1,
    len: 9,
    gap: { start: 2.5, len: 3.2 },
    items: [
      { type: 'cell', dx: 3.4, dy: 1.2 }, { type: 'cell', dx: 4.8, dy: 1.7 }, { type: 'cell', dx: 6.2, dy: 1.2 },
    ],
  },

  // ---------- tier 2: pairs & timing ----------
  {
    id: 'double_barrier',
    tier: 2,
    len: 16,
    items: [
      { type: 'barrier', dx: 4 },
      { type: 'barrier', dx: 10 },
      { type: 'cell', dx: 4, dy: 2.2 }, { type: 'cell', dx: 10, dy: 2.2 },
    ],
  },
  {
    id: 'slide_then_jump',
    tier: 2,
    len: 18,
    items: [
      { type: 'beam', dx: 4 },
      { type: 'barrier', dx: 11 },
      { type: 'cell', dx: 4, dy: 0.5 }, { type: 'cell', dx: 11, dy: 2.2 },
    ],
  },
  {
    id: 'jump_then_slide',
    tier: 2,
    len: 18,
    items: [
      { type: 'barrier', dx: 4 },
      { type: 'laserLow', dx: 11 },
      { type: 'cell', dx: 4, dy: 2.2 }, { type: 'cell', dx: 9.4, dy: 0.5 }, { type: 'cell', dx: 11, dy: 0.5 }, { type: 'cell', dx: 12.6, dy: 0.5 },
    ],
  },
  {
    id: 'drone_low',
    tier: 2,
    len: 11,
    items: [
      { type: 'droneLow', dx: 6 },
      { type: 'cell', dx: 6, dy: 2.4 },
    ],
  },
  {
    id: 'gap_big',
    tier: 2,
    len: 13,
    gap: { start: 2.5, len: 5.2 },
    items: [
      { type: 'cell', dx: 3.5, dy: 1.4 }, { type: 'cell', dx: 5, dy: 2.0 },
      { type: 'cell', dx: 6.5, dy: 2.0 }, { type: 'cell', dx: 8, dy: 1.4 },
    ],
  },
  {
    id: 'steps_up',
    tier: 2,
    len: 18,
    steps: [
      { dx: 3, dy: 1.3 }, { dx: 9, dy: 1.3 }, { dx: 15, dy: -1.3 },
    ],
    items: [
      { type: 'cell', dx: 3, dy: 3.0 }, { type: 'cell', dx: 9, dy: 4.2 }, { type: 'cell', dx: 15, dy: 3.0 },
    ],
  },

  // ---------- tier 3: dense chains ----------
  {
    id: 'triple_barrier',
    tier: 3,
    len: 22,
    items: [
      { type: 'barrier', dx: 4 }, { type: 'barrier', dx: 10 }, { type: 'laserHigh', dx: 16 },
      { type: 'cell', dx: 4, dy: 2.2 }, { type: 'cell', dx: 10, dy: 2.2 }, { type: 'cell', dx: 16, dy: 2.3 },
    ],
  },
  {
    id: 'canyon',
    tier: 3,
    len: 20,
    items: [
      { type: 'block', dx: 4 },
      { type: 'beam', dx: 12 },
      { type: 'cell', dx: 4, dy: 3.8 }, { type: 'cell', dx: 8, dy: 2.2 }, { type: 'cell', dx: 12, dy: 0.5 },
    ],
  },
  {
    id: 'drone_gauntlet',
    tier: 3,
    len: 22,
    items: [
      { type: 'droneHigh', dx: 5 },
      { type: 'droneLow', dx: 11.5 },
      { type: 'droneHigh', dx: 18 },
      { type: 'cell', dx: 5, dy: 0.6 }, { type: 'cell', dx: 11.5, dy: 2.5 }, { type: 'cell', dx: 18, dy: 0.6 },
    ],
  },
  {
    id: 'gap_steps',
    tier: 3,
    len: 24,
    gap: { start: 3, len: 4 },
    steps: [{ dx: 7, dy: 1.3 }],
    items: [
      { type: 'barrier', dx: 10 },
      { type: 'cell', dx: 4.4, dy: 1.6 }, { type: 'cell', dx: 5.8, dy: 2.0 }, { type: 'cell', dx: 10, dy: 3.4 },
    ],
  },
  {
    id: 'slide_squeeze',
    tier: 3,
    len: 20,
    items: [
      { type: 'laserLow', dx: 4 },
      { type: 'beam', dx: 10 },
      { type: 'droneHigh', dx: 16 },
      { type: 'cell', dx: 4, dy: 0.5 }, { type: 'cell', dx: 7, dy: 0.5 },
      { type: 'cell', dx: 10, dy: 0.5 }, { type: 'cell', dx: 16, dy: 0.5 },
    ],
  },
];

// Powerup drops are sprinkled between patterns by the track, not patterned.
export const POWERUP_TYPES = ['shield', 'magnet', 'surge', 'jet'];

export function patternsForTier(tier) {
  return PATTERNS.filter((p) => p.tier <= tier && p.tier > 0);
}
