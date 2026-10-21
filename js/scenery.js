// Sky, lighting, terrain, water, vegetation, seasonal props and weather particles.
import * as THREE from 'three';
import { particleTexture } from './textures.js';
import { WALL_GAP } from './track.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Float32Array(512);
  for (let i = 0; i < 512; i++) perm[i] = rand();
  const h = (ix, iz) => perm[((ix * 73856093) ^ (iz * 19349663)) & 511];
  const vnoise = (x, z) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = h(ix, iz) + (h(ix + 1, iz) - h(ix, iz)) * sx;
    const b = h(ix, iz + 1) + (h(ix + 1, iz + 1) - h(ix, iz + 1)) * sx;
    return a + (b - a) * sz;
  };
  return (x, z) => vnoise(x / 90, z / 90) * 0.6 + vnoise(x / 40 + 17, z / 40 + 5) * 0.3 + vnoise(x / 15 + 3, z / 15 + 9) * 0.1;
}

const skyVert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
}`;
const skyFrag = `
uniform vec3 top;
uniform vec3 bottom;
uniform vec3 sunColor;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(bottom, top, pow(h, 0.55));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.25);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeSky(season) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(season.skyTop) },
      bottom: { value: new THREE.Color(season.skyBottom) },
      sunColor: { value: new THREE.Color(season.sun) },
      sunDir: { value: new THREE.Vector3(...season.sunDir).normalize() },
    },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat);
  sky.renderOrder = -1;
  return sky;
}

