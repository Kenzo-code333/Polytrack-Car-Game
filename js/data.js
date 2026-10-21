// Static game data: seasons, maps, power-ups and car parts.

export const SEASONS = {
  spring: {
    id: 'spring', name: 'Spring', icon: '🌸',
    desc: 'Cherry blossoms and fresh grass. Balanced grip.',
    skyTop: 0x4f9ef0, skyBottom: 0xd4ecff, fog: 0xcfe4f5,
    sun: 0xfff1dc, sunIntensity: 2.7, sunDir: [0.45, 0.8, 0.35],
    hemiSky: 0xd8ecff, hemiGround: 0x5f8f45, hemiIntensity: 1.1,
    ground: [0x74bd55, 0x8fd16a], rock: 0x8a8f96,
    leaves: [0xf7a8c8, 0xffc4dc, 0xfff0f6, 0x8fd16a, 0x6cbf55],
    conifer: 0x3f7d4a, coniferRatio: 0.25, snowCaps: false,
    wall: [0xffffff, 0xff7aa8],
    particles: { kind: 'petal', colors: [0xffc0d8, 0xffffff, 0xff9ec4], count: 900, fall: 1.4, drift: 2.4, size: 0.42 },
    extras: 'flowers', grip: 1.0, water: 0x3d8fd6,
  },
  summer: {
    id: 'summer', name: 'Summer', icon: '☀️',
    desc: 'Blazing sun and warm asphalt. Best grip of the year.',
    skyTop: 0x2f86ea, skyBottom: 0xbfe2ff, fog: 0xc6e1f7,
    sun: 0xfff6e0, sunIntensity: 3.2, sunDir: [0.3, 0.92, 0.25],
    hemiSky: 0xcfe8ff, hemiGround: 0x4f8a35, hemiIntensity: 1.15,
    ground: [0x5cad3c, 0x78c24e], rock: 0x9a9184,
    leaves: [0x4f9e36, 0x5fb33f, 0x3f8a2e, 0x78c24e, 0x2f7a2a],
    conifer: 0x2f6b3a, coniferRatio: 0.3, snowCaps: false,
    wall: [0xffffff, 0x2f86ea],
    particles: { kind: 'pollen', colors: [0xfff6b0, 0xffffff], count: 260, fall: 0.15, drift: 0.8, size: 0.16 },
    extras: 'sunflowers', grip: 1.05, water: 0x2a9ad8,
  },
  autumn: {
    id: 'autumn', name: 'Autumn', icon: '🍂',
    desc: 'Golden leaves everywhere. Slightly slippery corners.',
    skyTop: 0x6c9bd1, skyBottom: 0xf6dcb8, fog: 0xeed8bd,
    sun: 0xffd29a, sunIntensity: 2.5, sunDir: [-0.55, 0.5, 0.4],
    hemiSky: 0xffe2c0, hemiGround: 0x7a5a2c, hemiIntensity: 1.0,
    ground: [0xa7a043, 0xc19a45], rock: 0x86796a,
    leaves: [0xe07b39, 0xd94f30, 0xf2b134, 0xc8642a, 0xa83c2a],
    conifer: 0x3d6b3e, coniferRatio: 0.2, snowCaps: false,
    wall: [0xffffff, 0xe07b39],
    particles: { kind: 'leaf', colors: [0xe07b39, 0xf2b134, 0xd94f30], count: 650, fall: 2.0, drift: 3.2, size: 0.5 },
    extras: 'pumpkins', grip: 0.94, water: 0x3f7fae,
  },
  winter: {
    id: 'winter', name: 'Winter', icon: '❄️',
    desc: 'Snow and ice. Very slippery — snow chains help a lot!',
    skyTop: 0x8fb3d9, skyBottom: 0xeef4fa, fog: 0xe6eef6,
    sun: 0xf4f8ff, sunIntensity: 2.0, sunDir: [0.4, 0.45, -0.5],
    hemiSky: 0xf0f6ff, hemiGround: 0xb9c8d8, hemiIntensity: 1.3,
    ground: [0xf3f7fb, 0xe2ebf3], rock: 0x7f8a96,
    leaves: [0xf6f9fc, 0xe9f0f6, 0xdfe8f0],
    conifer: 0x2e5a45, coniferRatio: 0.75, snowCaps: true,
    wall: [0xffffff, 0x3a6fd8],
    particles: { kind: 'snow', colors: [0xffffff, 0xeef6ff], count: 2400, fall: 4.5, drift: 1.4, size: 0.32 },
    extras: 'snowmen', grip: 0.76, water: 0xcfe6f5, ice: true,
  },
};

