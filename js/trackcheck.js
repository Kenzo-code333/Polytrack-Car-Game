// Checks a track layout before it is raced: closed, long enough, no flat self-crossings,
// and no hairpins too tight to drive. Used by the editor and for tracks shared online.
import * as THREE from 'three';

export const BRIDGE_CLEARANCE = 6;

export function sampleTrack(points, n = 400) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), true, 'centripetal');
  return { curve, pts: curve.getSpacedPoints(n).slice(0, n), length: curve.getLength() };
}

function segmentsCross(a, b, c, d) {
  const cross = (o, p, q) => (p.x - o.x) * (q.z - o.z) - (p.z - o.z) * (q.x - o.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Returns { ok, errors: [text], crossings: [{x, z, bridge}], bridges, length }.
export function checkTrack(points, width = 16) {
  const errors = [];
  if (!Array.isArray(points) || points.length < 4) {
    return { ok: false, errors: ['Add at least 4 points to make a loop.'], crossings: [], bridges: 0, length: 0 };
  }
  const { pts, length } = sampleTrack(points, 400);
  const n = pts.length;
  const crossings = [];
  let flat = 0;
  let bridges = 0;
  // Two stretches of road closer than this (and not neighbours) would overlap.
  const minGap = width + 4;
  const gapSkip = Math.ceil((minGap * 3) / (length / n));
  let tooClose = null;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = pts[j];
      const d = pts[(j + 1) % n];
      const dy = Math.abs((a.y + b.y) / 2 - (c.y + d.y) / 2);
      if (segmentsCross(a, b, c, d)) {
        const bridge = dy >= BRIDGE_CLEARANCE;
        crossings.push({ x: (a.x + c.x) / 2, z: (a.z + c.z) / 2, bridge });
        if (bridge) bridges++;
        else flat++;
        continue;
      }
      const sep = Math.min(j - i, n - (j - i));
      if (!tooClose && sep > gapSkip && dy < BRIDGE_CLEARANCE && Math.hypot(a.x - c.x, a.z - c.z) < minGap) {
        tooClose = { x: (a.x + c.x) / 2, z: (a.z + c.z) / 2 };
      }
    }
  }
  if (flat) errors.push('The road crosses itself. Raise one part at least 6 m higher to make a bridge, or move the points apart.');
  if (tooClose && !flat) {
    errors.push('Two parts of the road are too close together. Move them further apart.');
    crossings.push({ ...tooClose, bridge: false });
  }
  if (length < 350) errors.push('The track is too short. Make the loop bigger (at least 350 m).');
  // Sharpest corner: heading change over ~10 m of road.
  const step = Math.min(Math.floor(n / 4), Math.max(1, Math.round(10 / (length / n))));
  let sharp = 0;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - step + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + step) % n];
    const a1 = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    const a2 = Math.atan2(p2.x - p1.x, p2.z - p1.z);
    sharp = Math.max(sharp, Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))));
  }
  if (sharp > 1.1) errors.push('One corner is too sharp to drive. Spread the points out around it.');
  return { ok: errors.length === 0, errors, crossings, bridges, length };
}