function instanced(geo, mat, items, castShadow = true) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  mesh.count = items.length;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const color = new THREE.Color();
  items.forEach((it, k) => {
    q.setFromEuler(e.set(it.rx || 0, it.ry || 0, it.rz || 0));
    m.compose(it.pos, q, it.scale);
    mesh.setMatrixAt(k, m);
    if (it.color !== undefined) mesh.setColorAt(k, color.set(it.color));
  });
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildEnvironment(scene, track, map, season, renderer) {
  const rng = mulberry32(hashStr(map.id + season.id));
  const noise = makeNoise(hashStr(map.id));
  const hw = track.width / 2;
  const group = new THREE.Group();
  scene.add(group);

  // Sky, fog and image-based lighting from the sky.
  const sky = makeSky(season);
  scene.add(sky);
  scene.fog = new THREE.Fog(season.fog, 170, 950);
  scene.background = new THREE.Color(season.fog);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(makeSky(season));
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(season.hemiSky, season.hemiGround, season.hemiIntensity);
  scene.add(hemi);
  const sunDir = new THREE.Vector3(...season.sunDir).normalize();
  const sun = new THREE.DirectionalLight(season.sun, season.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -75;
  sc.right = 75;
  sc.top = 75;
  sc.bottom = -75;
  sc.near = 1;
  sc.far = 500;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // Coarse copy of the centre line for distance queries.
  const coarse = [];
  for (let i = 0; i < track.N; i += 2) coarse.push(track.p[i]);
  const nearest = (x, z) => {
    let bd = Infinity;
    let by = 0;
    for (const q of coarse) {
      const dx = x - q.x;
      const dz = z - q.z;
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        by = q.y;
      }
    }
    return { d: Math.sqrt(bd), y: by };
  };

  // Terrain heightfield shaped around the track.
  const SIZE = 900;
  const SEG = 180;
  const cell = SIZE / SEG;
  const heights = new Float32Array((SEG + 1) * (SEG + 1));
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c0 = new THREE.Color(season.ground[0]);
  const c1 = new THREE.Color(season.ground[1]);
  const sand = new THREE.Color(season.ice ? 0xeef3f8 : 0xe6d39a);
  const rock = new THREE.Color(season.ice ? 0xffffff : season.rock);
  const col = new THREE.Color();
  const water = map.water;
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v);
    const z = pos.getZ(v);
    const { d, y } = nearest(x, z);
    const base = map.base ? map.base(x, z) : 0;
    const n = noise(x, z);
    const seaFade = base < -0.5 ? 0.12 : 1;
    const far = base + (map.terrainFollow ? y : 0) + (n - 0.3) * map.hills * smoothstep(10, 110, d) * seaFade;
    const near = (map.terrainFollow ? y : Math.min(y, 0)) - 0.45;
    const blend = smoothstep(hw + WALL_GAP + 1.5, hw + 48, d);
    const h = near + (far - near) * blend;
    heights[v] = h;
    pos.setY(v, h);
    col.copy(c0).lerp(c1, noise(x * 3.1 + 50, z * 3.1 - 20));
    if (water !== undefined && h < water + 0.9) col.lerp(sand, smoothstep(water + 0.9, water + 0.2, h));
    const rel = h - (map.terrainFollow ? y : 0);
    if (rel > 9) col.lerp(rock, smoothstep(9, 20, rel) * 0.8);
    colors.set([col.r, col.g, col.b], v * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  group.add(terrain);

  const heightAt = (x, z) => {
    const gx = Math.min(SEG - 0.001, Math.max(0, (x + SIZE / 2) / cell));
    const gz = Math.min(SEG - 0.001, Math.max(0, (z + SIZE / 2) / cell));
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const i = iz * (SEG + 1) + ix;
    const a = heights[i] + (heights[i + 1] - heights[i]) * fx;
    const b = heights[i + SEG + 1] + (heights[i + SEG + 2] - heights[i + SEG + 1]) * fx;
    return a + (b - a) * fz;
  };

  // Outer ground ring so the horizon never shows an edge.
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(SIZE * 0.5 - 2, 2200, 48, 1),
    new THREE.MeshStandardMaterial({ color: water !== undefined ? season.water : season.ground[0], roughness: 1 }),
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = water !== undefined ? water : -1;
  group.add(outer);

  if (water !== undefined) {
    const wmat = season.ice
      ? new THREE.MeshStandardMaterial({ color: season.water, roughness: 0.25, metalness: 0.1 })
      : new THREE.MeshStandardMaterial({ color: season.water, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.88 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(SIZE + 4, SIZE + 4), wmat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = water;
    sea.receiveShadow = true;
    group.add(sea);
  }

  // Distant mountains.
  const mountains = [];
  const caps = [];
  for (let k = 0; k < 46; k++) {
    const a = (k / 46) * Math.PI * 2 + rng() * 0.1;
    const r = 620 + rng() * 160;
    const h = 90 + rng() * 170;
    const w = 70 + rng() * 90;
    const p = v3(Math.cos(a) * r, -5, Math.sin(a) * r);
    mountains.push({ pos: p, scale: v3(w, h, w), ry: rng() * 3 });
    caps.push({ pos: v3(p.x, -5 + h * 0.62, p.z), scale: v3(w * 0.385, h * 0.385, w * 0.385), ry: rng() * 3 });
  }
  const mGeo = new THREE.ConeGeometry(1, 1, 7);
  mGeo.translate(0, 0.5, 0);
  const mCol = new THREE.Color(season.rock).lerp(new THREE.Color(season.fog), 0.35);
  group.add(instanced(mGeo, new THREE.MeshStandardMaterial({ color: mCol, roughness: 1, flatShading: true }), mountains, false));
  group.add(instanced(mGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), caps, false));

  // Scatter helper: random spot away from the road and above water.
  const spot = (minD, maxD) => {
    for (let tries = 0; tries < 12; tries++) {
      const x = (rng() - 0.5) * (SIZE - 60);
      const z = (rng() - 0.5) * (SIZE - 60);
      const { d } = nearest(x, z);
      if (d < minD || d > maxD) continue;
      const y = heightAt(x, z);
      if (water !== undefined && y < water + 0.7) continue;
      return v3(x, y, z);
    }
    return null;
  };
  const nearSpot = (minD, maxD) => {
    const i = Math.floor(rng() * track.N);
    const side = rng() < 0.5 ? -1 : 1;
    const dist = hw + minD + rng() * (maxD - minD);
    const p = track.p[i].clone().addScaledVector(track.r[i], side * dist);
    if (nearest(p.x, p.z).d < hw + minD) return null;
    p.y = heightAt(p.x, p.z);
    if (water !== undefined && p.y < water + 0.6) return null;
    return p;
  };

  // Trees.
  const trunks = [];
  const crowns = [];
  const pines = [];
  const pineTops = [];
  const snow = [];
  const minTree = hw + WALL_GAP + 6;
  for (let k = 0; k < map.trees; k++) {
    const p = spot(minTree, 400);
    if (!p) continue;
    const s = 0.8 + rng() * 0.9;
    const ry = rng() * Math.PI * 2;
    if (rng() < season.coniferRatio) {
      trunks.push({ pos: p, scale: v3(s, s * 2.2, s), ry });
      pines.push({ pos: v3(p.x, p.y + s * 1.6, p.z), scale: v3(s * 2.6, s * 4.6, s * 2.6), ry, color: season.conifer });
      pineTops.push({ pos: v3(p.x, p.y + s * 4.2, p.z), scale: v3(s * 1.8, s * 3.4, s * 1.8), ry, color: season.conifer });
      if (season.snowCaps) snow.push({ pos: v3(p.x, p.y + s * 5.6, p.z), scale: v3(s * 1.0, s * 1.9, s * 1.0), ry });
    } else {
      trunks.push({ pos: p, scale: v3(s, s * 2.6, s), ry });
      const leaf = season.leaves[Math.floor(rng() * season.leaves.length)];
      crowns.push({ pos: v3(p.x, p.y + s * 3.6, p.z), scale: v3(s * 2.4, s * 2.1, s * 2.4), ry, rx: rng(), color: leaf });
      if (rng() < 0.5) {
        crowns.push({ pos: v3(p.x + s * 0.9, p.y + s * 3.0, p.z - s * 0.5), scale: v3(s * 1.6, s * 1.5, s * 1.6), ry, color: leaf });
      }
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 1, 7);
  trunkGeo.translate(0, 0.5, 0);
  group.add(instanced(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }), trunks));
  const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true });
  group.add(instanced(new THREE.IcosahedronGeometry(1, 1), leafMat, crowns));
  const coneGeo = new THREE.ConeGeometry(0.5, 1, 9);
  coneGeo.translate(0, 0.5, 0);
  group.add(instanced(coneGeo, leafMat, pines));
  group.add(instanced(coneGeo, leafMat, pineTops));
  if (snow.length) group.add(instanced(coneGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), snow));

  // Rocks.
  const rocks = [];
  for (let k = 0; k < 160; k++) {
    const p = spot(hw + WALL_GAP + 3, 420);
    if (!p) continue;
    const s = 0.6 + rng() * 2.4;
    rocks.push({ pos: p, scale: v3(s * (1 + rng()), s * (0.5 + rng() * 0.6), s), ry: rng() * 6, rx: rng() });
  }
  group.add(instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: season.rock, roughness: 0.9, flatShading: true }), rocks));

  // Seasonal decorations.
  if (season.extras === 'flowers' || season.extras === 'sunflowers') {
    const palette = season.extras === 'flowers'
      ? [0xff7eb6, 0xffffff, 0xffe066, 0xb48cff, 0xff9a76]
      : [0xffd400, 0xff9f1c, 0xffffff, 0xe63946];
    const flowers = [];
    const stems = [];
    for (let k = 0; k < 1000; k++) {
      const p = nearSpot(WALL_GAP + 1.5, 45);
      if (!p) continue;
      const big = season.extras === 'sunflowers' && rng() < 0.35;
      const h = big ? 1.4 + rng() * 0.6 : 0.3 + rng() * 0.2;
      stems.push({ pos: p, scale: v3(big ? 1.5 : 1, h, big ? 1.5 : 1) });
      const s = big ? 0.42 : 0.2 + rng() * 0.12;
      flowers.push({ pos: v3(p.x, p.y + h, p.z), scale: v3(s, s * 0.6, s), color: big ? 0xffd400 : palette[Math.floor(rng() * palette.length)] });
    }
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 4);
    stemGeo.translate(0, 0.5, 0);
    group.add(instanced(stemGeo, new THREE.MeshStandardMaterial({ color: 0x3f8a2e }), stems, false));
    group.add(instanced(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), flowers, false));
  } else if (season.extras === 'pumpkins') {
    const pumpkins = [];
    const hay = [];
    for (let k = 0; k < 90; k++) {
      const p = nearSpot(WALL_GAP + 2, 30);
      if (!p) continue;
      const s = 0.5 + rng() * 0.5;
      pumpkins.push({ pos: v3(p.x, p.y + s * 0.6, p.z), scale: v3(s, s * 0.75, s), ry: rng() * 6, color: rng() < 0.85 ? 0xff8a1c : 0xf2c14e });
      if (rng() < 0.3) hay.push({ pos: v3(p.x + 2, p.y + 0.7, p.z + 1), scale: v3(1.6, 1.4, 1.6), rz: Math.PI / 2, ry: rng() * 6 });
    }
    group.add(instanced(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ roughness: 0.55 }), pumpkins));
    group.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 14), new THREE.MeshStandardMaterial({ color: 0xd9b45a, roughness: 1 }), hay));
  } else if (season.extras === 'snowmen') {
    const bottom = [];
    const middle = [];
    const head = [];
    const nose = [];
    for (let k = 0; k < 30; k++) {
      const p = nearSpot(WALL_GAP + 3, 26);
      if (!p) continue;
      const ry = rng() * 6;
      bottom.push({ pos: v3(p.x, p.y + 0.8, p.z), scale: v3(1, 1, 1) });
      middle.push({ pos: v3(p.x, p.y + 2.1, p.z), scale: v3(0.72, 0.72, 0.72) });
      head.push({ pos: v3(p.x, p.y + 3.1, p.z), scale: v3(0.5, 0.5, 0.5) });
      nose.push({ pos: v3(p.x + Math.sin(ry) * 0.5, p.y + 3.1, p.z + Math.cos(ry) * 0.5), scale: v3(0.1, 0.45, 0.1), rx: Math.PI / 2, ry });
    }
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const ball = new THREE.SphereGeometry(1, 16, 12);
    group.add(instanced(ball, snowMat, bottom), instanced(ball, snowMat, middle), instanced(ball, snowMat, head));
    group.add(instanced(new THREE.ConeGeometry(1, 1, 8), new THREE.MeshStandardMaterial({ color: 0xff7a1a }), nose, false));
  }

  // Clouds.
  const puffs = [];
  for (let k = 0; k < 34; k++) {
    const cx = (rng() - 0.5) * 1300;
    const cz = (rng() - 0.5) * 1300;
    const cy = 110 + rng() * 60;
    const n = 4 + Math.floor(rng() * 4);
    for (let j = 0; j < n; j++) {
      const s = 10 + rng() * 14;
      puffs.push({ pos: v3(cx + (j - n / 2) * 12 + rng() * 6, cy + rng() * 6, cz + rng() * 14), scale: v3(s * 1.4, s * 0.8, s) });
    }
  }
  const clouds = instanced(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35, fog: false,
  }), puffs, false);
  clouds.receiveShadow = false;
  group.add(clouds);

  // Weather particles that follow the camera.
  const pc = season.particles;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pc.count * 3);
  const pCol = new Float32Array(pc.count * 3);
  const phase = new Float32Array(pc.count);
  const BOX = 70;
  for (let k = 0; k < pc.count; k++) {
    pPos.set([(rng() - 0.5) * BOX * 2, rng() * 50, (rng() - 0.5) * BOX * 2], k * 3);
    col.set(pc.colors[k % pc.colors.length]);
    pCol.set([col.r, col.g, col.b], k * 3);
    phase[k] = rng() * 100;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: pc.size, map: particleTexture(pc.kind), vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.05,
  }));
  particles.frustumCulled = false;
  scene.add(particles);
  let initialised = false;

  return {
    sun,
    heightAt,
    dispose() {
      envRT.dispose();
    },
    update(dt, camera, time, focus) {
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(sunDir, 220);
      clouds.rotation.y += dt * 0.002;
      sky.position.copy(camera.position);

      const cp = camera.position;
      if (!initialised) {
        for (let k = 0; k < pc.count; k++) {
          pPos[k * 3] += cp.x;
          pPos[k * 3 + 1] += cp.y - 10;
          pPos[k * 3 + 2] += cp.z;
        }
        initialised = true;
      }
      for (let k = 0; k < pc.count; k++) {
        const i = k * 3;
        const ph = phase[k];
        pPos[i] += Math.sin(time * 0.7 + ph) * pc.drift * dt;
        pPos[i + 1] -= pc.fall * (0.6 + (ph % 1)) * dt + (pc.kind === 'pollen' ? Math.sin(time + ph) * 0.3 * dt : 0);
        pPos[i + 2] += Math.cos(time * 0.5 + ph) * pc.drift * 0.6 * dt;
        if (pPos[i + 1] < cp.y - 12) pPos[i + 1] += 50;
        if (pPos[i + 1] > cp.y + 38) pPos[i + 1] -= 50;
        if (pPos[i] - cp.x > BOX) pPos[i] -= BOX * 2;
        if (pPos[i] - cp.x < -BOX) pPos[i] += BOX * 2;
        if (pPos[i + 2] - cp.z > BOX) pPos[i + 2] -= BOX * 2;
        if (pPos[i + 2] - cp.z < -BOX) pPos[i + 2] += BOX * 2;
      }
      pGeo.attributes.position.needsUpdate = true;
    },
  };
}