function figureEight() {
  const pts = [];
  const n = 18;
  for (let k = 0; k < n; k++) {
    const t = Math.PI / 2 + (k / n) * Math.PI * 2;
    pts.push([Math.sin(t) * 165, 4.6 * (1 + Math.cos(t)), Math.sin(t) * Math.cos(t) * 200]);
  }
  return pts;
}

export const MAPS = [
  {
    id: 'valley', name: 'Green Valley', stars: 1, laps: 3, width: 17,
    desc: 'Rolling hills, two big jumps and a bumpy stretch.',
    terrainFollow: true, hills: 10, trees: 520,
    features: { ramps: [0.3, 0.7], bumps: [0.08, 0.52] },
    points: [[0, 0, -120], [80, 4, -112], [132, 9, -52], [122, 6, 30], [72, 2, 92], [0, 0, 112],
      [-72, 4, 100], [-122, 9, 40], [-112, 5, -50], [-70, 1, -110]],
  },
  {
    id: 'forest', name: 'Twisty Forest', stars: 2, laps: 3, width: 16,
    desc: 'Tight S-bends through a dense forest. Brake early!',
    terrainFollow: true, hills: 14, trees: 1100,
    features: { ramps: [0.42], bumps: [0.15, 0.62, 0.85] },
    points: [[0, 0, -140], [62, 2, -132], [96, 5, -84], [52, 3, -40], [92, 6, 2], [142, 9, 32],
      [124, 7, 92], [64, 3, 114], [22, 1, 74], [-30, 4, 114], [-92, 8, 104], [-124, 6, 42],
      [-82, 2, 0], [-124, 4, -52], [-92, 1, -122]],
  },
  {
    id: 'bridge', name: 'Figure-8 Bridge', stars: 2, laps: 3, width: 16,
    desc: 'Cross over yourself on a big bridge. Watch the crossing!',
    terrainFollow: false, hills: 8, trees: 450,
    features: { ramps: [0.12, 0.62], bumps: [0.4, 0.9] },
    points: figureEight(),
  },
  {
    id: 'mountain', name: 'Mountain Pass', stars: 3, laps: 3, width: 15,
    desc: 'Climb and dive through steep mountain roads.',
    terrainFollow: true, hills: 26, trees: 650,
    features: { ramps: [0.25], bumps: [0.55, 0.8] },
    points: [[0, 0, -150], [90, 5, -142], [152, 13, -82], [164, 21, 0], [124, 26, 72], [44, 19, 124],
      [-40, 12, 142], [-112, 7, 100], [-152, 3, 20], [-122, 0, -62], [-72, 0, -134]],
  },
  {
    id: 'coast', name: 'Coastal Speedway', stars: 3, laps: 3, width: 18,
    desc: 'A long high-speed track along the beach.',
    terrainFollow: true, hills: 12, trees: 480, water: -1.2,
    base: (x) => (x > 135 ? -(x - 135) * 0.11 : 0),
    features: { ramps: [0.2, 0.55, 0.8], bumps: [0.36] },
    points: [[0, 0, -185], [102, 2, -172], [172, 4, -102], [184, 2, 0], [152, 0, 104], [62, 3, 162],
      [-40, 6, 152], [-102, 4, 92], [-92, 1, 22], [-152, 3, -42], [-134, 5, -132], [-62, 2, -184]],
  },
];

