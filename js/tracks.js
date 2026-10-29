// Track registry: built-in maps, the player's own tracks from the editor, and a track
// received from an online host. Custom tracks are stored in this browser.
import * as THREE from 'three';
import { MAPS, TUNES } from './data.js';
import { checkTrack } from './trackcheck.js';
import { cleanName } from './online.js';

const KEY = 'polyrush.tracks';
let netMap = null;

const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);

// Accepts editor data or data from another player; returns a clean copy or null.
export function sanitizeTrack(t) {
  if (!t || typeof t !== 'object' || !Array.isArray(t.points)) return null;
  if (t.points.length < 4 || t.points.length > 40) return null;
  const points = [];
  for (const p of t.points) {
    if (!Array.isArray(p) || p.length !== 3) return null;
    const x = num(p[0], -300, 300);
    const y = num(p[1], 0, 30);
    const z = num(p[2], -300, 300);
    if (x === null || y === null || z === null) return null;
    points.push([Math.round(x), Math.round(y * 2) / 2, Math.round(z)]);
  }
  const idx = (list) => (Array.isArray(list) ? [...new Set(list.filter((i) => Number.isInteger(i) && i >= 0 && i < points.length))].slice(0, 6) : []);
  return {
    id: typeof t.id === 'string' && /^custom-[a-z0-9]{1,16}$/.test(t.id) ? t.id : 'custom-' + Date.now().toString(36),
    name: cleanName(t.name) || 'My Track',
    points,
    width: num(t.width, 12, 22) ?? 16,
    music: TUNES[t.music] && t.music !== 'menu' ? t.music : 'valley',
    ramps: idx(t.ramps),
    bumps: idx(t.bumps),
  };
}

export function loadCustom() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.map(sanitizeTrack).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveCustom(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// Fraction of the lap at each control point, so ramps sit exactly where they were placed.
function pointFractions(points) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
  const div = 50;
  const lengths = curve.getLengths(points.length * div);
  const total = lengths[lengths.length - 1];
  return points.map((_, k) => lengths[k * div] / total);
}

export function customToMap(t) {
  const fr = pointFractions(t.points);
  const check = checkTrack(t.points, t.width);
  return {
    id: t.id,
    name: t.name,
    custom: true,
    stars: 2,
    laps: 3,
    width: t.width,
    desc: 'A track you built in the editor.',
    terrainFollow: check.bridges === 0,
    hills: 10,
    trees: 500,
    music: t.music,
    features: { exact: true, ramps: t.ramps.map((i) => fr[i]), bumps: t.bumps.map((i) => fr[i]) },
    points: t.points,
    source: t,
  };
}

export function allMaps() {
  return [...MAPS, ...loadCustom().map(customToMap)];
}

export function setNetMap(t) {
  const clean = sanitizeTrack(t);
  netMap = clean && checkTrack(clean.points, clean.width).ok ? customToMap(clean) : null;
  return netMap;
}

export function findMap(id) {
  if (netMap && netMap.id === id) return netMap;
  return allMaps().find((m) => m.id === id) || null;
}
