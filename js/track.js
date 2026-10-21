// Track spline, spatial queries and track meshes (road, curbs, walls, start gantry, pillars).
import * as THREE from 'three';
import { asphaltTexture, curbTexture, wallTexture, checkerTexture, rampTexture } from './textures.js';

export const WALL_GAP = 1.1; // distance from road edge to the barrier

export class Track {
  constructor(map) {
    this.map = map;
    this.width = map.width;
    const pts = map.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.length = this.curve.getLength();
    const N = (this.N = Math.max(240, Math.round(this.length / 1.5)));
    this.spacing = this.length / N;
    this.p = this.curve.getSpacedPoints(N).slice(0, N);
    this.t = [];
    this.r = [];
    for (let i = 0; i < N; i++) {
      const t = this.p[(i + 1) % N].clone().sub(this.p[(i - 1 + N) % N]).normalize();
      this.t.push(t);
      this.r.push(new THREE.Vector3(-t.z, 0, t.x).normalize());
    }
    // Horizontal curvature (radians turned over ~12 m), used by the AI and for pad placement.
    const span = Math.max(2, Math.round(6 / this.spacing));
    this.curv = [];
    for (let i = 0; i < N; i++) {
      const a = this.t[this.wrap(i - span)];
      const b = this.t[this.wrap(i + span)];
      const ang = Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z);
      this.curv.push(ang);
    }
    this.addFeatures(map.features || {});
  }

  // Jump ramps and bump strips, carved into the road height on the straightest stretches.
  addFeatures(feat) {
    const N = this.N;
    const sp = this.spacing;
    // How bendy the road is from `back` metres before i to `ahead` metres after it.
    const bendiness = (i, back, ahead) => {
      let s = 0;
      for (let k = -Math.round(back / sp); k <= Math.round(ahead / sp); k++) s += Math.abs(this.curv[this.wrap(i + k)]);
      return s;
    };
    const spot = (frac, back, ahead) => {
      let best = Math.floor(frac * N);
      let bestScore = Infinity;
      for (let i = Math.floor((frac - 0.05) * N); i <= (frac + 0.05) * N; i++) {
        const score = bendiness(i, back, ahead);
        if (score < bestScore) {
          bestScore = score;
          best = this.wrap(i);
        }
      }
      return best;
    };
    const lift = new Float32Array(N);
    this.ramps = [];
    this.bumps = [];
    const rampLen = Math.round(16 / sp);
    for (const frac of feat.ramps || []) {
      const i0 = spot(frac, 10, 75);
      for (let k = 0; k <= rampLen; k++) lift[this.wrap(i0 + k)] = Math.max(lift[this.wrap(i0 + k)], 2.2 * (k / rampLen) ** 1.5);
      lift[this.wrap(i0 + rampLen + 1)] = Math.max(lift[this.wrap(i0 + rampLen + 1)], 0.6);
      this.ramps.push({ start: i0, end: this.wrap(i0 + rampLen) });
    }
    const bumpLen = Math.round(36 / sp);
    for (const frac of feat.bumps || []) {
      const i0 = spot(frac, 5, 40);
      for (let k = 0; k <= bumpLen; k++) {
        const h = 0.15 * (1 - Math.cos((2 * Math.PI * k * sp) / 9));
        lift[this.wrap(i0 + k)] = Math.max(lift[this.wrap(i0 + k)], h);
      }
      this.bumps.push({ start: i0, end: this.wrap(i0 + bumpLen) });
    }
    for (let i = 0; i < N; i++) this.p[i].y += lift[i];
    // Tangents now include the new slopes; the horizontal frame is unchanged.
    for (let i = 0; i < N; i++) this.t[i].copy(this.p[(i + 1) % N]).sub(this.p[(i - 1 + N) % N]).normalize();
  }

  wrap(i) {
    const N = this.N;
    return ((i % N) + N) % N;
  }

  // Interpolated frame at a fractional sample index.
  frameAt(f, out = {}) {
    const i = Math.floor(f);
    const a = this.wrap(i);
    const b = this.wrap(i + 1);
    const t = f - i;
    out.point = (out.point || new THREE.Vector3()).lerpVectors(this.p[a], this.p[b], t);
    out.tangent = (out.tangent || new THREE.Vector3()).lerpVectors(this.t[a], this.t[b], t).normalize();
    out.right = (out.right || new THREE.Vector3()).set(-out.tangent.z, 0, out.tangent.x).normalize();
    return out;
  }

  // Position at fractional index offset sideways by `lat`, lifted by `up`.
  pointAt(f, lat = 0, up = 0, out = new THREE.Vector3()) {
    const fr = this.frameAt(f, {});
    return out.copy(fr.point).addScaledVector(fr.right, lat).setY(fr.point.y + up);
  }

  // Projects a world position on the track. `hint` limits the search to nearby samples, which
  // keeps the answer stable where the track crosses itself (bridge map).
  project(pos, hint = -1, out = {}) {
    const N = this.N;
    let best = 0;
    let bd = Infinity;
    const scan = (i) => {
      const q = this.p[i];
      const dx = pos.x - q.x;
      const dy = pos.y - q.y;
      const dz = pos.z - q.z;
      const d = dx * dx + dz * dz + dy * dy * 4;
      if (d < bd) {
        bd = d;
        best = i;
      }
    };
    if (hint < 0) for (let i = 0; i < N; i++) scan(i);
    else for (let k = -30; k <= 30; k++) scan(this.wrap(hint + k));

    const segT = (a, b) => {
      const pa = this.p[a];
      const pb = this.p[b];
      const dx = pb.x - pa.x;
      const dz = pb.z - pa.z;
      const t = ((pos.x - pa.x) * dx + (pos.z - pa.z) * dz) / (dx * dx + dz * dz || 1);
      return t;
    };
    const next = this.wrap(best + 1);
    const prev = this.wrap(best - 1);
    let start;
    let t = segT(best, next);
    if (t >= 0) {
      start = best;
    } else {
      start = prev;
      t = segT(prev, best);
    }
    t = Math.min(1, Math.max(0, t));
    out.i = start;
    out.f = start + t;
    this.frameAt(out.f, out);
    out.lateral = (pos.x - out.point.x) * out.right.x + (pos.z - out.point.z) * out.right.z;
    return out;
  }

  // Signed distance (in samples) from a to b going forward, in (-N/2, N/2].
  deltaIdx(a, b) {
    let d = b - a;
    const N = this.N;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    return d;
  }
}