export const DIFFICULTIES = {
  easy: { id: 'easy', name: 'Easy', speed: 0.84, skill: 0.75, rubber: 0.05 },
  normal: { id: 'normal', name: 'Normal', speed: 0.94, skill: 0.88, rubber: 0.035 },
  hard: { id: 'hard', name: 'Hard', speed: 1.02, skill: 1.0, rubber: 0.0 },
};

export const POWERUPS = {
  boost: { id: 'boost', name: 'Speed Boost', icon: '🚀' },
  mud: { id: 'mud', name: 'Mud Splash', icon: '🟤' },
  shield: { id: 'shield', name: 'Shield', icon: '🛡️' },
  magnet: { id: 'magnet', name: 'Coin Magnet', icon: '🧲' },
  oil: { id: 'oil', name: 'Oil Slick', icon: '🛢️' },
};

export const PLACE_BONUS = [60, 35, 20, 12, 8, 5];

export const CATEGORIES = [
  { id: 'paint', name: 'Paint', icon: '🎨' },
  { id: 'body', name: 'Body', icon: '🚗' },
  { id: 'wheels', name: 'Wheels', icon: '🛞' },
  { id: 'tires', name: 'Tires', icon: '⚫' },
  { id: 'engine', name: 'Engine', icon: '⚙️' },
  { id: 'nitro', name: 'Nitro', icon: '🔥' },
  { id: 'spoiler', name: 'Spoiler', icon: '🪽' },
  { id: 'exhaust', name: 'Exhaust', icon: '💨' },
  { id: 'underglow', name: 'Underglow', icon: '💡' },
  { id: 'decal', name: 'Decals', icon: '🏁' },
  { id: 'topper', name: 'Topper', icon: '👑' },
];

// stats: speed (m/s), accel, turn (rad/s), grip, nitro (duration/power multiplier)
export const PARTS = [
  // Paint
  { id: 'paint_red', cat: 'paint', name: 'Racing Red', price: 0, look: { color: 0xe63946 } },
  { id: 'paint_blue', cat: 'paint', name: 'Ocean Blue', price: 60, look: { color: 0x1d76db } },
  { id: 'paint_lime', cat: 'paint', name: 'Lime Zest', price: 60, look: { color: 0x7bd23a } },
  { id: 'paint_yellow', cat: 'paint', name: 'Sunburst', price: 80, look: { color: 0xffc300 } },
  { id: 'paint_orange', cat: 'paint', name: 'Tangerine', price: 80, look: { color: 0xff7b1c } },
  { id: 'paint_purple', cat: 'paint', name: 'Royal Purple', price: 100, look: { color: 0x7b2cbf } },
  { id: 'paint_pink', cat: 'paint', name: 'Bubblegum', price: 120, look: { color: 0xff6fb5 } },
  { id: 'paint_white', cat: 'paint', name: 'Pearl White', price: 120, look: { color: 0xf2f2f2, roughness: 0.25 } },
  { id: 'paint_black', cat: 'paint', name: 'Midnight', price: 150, look: { color: 0x15161b, metalness: 0.6, roughness: 0.25 } },
  { id: 'paint_chrome', cat: 'paint', name: 'Mirror Chrome', price: 450, look: { color: 0xf4f6ff, metalness: 0.85, roughness: 0.12 } },
  { id: 'paint_gold', cat: 'paint', name: 'Gold Rush', chest: true, look: { color: 0xffd257, metalness: 0.8, roughness: 0.22 } },
  { id: 'paint_rainbow', cat: 'paint', name: 'Rainbow Shift', chest: true, look: { color: 0xff0000, rainbow: true, metalness: 0.4, roughness: 0.25 } },

  // Body
  { id: 'body_classic', cat: 'body', name: 'Classic', price: 0, stats: {}, look: { shape: 'classic' } },
  { id: 'body_sport', cat: 'body', name: 'Sport', price: 350, stats: { speed: 1.5, turn: 0.25 }, look: { shape: 'sport' } },
  { id: 'body_buggy', cat: 'body', name: 'Dune Buggy', price: 450, stats: { accel: 3, grip: 2, speed: -1 }, look: { shape: 'buggy' } },
  { id: 'body_muscle', cat: 'body', name: 'Muscle', price: 550, stats: { accel: 5, speed: 2 }, look: { shape: 'muscle' } },
  { id: 'body_hyper', cat: 'body', name: 'Hypercar', price: 1400, stats: { speed: 5, accel: 3, turn: 0.2 }, look: { shape: 'hyper' } },

  // Wheels
  { id: 'wheels_std', cat: 'wheels', name: 'Standard', price: 0, look: { rim: 0xc9ced6, style: 'disc' } },
  { id: 'wheels_sport', cat: 'wheels', name: 'Sport Rims', price: 150, stats: { turn: 0.05 }, look: { rim: 0x1d1f24, style: 'spoke' } },
  { id: 'wheels_offroad', cat: 'wheels', name: 'Off-Road', price: 260, stats: { grip: 1 }, look: { rim: 0x3a3d44, style: 'chunky', scale: 1.15 } },
  { id: 'wheels_neon', cat: 'wheels', name: 'Neon Rims', price: 380, stats: { turn: 0.05 }, look: { rim: 0x22e6ff, style: 'spoke', glow: true } },
  { id: 'wheels_gold', cat: 'wheels', name: 'Golden Rims', chest: true, stats: { turn: 0.1, grip: 0.5 }, look: { rim: 0xffc94a, style: 'spoke', metal: true } },

  // Tires
  { id: 'tires_street', cat: 'tires', name: 'Street', price: 0, stats: {} },
  { id: 'tires_sport', cat: 'tires', name: 'Sport', price: 200, stats: { grip: 1.5 } },
  { id: 'tires_chains', cat: 'tires', name: 'Snow Chains', price: 320, stats: { grip: 0.5, winter: 0.35 } },
  { id: 'tires_slicks', cat: 'tires', name: 'Racing Slicks', price: 520, stats: { grip: 3 } },

  // Engine
  { id: 'engine_stock', cat: 'engine', name: 'Stock', price: 0, stats: {} },
  { id: 'engine_tuned', cat: 'engine', name: 'Tuned', price: 300, stats: { speed: 2, accel: 3 } },
  { id: 'engine_turbo', cat: 'engine', name: 'Turbo', price: 750, stats: { speed: 4, accel: 6 }, look: { scoop: true } },
  { id: 'engine_v12', cat: 'engine', name: 'V12 Monster', price: 1600, stats: { speed: 7, accel: 9 }, look: { blower: true } },

  // Nitro
  { id: 'nitro_basic', cat: 'nitro', name: 'Basic', price: 0, stats: {} },
  { id: 'nitro_plus', cat: 'nitro', name: 'Nitro+', price: 250, stats: { nitro: 0.25 } },
  { id: 'nitro_mega', cat: 'nitro', name: 'Mega Nitro', price: 650, stats: { nitro: 0.5 } },
  { id: 'nitro_hyper', cat: 'nitro', name: 'Hyper Nitro', chest: true, stats: { nitro: 0.8 } },

  // Spoiler
  { id: 'spoiler_none', cat: 'spoiler', name: 'None', price: 0, look: { type: 'none' } },
  { id: 'spoiler_duck', cat: 'spoiler', name: 'Ducktail', price: 100, stats: { grip: 0.3 }, look: { type: 'duck' } },
  { id: 'spoiler_gt', cat: 'spoiler', name: 'GT Wing', price: 300, stats: { grip: 0.6, turn: 0.1 }, look: { type: 'gt' } },
  { id: 'spoiler_twin', cat: 'spoiler', name: 'Twin Deck', price: 480, stats: { grip: 0.9, turn: 0.12 }, look: { type: 'twin' } },
  { id: 'spoiler_dragon', cat: 'spoiler', name: 'Dragon Wing', chest: true, stats: { grip: 1.3, turn: 0.2 }, look: { type: 'dragon' } },

  // Exhaust (flame colour while boosting)
  { id: 'exhaust_std', cat: 'exhaust', name: 'Standard', price: 0, look: { flame: 0xff8a2a } },
  { id: 'exhaust_blue', cat: 'exhaust', name: 'Blue Flames', price: 150, look: { flame: 0x3aa0ff } },
  { id: 'exhaust_green', cat: 'exhaust', name: 'Green Flames', price: 150, look: { flame: 0x4cff6a } },
  { id: 'exhaust_purple', cat: 'exhaust', name: 'Purple Flames', price: 200, look: { flame: 0xc05cff } },
  { id: 'exhaust_rainbow', cat: 'exhaust', name: 'Rainbow Flames', chest: true, look: { flame: 0xff0000, rainbow: true } },

  // Underglow
  { id: 'glow_none', cat: 'underglow', name: 'None', price: 0, look: {} },
  { id: 'glow_cyan', cat: 'underglow', name: 'Cyan Glow', price: 200, look: { glow: 0x22e6ff } },
  { id: 'glow_pink', cat: 'underglow', name: 'Pink Glow', price: 200, look: { glow: 0xff4fd8 } },
  { id: 'glow_lime', cat: 'underglow', name: 'Lime Glow', price: 200, look: { glow: 0x8cff3a } },
  { id: 'glow_rainbow', cat: 'underglow', name: 'Rainbow Glow', chest: true, look: { glow: 0xff0000, rainbow: true } },

  // Decals
  { id: 'decal_none', cat: 'decal', name: 'None', price: 0, look: {} },
  { id: 'decal_stripes', cat: 'decal', name: 'Racing Stripes', price: 120, look: { stripes: 0xffffff } },
  { id: 'decal_side', cat: 'decal', name: 'Side Stripe', price: 100, look: { side: 0x111111 } },
  { id: 'decal_number', cat: 'decal', name: 'Race Number', price: 160, look: { number: true } },
  { id: 'decal_gold', cat: 'decal', name: 'Gold Stripes', chest: true, look: { stripes: 0xffc94a, metal: true } },

  // Toppers
  { id: 'top_none', cat: 'topper', name: 'None', price: 0, look: {} },
  { id: 'top_antenna', cat: 'topper', name: 'Antenna Ball', price: 60, look: { kind: 'antenna' } },
  { id: 'top_cone', cat: 'topper', name: 'Traffic Cone', price: 80, look: { kind: 'cone' } },
  { id: 'top_fin', cat: 'topper', name: 'Shark Fin', price: 150, look: { kind: 'fin' } },
  { id: 'top_duck', cat: 'topper', name: 'Rubber Duck', price: 260, look: { kind: 'duck' } },
  { id: 'top_crown', cat: 'topper', name: 'Royal Crown', chest: true, look: { kind: 'crown' } },
];

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]));

export const DEFAULT_EQUIPPED = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, PARTS.find((p) => p.cat === c.id && p.price === 0).id]),
);

export const BASE_STATS = { speed: 40, accel: 20, turn: 2.3, grip: 7, nitro: 1, winter: 0 };

export function computeStats(equipped) {
  const s = { ...BASE_STATS };
  for (const id of Object.values(equipped)) {
    const part = PART_BY_ID[id];
    if (!part || !part.stats) continue;
    for (const [k, v] of Object.entries(part.stats)) s[k] += v;
  }
  return s;
}

export const AI_NAMES = ['Turbo Tom', 'Zippy Zoe', 'Max Drift', 'Lola Lightning', 'Rocket Rex',
  'Speedy Sam', 'Nitro Nina', 'Captain Skid', 'Dash Dana', 'Vroom Vic'];