// A strip running along the whole track between two (lateral, height) edges.
function ribbon(track, a, b, vScale, extraUp = null, from = 0, count = track.N) {
  const N = count;
  const pos = new Float32Array((N + 1) * 2 * 3);
  const uv = new Float32Array((N + 1) * 2 * 2);
  const idx = [];
  let dist = 0;
  for (let k = 0; k <= N; k++) {
    const i = (from + k) % track.N;
    if (k > 0) dist += track.p[i].distanceTo(track.p[(from + k - 1) % track.N]);
    const p = track.p[i];
    const r = track.r[i];
    const up = extraUp ? extraUp(i) : 0;
    pos.set([p.x + r.x * a.lat, p.y + a.dy + (a.useUp ? up : 0), p.z + r.z * a.lat], k * 6);
    pos.set([p.x + r.x * b.lat, p.y + b.dy + (b.useUp ? up : 0), p.z + r.z * b.lat], k * 6 + 3);
    uv.set([0, dist / vScale, 1, dist / vScale], k * 4);
    if (k < N) {
      const v = k * 2;
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildTrackMeshes(track, season, heightAt) {
  const group = new THREE.Group();
  const W = track.width;
  const hw = W / 2;

  const road = new THREE.Mesh(
    ribbon(track, { lat: -hw, dy: 0.04 }, { lat: hw, dy: 0.04 }, 9),
    new THREE.MeshStandardMaterial({
      map: asphaltTexture(season.ice),
      roughness: season.ice ? 0.35 : 0.85,
      metalness: season.ice ? 0.15 : 0.0,
    }),
  );
  road.receiveShadow = true;
  group.add(road);

  // Yellow chevrons on every ramp.
  const rampMat = new THREE.MeshStandardMaterial({ map: rampTexture(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const r of track.ramps) {
    const count = track.wrap(r.end - r.start) + 1;
    const m = new THREE.Mesh(ribbon(track, { lat: -hw + 0.6, dy: 0.06 }, { lat: hw - 0.6, dy: 0.06 }, hw * 2 - 1.2, null, r.start, count), rampMat);
    m.receiveShadow = true;
    group.add(m);
  }

  const curbMat = new THREE.MeshStandardMaterial({ map: curbTexture(), roughness: 0.6 });
  for (const s of [-1, 1]) {
    const a = { lat: s * (hw - 0.15), dy: 0.06 };
    const b = { lat: s * (hw + WALL_GAP), dy: 0.06 };
    const curb = new THREE.Mesh(ribbon(track, s < 0 ? b : a, s < 0 ? a : b, 3), curbMat);
    curb.receiveShadow = true;
    group.add(curb);
  }

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(season.wall), roughness: 0.5, side: THREE.DoubleSide });
  const capMat = new THREE.MeshStandardMaterial({ color: season.snowCaps ? 0xffffff : 0xdedede, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const lat = s * (hw + WALL_GAP);
    const wall = new THREE.Mesh(ribbon(track, { lat, dy: -1.6 }, { lat, dy: 0.9 }, 6), wallMat);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    const cap = new THREE.Mesh(ribbon(track, { lat: lat - 0.18, dy: 0.92 }, { lat: lat + 0.18, dy: 0.92 }, 6), capMat);
    group.add(cap);
  }
  // Underside of the deck, visible on bridges.
  const under = new THREE.Mesh(
    ribbon(track, { lat: hw + WALL_GAP, dy: -1.6 }, { lat: -hw - WALL_GAP, dy: -1.6 }, 10),
    new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.9 }),
  );
  group.add(under);

  // Support pillars wherever the road floats above the ground.
  const pillarSpots = [];
  const step = Math.max(6, Math.round(14 / track.spacing));
  for (let i = 0; i < track.N; i += step) {
    const p = track.p[i];
    const g = heightAt(p.x, p.z);
    if (p.y - g > 2.2) pillarSpots.push({ p, g });
  }
  if (pillarSpots.length) {
    const geo = new THREE.CylinderGeometry(1.1, 1.4, 1, 16);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.7 }), pillarSpots.length);
    const m = new THREE.Matrix4();
    pillarSpots.forEach(({ p, g }, k) => {
      const h = p.y - 1.6 - g + 0.5;
      m.makeScale(1, h, 1).setPosition(p.x, g - 0.5, p.z);
      mesh.setMatrixAt(k, m);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Start / finish line and gantry.
  const f0 = track.frameAt(0);
  const yaw = Math.atan2(f0.tangent.x, f0.tangent.z);
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(W, 2.4),
    new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.7 }),
  );
  line.rotation.set(-Math.PI / 2, yaw, 0, 'YXZ');
  line.position.copy(f0.point).setY(f0.point.y + 0.07);
  line.receiveShadow = true;
  group.add(line);

  const gantry = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x30343c, roughness: 0.4, metalness: 0.6 });
  const span = W + WALL_GAP * 2 + 1.2;
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 8, 0.7), postMat);
    post.position.set((s * span) / 2, 4, 0);
    post.castShadow = true;
    gantry.add(post);
  }
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(span + 0.7, 1.6, 0.6),
    [postMat, postMat, postMat, postMat,
      new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.5 })],
  );
  beam.position.y = 7.6;
  beam.castShadow = true;
  gantry.add(beam);
  gantry.position.copy(f0.point);
  gantry.rotation.y = yaw;
  group.add(gantry);

  return group;
}
