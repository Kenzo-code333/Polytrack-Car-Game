// A single race: world, racers, pickups, power-ups, laps, camera.
import * as THREE from 'three';
import { Track, buildTrackMeshes } from './track.js';
import { buildEnvironment } from './scenery.js';
import { Car, setGhost } from './car.js';
import { Particles } from './effects.js';
import { aiDrive, makeAI } from './ai.js';
import { input } from './input.js';
import { PARTS, PART_BY_ID, CATEGORIES, AI_NAMES, BASE_STATS, DEFAULT_EQUIPPED } from './data.js';
import { cleanName } from './online.js';
import { boostPadTexture, itemBoxTexture } from './textures.js';

const RACERS = 6;
const PLAYER_SLOT = 4;
const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Only accept known part ids from other players.
function safeLook(eq) {
  const out = { ...DEFAULT_EQUIPPED };
  if (eq && typeof eq === 'object') {
    for (const c of CATEGORIES) {
      const p = PART_BY_ID[eq[c.id]];
      if (p && p.cat === c.id) out[c.id] = p.id;
    }
  }
  return out;
}

function nameTag(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 34px Trebuchet MS, sans-serif';
  const w = Math.min(248, ctx.measureText(text).width + 28);
  ctx.fillStyle = 'rgba(10,14,30,0.7)';
  ctx.beginPath();
  ctx.roundRect((256 - w) / 2, 8, w, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#ffd400';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33, 230);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(4, 1, 1);
  s.position.y = 2.9;
  return s;
}

const finite = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

function randomLook() {
  const eq = {};
  for (const c of CATEGORIES) {
    const options = PARTS.filter((p) => p.cat === c.id && !p.chest && p.id !== 'body_hyper');
    eq[c.id] = pick(options).id;
  }
  if (Math.random() < 0.7) eq.topper = 'top_none';
  if (Math.random() < 0.5) eq.underglow = 'glow_none';
  return eq;
}

export class Race {
  constructor(renderer, opts) {
    this.renderer = renderer;
    this.opts = opts;
    this.map = opts.map;
    this.season = opts.season;
    this.diff = opts.difficulty;
    this.laps = opts.laps;
    this.audio = opts.audio;
    this.hud = opts.hud;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 2600);
    this.track = new Track(this.map);
    this.env = buildEnvironment(this.scene, this.track, this.map, this.season, renderer);
    this.scene.add(buildTrackMeshes(this.track, this.season, this.env.heightAt));
    this.particles = new Particles(this.scene);

    this.time = 0;
    this.raceTime = 0;
    this.countdown = 3.999;
    this.lastCount = 4;
    this.started = false;
    this.paused = false;
    this.finished = false;
    this.ended = false;
    this.slicks = [];
    this.projectiles = [];
    this.coinsCollected = 0;
    this.finishOrder = [];
    this.wrongTimer = 0;
    this.steer = 0;
    // Online state.
    this.net = opts.net || null;
    this.remotes = new Map();
    this.netHits = [];
    this.netOil = [];
    this.netUsed = [];
    this.seenHits = new Set();
    this.remoteSlicks = new Map();

    this.buildRacers();
    this.buildPickups();
    this.camMode = 0;
    this.camYaw = this.player.car.heading;
    this.updateCamera(1, true);
    this.hud.setupRace(this);
    this.audio.engineStart();
  }

  // ---------- setup ----------

  buildRacers() {
    const tr = this.track;
    const names = [...AI_NAMES].sort(() => Math.random() - 0.5);
    this.racers = [];
    const net = this.opts.net;
    const mySlot = net ? Math.max(0, net.grid.indexOf(net.myPeer)) : PLAYER_SLOT;
    for (let k = 0; k < (net ? 1 : RACERS); k++) {
      const slot = net ? mySlot : k;
      const { f, lat } = this.gridSpot(slot);
      const isPlayer = slot === mySlot;
      const equipped = isPlayer ? this.opts.equipped : randomLook();
      const car = new Car(equipped, tr, { number: isPlayer ? 1 : slot + 2 });
      if (!isPlayer) {
        const d = this.diff;
        const r = 0.96 + Math.random() * 0.08;
        car.stats = {
          ...BASE_STATS,
          speed: BASE_STATS.speed * d.speed * r + (d.id === 'hard' ? 3 : 0),
          accel: BASE_STATS.accel * (0.85 + d.skill * 0.25),
          turn: 2.5,
          grip: BASE_STATS.grip + 1.5,
          nitro: 1,
          winter: 0.2,
        };
      }
      car.placeAt(f, lat);
      car.syncVisual(0, 0);
      this.scene.add(car.model.root);
      const racer = this.newRacer(car, {
        name: isPlayer ? 'You' : names[slot % names.length],
        isPlayer,
        ai: isPlayer ? null : makeAI(this.diff.skill * (0.92 + Math.random() * 0.08), lat),
        position: slot + 1,
      });
      this.racers.push(racer);
      if (isPlayer) this.player = racer;
    }
  }

  gridSpot(slot) {
    const row = Math.floor(slot / 2);
    return { f: this.track.N - (7 + row * 8) / this.track.spacing, lat: slot % 2 ? 3.6 : -3.6 };
  }

  newRacer(car, props) {
    const racer = {
      name: 'Racer',
      isPlayer: false,
      remote: false,
      car,
      ai: null,
      item: null,
        lap: -1,
        maxLap: -1,
        halfway: true,
        prevF: car.proj.f,
        progress: 0,
      position: 1,
      finished: false,
      finishTime: 0,
      lastLapStart: 0,
      lapTimes: [],
      bestLap: Infinity,
      effects: { boost: 0, shield: 0, magnet: 0, mud: 0, spin: 0, ghost: 0, stun: 0 },
      ...props,
    };
    racer.progress = racer.lap * this.track.N + car.proj.f;
    return racer;
  }

  // ---------- online ----------

  syncRemotes() {
    const net = this.net;
    const seen = new Set();
    for (const p of net.online.players()) {
      if (p.sameTab) continue;
      const pr = p.presence;
      if (pr.raceId !== net.raceId || !pr.st || typeof pr.st !== 'object') continue;
      seen.add(p.peer);
      const r = this.remotes.get(p.peer) || this.addRemote(p);
      if (pr !== r.lastPresence) {
        r.lastPresence = pr;
        this.applyRemoteState(r, pr);
      }
    }
    for (const [peer, r] of this.remotes) {
      if (seen.has(peer)) continue;
      this.scene.remove(r.car.model.root);
      r.tag.material.map.dispose();
      this.racers.splice(this.racers.indexOf(r), 1);
      this.remotes.delete(peer);
    }
  }

  addRemote(p) {
    const car = new Car(safeLook(p.presence.eq), this.track, { number: 2 + this.remotes.size });
    const st = p.presence.st;
    car.pos.set(finite(st.x), finite(st.y), finite(st.z));
    car.heading = finite(st.h);
    car.hint = -1;
    car.track.project(car.pos, -1, car.proj);
    car.hint = car.proj.i;
    const name = cleanName(p.presence.name) || 'Friend';
    const tag = nameTag(name);
    car.model.root.add(tag);
    this.scene.add(car.model.root);
    const r = this.newRacer(car, { name, remote: true, peer: p.peer, tag });
    // Hits a player made before we saw them are old news.
    for (const h of Array.isArray(p.presence.hits) ? p.presence.hits : []) this.seenHits.add(p.peer + ':' + h.id);
    this.racers.push(r);
    this.remotes.set(p.peer, r);
    return r;
  }

  applyRemoteState(r, pr) {
    const st = pr.st;
    r.net = {
      x: finite(st.x), y: finite(st.y), z: finite(st.z), vx: finite(st.vx), vz: finite(st.vz),
      h: finite(st.h), recv: performance.now(),
    };
    r.car.speed = finite(st.s);
    r.lap = Math.round(finite(st.l, -1));
    r.progress = finite(st.g);
    r.finished = !!st.fin;
    r.finishTime = finite(st.ft);
    r.effects.boost = st.b ? 1 : 0;
    r.effects.shield = st.sh ? 1 : 0;
    r.effects.mud = st.m ? 1 : 0;
    r.effects.ghost = st.gh ? 1 : 0;
  }

  // Smoothly chase the latest reported position, extrapolated by its velocity.
  updateRemote(r, dt) {
    const n = r.net;
    if (!n) return;
    const car = r.car;
    const age = Math.min(0.3, (performance.now() - n.recv) / 1000);
    tmp.set(n.x + n.vx * age, n.y, n.z + n.vz * age);
    if (car.pos.distanceToSquared(tmp) > 30 * 30) car.pos.copy(tmp);
    else car.pos.lerp(tmp, 1 - Math.exp(-dt * 14));
    car.heading += wrapAngle(n.h - car.heading) * (1 - Math.exp(-dt * 14));
    car.vel.set(n.vx, 0, n.vz);
    this.track.project(car.pos, car.hint, car.proj);
    car.hint = car.proj.i;
    car.pos.y = Math.max(car.proj.point.y, car.pos.y);
    car.lateral = car.proj.lateral;
  }

  netReceive() {
    const myPeer = this.net.myPeer;
    const live = new Set();
    const used = new Set(this.netUsed);
    for (const r of this.remotes.values()) {
      const pr = r.lastPresence;
      if (!pr) continue;
      for (const id of Array.isArray(pr.used) ? pr.used : []) used.add(String(id));
    }
    for (const r of this.remotes.values()) {
      const pr = r.lastPresence;
      if (!pr) continue;
      // Mud and oil hits other players say they landed.
      for (const h of Array.isArray(pr.hits) ? pr.hits : []) {
        if (!h || typeof h !== 'object') continue;
        const key = r.peer + ':' + h.id;
        if (this.seenHits.has(key)) continue;
        this.seenHits.add(key);
        if (h.to === myPeer) {
          this.hit(this.player, ['mud', 'oil', 'rocket', 'zap', 'shock'].includes(h.k) ? h.k : 'mud', r);
        } else {
          const target = this.remotes.get(h.to);
          if (target && h.k === 'mud') {
            this.particles.burst(tmp.copy(target.car.pos).add(UP), 20, { color: 0x5a3b1e, size: 0.8, life: 0.7, gravity: 14, opacity: 1 }, 10);
          }
        }
      }
      // Oil slicks other players dropped.
      for (const o of Array.isArray(pr.oil) ? pr.oil.slice(0, 6) : []) {
        if (!o || typeof o !== 'object') continue;
        const id = String(o.id);
        if (used.has(id)) continue;
        live.add(id);
        let s = this.remoteSlicks.get(id);
        if (!s) {
          const mesh = new THREE.Mesh(this.oilGeo, this.oilMat);
          mesh.position.set(finite(o.x), finite(o.y), finite(o.z));
          this.scene.add(mesh);
          s = { id, mesh, pos: mesh.position, owner: r };
          this.remoteSlicks.set(id, s);
        }
        const c = this.player.car.pos;
        if (this.started && Math.abs(c.y - s.pos.y) < 2 && (c.x - s.pos.x) ** 2 + (c.z - s.pos.z) ** 2 < 2.5 * 2.5) {
          this.hit(this.player, 'oil', r);
          this.netUsed.push(id);
          if (this.netUsed.length > 12) this.netUsed.shift();
          live.delete(id);
        }
      }
    }
    for (const [id, s] of this.remoteSlicks) {
      if (live.has(id)) continue;
      this.scene.remove(s.mesh);
      this.remoteSlicks.delete(id);
    }
    // Our own slicks that someone else drove over.
    for (let i = this.slicks.length - 1; i >= 0; i--) {
      const s = this.slicks[i];
      if (s.id && used.has(s.id)) {
        this.scene.remove(s.mesh);
        this.slicks.splice(i, 1);
      }
    }
    this.netOil = this.slicks.filter((s) => s.owner === this.player && s.id)
      .map((s) => ({ id: s.id, x: +s.pos.x.toFixed(2), y: +s.pos.y.toFixed(2), z: +s.pos.z.toFixed(2) }));
  }

  netPublish() {
    const p = this.player;
    const c = p.car;
    const e = p.effects;
    const r2 = (v) => Math.round(v * 100) / 100;
    this.net.online.set({
      raceId: this.net.raceId,
      st: {
        x: r2(c.pos.x), y: r2(c.pos.y), z: r2(c.pos.z), vx: r2(c.vel.x), vz: r2(c.vel.z),
        h: r2(c.heading), s: r2(c.speed), l: p.lap, g: r2(p.progress),
        fin: p.finished, ft: r2(p.finishTime), b: e.boost > 0 ? 1 : 0, sh: e.shield > 0 ? 1 : 0, m: e.mud > 0 ? 1 : 0, gh: e.ghost > 0 ? 1 : 0,
      },
      hits: this.netHits,
      oil: this.netOil,
      used: this.netUsed,
    });
  }

  buildPickups() {
    const tr = this.track;
    const N = tr.N;
    const sp = tr.spacing;
    const W = tr.width;
    const group = new THREE.Group();
    this.scene.add(group);

    // Boost pads on the straightest bit near each target spot.
    this.pads = [];
    const padTex = boostPadTexture();
    const padMat = new THREE.MeshStandardMaterial({
      map: padTex, emissive: 0xffffff, emissiveMap: padTex, emissiveIntensity: 0.9, roughness: 0.3, transparent: true, opacity: 0.95,
    });
    const padGeo = new THREE.PlaneGeometry(4.6, 9);
    padGeo.rotateX(-Math.PI / 2);
    padGeo.rotateY(Math.PI);
    [0.13, 0.38, 0.63, 0.87].forEach((frac, k) => {
      let best = Math.floor(frac * N);
      for (let i = Math.floor((frac - 0.06) * N); i < (frac + 0.06) * N; i++) {
        if (Math.abs(tr.curv[tr.wrap(i)]) < Math.abs(tr.curv[tr.wrap(best)])) best = tr.wrap(i);
      }
      const lat = (k % 2 ? 1 : -1) * W * 0.2;
      const fr = tr.frameAt(best);
      const mesh = new THREE.Mesh(padGeo, padMat);
      mesh.position.copy(fr.point).addScaledVector(fr.right, lat).setY(fr.point.y + 0.09);
      mesh.rotation.y = Math.atan2(fr.tangent.x, fr.tangent.z);
      mesh.receiveShadow = true;
      group.add(mesh);
      this.pads.push({ f: best, lat, half: 4.5 / sp });
    });

    // Item box rows.
    this.boxes = [];
    const boxTex = itemBoxTexture();
    const boxMat = new THREE.MeshStandardMaterial({
      map: boxTex, emissive: 0xffffff, emissiveMap: boxTex, emissiveIntensity: 0.5, transparent: true, opacity: 0.9, roughness: 0.2,
    });
    const boxGeo = new THREE.BoxGeometry(1.7, 1.7, 1.7);
    this.boxRows = [0.22, 0.5, 0.76, 0.95].map((f) => Math.floor(f * N));
    for (const f of this.boxRows) {
      for (const k of [-1.5, -0.5, 0.5, 1.5]) {
        const mesh = new THREE.Mesh(boxGeo, boxMat);
        const pos = tr.pointAt(f, k * (W / 4.4), 1.5);
        mesh.position.copy(pos);
        mesh.castShadow = true;
        group.add(mesh);
        this.boxes.push({ mesh, pos, active: true, timer: 0, phase: Math.random() * 6 });
      }
    }

    // Coin trails.
    this.coins = [];
    const near = (f) => this.boxRows.some((r) => Math.abs(tr.deltaIdx(r, f)) < 8 / sp)
      || this.pads.some((p) => Math.abs(tr.deltaIdx(p.f, f)) < 8 / sp);
    const every = Math.round(48 / sp);
    for (let g = Math.round(28 / sp); g < N - Math.round(20 / sp); g += every) {
      const pattern = Math.floor(Math.random() * 3);
      const baseLat = pick([-W * 0.3, 0, W * 0.3]);
      const side = Math.random() < 0.5 ? -1 : 1;
      for (let k = 0; k < 5; k++) {
        const f = g + k * Math.round(3.2 / sp);
        if (near(f)) continue;
        let lat = baseLat;
        if (pattern === 1) lat = (k % 2 ? 1 : -1) * W * 0.18;
        if (pattern === 2) lat = side * Math.sin((k / 4) * Math.PI) * W * 0.32;
        this.coins.push({ pos: tr.pointAt(f, lat, 1.1), taken: false, fly: false, phase: k * 0.4 });
      }
    }
    const coinGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.14, 28);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.55, roughness: 0.25, emissive: 0xffa800, emissiveIntensity: 0.45 });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, this.coins.length);
    this.coinMesh.castShadow = true;
    this.coinMesh.frustumCulled = false;
    group.add(this.coinMesh);
    this.coinMatrix = new THREE.Matrix4();
    this.coinQuat = new THREE.Quaternion();
    this.coinScale = new THREE.Vector3(1, 1, 1);
    this.zeroScale = new THREE.Vector3(0, 0, 0);

    this.mudGeo = new THREE.SphereGeometry(0.6, 14, 10);
    this.mudMat = new THREE.MeshStandardMaterial({ color: 0x5a3b1e, roughness: 1 });
    this.rocketGeo = new THREE.ConeGeometry(0.35, 1.4, 12);
    this.rocketGeo.rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0x551100, metalness: 0.4, roughness: 0.3 });
    this.oilGeo = new THREE.CircleGeometry(2.4, 28);
    this.oilGeo.rotateX(-Math.PI / 2);
    this.oilMat = new THREE.MeshStandardMaterial({ color: 0x0d0c12, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.92 });
  }

  // ---------- power-ups ----------

  rollItem(racer) {
    // t: 0 for the leader, 1 for last place. Catch-up items show up more at the back.
    const t = (racer.position - 1) / Math.max(1, this.racers.length - 1);
    const table = [
      ['boost', 14 + 18 * t],
      ['triple', 2 + 14 * t],
      ['mud', 20],
      ['rocket', 6 + 10 * t],
      ['zap', 18 * t * t],
      ['shield', 18 - 8 * t],
      ['ghost', 8],
      ['oil', 18 - 12 * t],
      ['shock', 10],
      ['warp', 1 + 10 * t],
    ];
    if (racer.isPlayer) table.push(['magnet', 12]);
    let r = Math.random() * table.reduce((s, e) => s + e[1], 0);
    for (const [id, w] of table) {
      r -= w;
      if (r <= 0) return id;
    }
    return 'boost';
  }

  giveItem(racer, id) {
    racer.item = id;
    racer.itemUses = id === 'triple' ? 3 : 1;
    if (racer.isPlayer) this.hud.setItem(id, racer.itemUses);
  }

  // Nearest rival ahead, or the closest one when you lead.
  targetAhead(racer) {
    const others = this.racers.filter((o) => o !== racer);
    const ahead = others.filter((o) => o.progress > racer.progress).sort((a, b) => a.progress - b.progress)[0];
    return ahead || others.sort((a, b) => Math.abs(a.progress - racer.progress) - Math.abs(b.progress - racer.progress))[0];
  }

  launch(racer, kind) {
    const target = this.targetAhead(racer);
    if (!target) return;
    const car = racer.car;
    const mesh = new THREE.Mesh(kind === 'rocket' ? this.rocketGeo : this.mudGeo, kind === 'rocket' ? this.rocketMat : this.mudMat);
    mesh.position.copy(car.pos).add(tmp.set(0, 1.8, 0));
    this.scene.add(mesh);
    const vel = new THREE.Vector3(Math.sin(car.heading) * 40, 10, Math.cos(car.heading) * 40).add(car.vel);
    this.projectiles.push({ mesh, vel, target, owner: racer, life: 5, kind });
    if (racer.isPlayer || target.isPlayer) this.audio.play('throw');
  }

  useItem(racer) {
    const it = racer.item;
    if (!it || !this.started) return;
    racer.itemUses = (racer.itemUses || 1) - 1;
    if (racer.itemUses <= 0) racer.item = null;
    const car = racer.car;
    const e = racer.effects;
    const me = racer.isPlayer;
    if (it === 'boost' || it === 'triple') {
      e.boost = Math.max(e.boost, (it === 'triple' ? 1.6 : 2.2) * car.stats.nitro);
      if (me) this.audio.play('boost');
    } else if (it === 'shield') {
      e.shield = 7;
      if (me) this.audio.play('shield');
    } else if (it === 'magnet') {
      e.magnet = 9;
      if (me) this.audio.play('item');
    } else if (it === 'ghost') {
      e.ghost = 5;
      if (me) {
        this.audio.play('shield');
        this.hud.message('👻 Ghost mode! Nothing can touch you.', 1.4);
      }
    } else if (it === 'oil') {
      const f = car.proj.f - 4.5 / this.track.spacing;
      const lat = Math.max(-this.track.width / 2 + 2, Math.min(this.track.width / 2 - 2, car.lateral));
      const pos = this.track.pointAt(f, lat, 0.08);
      const mesh = new THREE.Mesh(this.oilGeo, this.oilMat);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.slicks.push({ id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, mesh, pos, f: this.track.wrap(f), lat, owner: racer, grace: 1.2, life: 25 });
      if (me) this.audio.play('oil');
    } else if (it === 'mud' || it === 'rocket') {
      this.launch(racer, it);
    } else if (it === 'zap') {
      // Lightning strikes every rival ahead of you.
      const victims = this.racers.filter((o) => o !== racer && !o.finished && o.progress > racer.progress);
      for (const v of victims) this.hit(v, 'zap', racer);
      this.audio.play('zap');
      if (me) this.hud.message(victims.length ? `⚡ Zapped ${victims.length} racer${victims.length > 1 ? 's' : ''} ahead!` : '⚡ Nobody ahead to zap!', 1.5);
    } else if (it === 'shock') {
      // A blast that shoves nearby cars away.
      let n = 0;
      for (const o of this.racers) {
        if (o === racer || o.car.pos.distanceTo(car.pos) > 16) continue;
        this.hit(o, 'shock', racer);
        n++;
      }
      this.particles.burst(tmp.copy(car.pos).add(UP), 30, { color: 0xffa040, size: 1.2, life: 0.5, additive: true, grow: 3 }, 18);
      if (me || n) this.audio.play('mud');
      if (me) this.hud.message(n ? `💥 Shockwave hit ${n} car${n > 1 ? 's' : ''}!` : '💥 Shockwave!', 1.3);
    } else if (it === 'warp') {
      // Jump 45 m up the road, keeping your speed.
      this.particles.burst(tmp.copy(car.pos).add(UP), 20, { color: 0xb070ff, size: 0.8, life: 0.5, additive: true }, 8);
      const speed = Math.max(car.speed, 20);
      const lat = Math.max(-this.track.width / 2 + 2, Math.min(this.track.width / 2 - 2, car.lateral));
      car.placeAt(car.proj.f + 45 / this.track.spacing, lat);
      car.vel.set(Math.sin(car.heading) * speed, 0, Math.cos(car.heading) * speed);
      this.particles.burst(tmp.copy(car.pos).add(UP), 20, { color: 0xb070ff, size: 0.8, life: 0.5, additive: true }, 8);
      if (me) this.audio.play('boost');
    }
    if (me) this.hud.setItem(racer.item, racer.itemUses);
  }

  hit(racer, kind, from) {
    const e = racer.effects;
    const pos = racer.car.pos;
    const byMe = from && from.isPlayer;
    if (racer.remote) {
      this.netHits.push({ id: Date.now().toString(36) + Math.floor(Math.random() * 1e4), to: racer.peer, k: kind });
      if (this.netHits.length > 8) this.netHits.shift();
      if (kind === 'mud') {
        this.particles.burst(tmp.copy(pos).add(UP), 24, { color: 0x5a3b1e, size: 0.8, life: 0.7, gravity: 14, opacity: 1 }, 10);
        if (byMe) {
          this.hud.message(`🟤 Splat! You hit ${racer.name}!`, 1.6);
          this.audio.play('mud');
        }
      } else if (kind === 'rocket' && byMe) {
        this.hud.message(`🎯 Rocket hit ${racer.name}!`, 1.4);
      }
      return;
    }
    if (e.ghost > 0) return;
    if (e.shield > 0) {
      e.shield = 0;
      this.particles.burst(tmp.copy(pos).add(UP), 18, { color: 0x66ccff, size: 0.6, life: 0.5, additive: true }, 9);
      if (racer.isPlayer) this.hud.message('🛡️ Shield blocked it!', 1.4);
      if (racer.isPlayer || byMe) this.audio.play('pop');
      return;
    }
    if (kind === 'mud') {
      e.mud = 2;
      e.boost = 0;
      racer.car.vel.multiplyScalar(0.6);
      this.particles.burst(tmp.copy(pos).add(UP), 24, { color: 0x5a3b1e, size: 0.8, life: 0.7, gravity: 14, opacity: 1 }, 10);
      if (racer.isPlayer) {
        this.hud.mudSplash();
        this.hud.message(`🟤 Splat! ${from ? from.name : 'Someone'} got you!`, 1.8);
        this.audio.play('mud');
      } else if (byMe) {
        this.hud.message(`🟤 Splat! You hit ${racer.name}!`, 1.6);
        this.audio.play('mud');
      }
    } else if (kind === 'oil' || kind === 'rocket') {
      e.spin = kind === 'rocket' ? 0.8 : 1.0;
      racer.car.vel.multiplyScalar(kind === 'rocket' ? 0.6 : 0.55);
      if (kind === 'rocket') {
        racer.car.vy = 6;
        racer.car.airborne = true;
        this.particles.burst(tmp.copy(pos).add(UP), 24, { color: 0xff7a2a, size: 1, life: 0.5, additive: true, grow: 2.5 }, 10);
      }
      const label = kind === 'rocket' ? '🎯 Rocket' : '🛢️ Oil slick';
      if (racer.isPlayer) {
        this.hud.message(`${label}! You spun out!`, 1.4);
        this.audio.play('spin');
      } else if (byMe) {
        this.hud.message(`${label}: ${racer.name} spun out!`, 1.4);
      }
    } else if (kind === 'zap') {
      e.stun = 1.4;
      if (racer.isPlayer) this.hud.zapFlash();
      this.particles.burst(tmp.copy(pos).add(UP), 14, { color: 0xfff27a, size: 0.5, life: 0.4, additive: true }, 8);
      if (racer.isPlayer) this.hud.message(`⚡ ${from ? from.name : 'Someone'} zapped you!`, 1.4);
    } else if (kind === 'shock') {
      e.stun = 0.6;
      const src = from ? from.car.pos : pos;
      const dx = pos.x - src.x;
      const dz = pos.z - src.z;
      const d = Math.hypot(dx, dz) || 1;
      racer.car.vel.x += (dx / d) * 14;
      racer.car.vel.z += (dz / d) * 14;
      if (racer.isPlayer) this.hud.message(`💥 ${from ? from.name : 'Someone'}'s shockwave!`, 1.3);
    }
  }

  respawn(racer) {
    const car = racer.car;
    car.placeAt(car.proj.f, 0);
    racer.effects.spin = 0;
    racer.prevF = car.proj.f;
  }

  // ---------- main loop ----------

  update(dt) {
    if (this.paused) return;
    this.time += dt;

    if (!this.started) {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n !== this.lastCount) {
        this.lastCount = n;
        if (n > 0) {
          this.hud.countdown(String(n));
          this.audio.play('beep');
        } else {
          this.hud.countdown('GO!');
          this.audio.play('go');
          this.started = true;
        }
      }
    } else {
      this.raceTime += dt;
    }

    this.handlePlayerInput(dt);
    if (this.net) {
      this.net.myPeer = this.net.online.me()?.peer || this.net.myPeer;
      this.syncRemotes();
      for (const r of this.remotes.values()) this.updateRemote(r, dt);
      this.netReceive();
    }
    if (this.started) {
      for (const r of this.racers) if (r.ai) aiDrive(r, this, dt);
      const steps = Math.ceil(dt / (1 / 120));
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        for (const r of this.racers) {
          if (r.remote) continue;
          const e = r.effects;
          r.car.step(h, {
            seasonGrip: this.season.grip,
            winter: this.season.id === 'winter',
            boost: e.boost > 0,
            mud: e.mud > 0,
            spin: e.spin > 0,
            stun: e.stun > 0,
            speedScale: this.rubberBand(r),
          });
        }
        this.collideCars();
      }
      for (const r of this.racers) if (!r.remote) this.updateProgress(r);
      this.updateEffects(dt);
      this.updatePickups(dt);
      this.updateProjectiles(dt);
    }
    this.updatePositions();
    if (this.net) this.netPublish();
    this.updateVisuals(dt);
    this.updateCamera(dt);
    this.env.update(dt, this.camera, this.time, this.player.car.pos);
    this.particles.update(dt);

    const pc = this.player.car;
    this.audio.engine(Math.min(1.3, Math.abs(pc.speed) / pc.stats.speed), pc.input.throttle);
    if (!this.ended) this.hud.update(this);
  }

  handlePlayerInput(dt) {
    const p = this.player;
    if (this.finished) return;
    const d = input.drive();
    const target = d.steer;
    const rate = target === 0 || Math.sign(target) !== Math.sign(this.steer) ? 7 : 3.5;
    this.steer += Math.max(-rate * dt, Math.min(rate * dt, target - this.steer));
    d.steer = this.steer;
    Object.assign(p.car.input, d);
    if (input.consume('Space', 'Enter', 'NumpadEnter', 'KeyE', 'TouchItem')) this.useItem(p);
    if (input.consume('KeyR', 'TouchReset') && this.started) {
      this.respawn(p);
      this.hud.message('Back on track!', 1);
    }
    if (input.consume('KeyC', 'TouchCam')) this.camMode = (this.camMode + 1) % 3;

    const t = p.car.proj.tangent;
    const fwd = t ? Math.sin(p.car.heading) * t.x + Math.cos(p.car.heading) * t.z : 1;
    if (this.started && fwd < -0.3 && p.car.speed > 3) this.wrongTimer += 1 / 60;
    else this.wrongTimer = 0;
  }

  rubberBand(r) {
    if (r.isPlayer || !this.diff.rubber) return 1;
    const gap = (this.player.progress - r.progress) * this.track.spacing;
    return 1 + Math.max(-1, Math.min(1, gap / 160)) * this.diff.rubber * 2;
  }

  collideCars() {
    const rs = this.racers;
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i].car;
        const b = rs[j].car;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        if (Math.abs(b.pos.y - a.pos.y) > 2.5) continue;
        const d2 = dx * dx + dz * dz;
        const R = 2.3;
        if (d2 > R * R || d2 < 1e-6) continue;
        const ra = rs[i].remote;
        const rb = rs[j].remote;
        if (ra && rb) continue;
        if (rs[i].effects.ghost > 0 || rs[j].effects.ghost > 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const nz = dz / d;
        const push = (R - d) / (ra || rb ? 1 : 2);
        if (!ra) {
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
        }
        if (!rb) {
          b.pos.x += nx * push;
          b.pos.z += nz * push;
        }
        const rel = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rel < 0) {
          const imp = -rel * (ra || rb ? 1.1 : 0.6);
          if (!ra) {
            a.vel.x -= nx * imp;
            a.vel.z -= nz * imp;
          }
          if (!rb) {
            b.vel.x += nx * imp;
            b.vel.z += nz * imp;
          }
          if ((rs[i].isPlayer || rs[j].isPlayer) && -rel > 4) this.audio.play('hit');
        }
      }
    }
  }

  updateProgress(r) {
    const N = this.track.N;
    const f = r.car.proj.f;
    const d = f - r.prevF;
    // A lap only counts after passing the halfway checkpoint, so jitter on the line can't add laps.
    if (f > N * 0.45 && f < N * 0.55) r.halfway = true;
    if (d < -N / 2 && r.halfway) {
      r.lap++;
      r.halfway = false;
    } else if (d > N / 2) {
      r.lap--;
      r.halfway = true;
    }
    r.prevF = f;
    r.progress = r.lap * N + f;
    if (r.lap > r.maxLap) {
      r.maxLap = r.lap;
      if (r.lap >= 1) {
        const lt = this.raceTime - r.lastLapStart;
        r.lapTimes.push(lt);
        r.bestLap = Math.min(r.bestLap, lt);
      }
      r.lastLapStart = this.raceTime;
      if (r.lap >= this.laps && !r.finished) {
        r.finished = true;
        r.finishTime = this.raceTime;
        this.finishOrder.push(r);
        if (r.isPlayer) this.playerFinished();
      } else if (r.isPlayer && r.lap >= 1) {
        this.audio.play('lap');
        this.hud.message(r.lap === this.laps - 1 ? '🏁 Final lap!' : `Lap ${r.lap + 1} / ${this.laps}`, 1.6);
      }
    }
  }

  playerFinished() {
    this.finished = true;
    const p = this.player;
    p.ai = makeAI(1, 0);
    p.item = null;
    this.hud.setItem(null);
    const place = 1 + this.racers.filter((r) => r !== p && r.finished && r.finishTime < p.finishTime).length;
    this.audio.play(place === 1 ? 'win' : 'lap');
    this.hud.finishBanner(place);
    setTimeout(() => {
      if (this.disposed) return;
      this.ended = true;
      this.audio.engineStop();
      this.opts.onEnd(this.results());
    }, 3200);
  }

  results() {
    const order = [
      ...this.racers.filter((r) => r.finished).sort((a, b) => a.finishTime - b.finishTime),
      ...this.racers.filter((r) => !r.finished).sort((a, b) => b.progress - a.progress),
    ];
    const p = this.player;
    return {
      place: order.indexOf(p) + 1,
      time: p.finishTime,
      bestLap: p.bestLap,
      coins: this.coinsCollected,
      online: !!this.net,
      standings: order.map((r, i) => ({ place: i + 1, name: r.name, isPlayer: r.isPlayer, time: r.finished ? r.finishTime : null })),
    };
  }

  updateEffects(dt) {
    for (const r of this.racers) {
      const e = r.effects;
      for (const k in e) if (e[k] > 0) e[k] = Math.max(0, e[k] - dt);
    }
    for (let i = this.slicks.length - 1; i >= 0; i--) {
      const s = this.slicks[i];
      s.life -= dt;
      s.grace -= dt;
      let gone = s.life <= 0;
      if (!gone) {
        for (const r of this.racers) {
          if (r.remote || (r === s.owner && s.grace > 0)) continue;
          const c = r.car.pos;
          if (Math.abs(c.y - s.pos.y) < 2 && (c.x - s.pos.x) ** 2 + (c.z - s.pos.z) ** 2 < 2.5 * 2.5) {
            this.hit(r, 'oil', s.owner);
            gone = true;
            break;
          }
        }
      }
      if (gone) {
        this.scene.remove(s.mesh);
        this.slicks.splice(i, 1);
      }
    }
  }

  updatePickups(dt) {
    const tr = this.track;
    // Item boxes.
    for (const b of this.boxes) {
      if (!b.active) {
        b.timer -= dt;
        if (b.timer <= 0) {
          b.active = true;
          b.mesh.visible = true;
        }
        continue;
      }
      for (const r of this.racers) {
        if (r.remote) continue;
        if (r.car.pos.distanceToSquared(tmp.copy(b.pos).sub(UP)) < 2.6 * 2.6) {
          b.active = false;
          b.timer = 2.5;
          b.mesh.visible = false;
          this.particles.burst(b.pos, 14, { color: pick([0xff5ac8, 0x7878ff, 0x3ce6ff]), size: 0.5, life: 0.5, additive: true }, 8);
          if (!r.item && !(r.isPlayer && this.finished)) {
            this.giveItem(r, this.rollItem(r));
            if (r.ai) {
              r.ai.itemTimer = 0.8 + Math.random() * 2.5;
              r.ai.itemHeld = 0;
            }
            if (r.isPlayer) this.audio.play('item');
          }
          break;
        }
      }
    }
    // Boost pads.
    for (const r of this.racers) {
      if (r.remote) continue;
      for (const p of this.pads) {
        const d = tr.deltaIdx(p.f, r.car.proj.f);
        if (Math.abs(d) < p.half && Math.abs(r.car.lateral - p.lat) < 2.8) {
          if (r.effects.boost < 0.2 && r.isPlayer) this.audio.play('boost');
          r.effects.boost = Math.max(r.effects.boost, 1.3 * r.car.stats.nitro);
        }
      }
    }
    // Coins (player only).
    const pc = this.player.car;
    const target = tmp2.copy(pc.pos).add(tmp.set(0, 0.9, 0));
    const magnet = this.player.effects.magnet > 0;
    for (const c of this.coins) {
      if (c.taken) continue;
      const d2 = c.pos.distanceToSquared(target);
      if (c.fly) {
        c.pos.lerp(target, Math.min(1, dt * 12));
      } else if (magnet && d2 < 22 * 22) {
        c.fly = true;
      }
      if (d2 < 2.4 * 2.4) {
        c.taken = true;
        this.coinsCollected++;
        this.audio.play('coin');
        this.particles.burst(c.pos, 8, { color: 0xffd34a, size: 0.35, life: 0.45, additive: true }, 5);
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const tgt = tmp.copy(p.target.car.pos).add(UP);
      const dir = tmp2.copy(tgt).sub(p.mesh.position);
      const dist = dir.length();
      dir.normalize().multiplyScalar(Math.max(75, p.target.car.vel.length() + 35));
      p.vel.lerp(dir, Math.min(1, dt * 5));
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.kind !== 'rocket') p.mesh.rotation.x += dt * 8;
      if (p.kind === 'rocket') p.mesh.lookAt(tmp);
      if (Math.random() < 0.6) {
        this.particles.spawn(p.mesh.position, tmp2.set(0, 0, 0), p.kind === 'rocket'
          ? { color: 0xff9a40, size: 0.6, life: 0.3, grow: 0.4, additive: true, opacity: 1 }
          : { color: 0x6b4423, size: 0.45, life: 0.35, grow: 0.5, opacity: 1 });
      }
      if (dist < 2.6 || p.life <= 0) {
        if (dist < 2.6) this.hit(p.target, p.kind || 'mud', p.owner);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  updatePositions() {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((r, i) => (r.position = i + 1));
    this.standings = sorted;
  }

  updateVisuals(dt) {
    const t = this.time;
    for (const r of this.racers) {
      const car = r.car;
      const m = car.model;
      car.syncVisual(dt, t);
      const boosting = r.effects.boost > 0;
      for (const f of m.flames) {
        f.visible = boosting;
        if (boosting) f.scale.set(1, 1, 0.7 + Math.random() * 0.6);
      }
      m.shield.visible = r.effects.shield > 0;
      if (m.shield.visible) {
        m.shield.material.opacity = 0.22 + Math.sin(t * 8) * 0.06 + (r.effects.shield < 1.5 ? Math.sin(t * 30) * 0.1 : 0);
      }
      m.mud.visible = r.effects.mud > 0;
      setGhost(m, r.effects.ghost > 0);
      if (r.effects.stun > 0 && Math.random() < 0.5) {
        this.particles.spawn(tmp.copy(car.pos).add(tmp2.set((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2)),
          tmp2.set(0, 2, 0), { color: 0xfff27a, size: 0.35, life: 0.2, additive: true, opacity: 1 });
      }
      if (m.glow) m.glow.material.opacity = 0.75 + Math.sin(t * 5 + r.position) * 0.15;

      // Particles: flames, drift smoke, wall sparks.
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      if (boosting) {
        for (const f of m.flames) {
          f.getWorldPosition(tmp);
          const col = f.material.color.getHex();
          this.particles.spawn(tmp, tmp2.set(-fx * 8 + (Math.random() - 0.5) * 2, Math.random() * 1.5, -fz * 8 + (Math.random() - 0.5) * 2),
            { color: col, size: 0.7, life: 0.25, grow: 0.3, additive: true, opacity: 0.9 });
        }
      }
      if (Math.abs(car.slip || 0) > 5 && Math.abs(car.speed) > 8 && Math.random() < 0.6) {
        for (const w of [m.wheels[2], m.wheels[3]]) {
          w.pivot.getWorldPosition(tmp);
          tmp.y -= 0.2;
          this.particles.spawn(tmp, tmp2.set((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2),
            { color: this.season.id === 'winter' ? 0xffffff : 0xd8d8d8, size: 1.0, life: 0.9, grow: 3, opacity: 0.35 });
        }
      }
      if (car.landed > 7) {
        this.particles.burst(tmp.copy(car.pos).add(tmp2.set(0, 0.3, 0)), 10,
          { color: this.season.id === 'winter' ? 0xffffff : 0xcfc6b8, size: 1.1, life: 0.6, grow: 2.5, opacity: 0.5 }, 5);
        if (r.isPlayer) this.audio.play('hit');
      }
      car.landed = 0;
      if (car.wallHit > 5) {
        tmp.copy(car.pos).addScaledVector(car.proj.right, Math.sign(car.lateral) * 1.1).add(tmp2.set(0, 0.6, 0));
        this.particles.burst(tmp, 6, { color: 0xffd060, size: 0.25, life: 0.35, additive: true, gravity: 15, grow: 0.5, opacity: 1 }, 7);
        if (r.isPlayer) this.audio.play('hit');
      }
    }

    // Spinning item boxes and coins.
    for (const b of this.boxes) {
      if (!b.active) continue;
      b.mesh.rotation.set(t * 0.8 + b.phase, t * 1.4 + b.phase, 0);
      b.mesh.position.y = b.pos.y + Math.sin(t * 2.5 + b.phase) * 0.25;
    }
    const m = this.coinMatrix;
    this.coinQuat.setFromAxisAngle(UP, t * 3);
    this.coins.forEach((c, i) => {
      if (c.taken) m.compose(c.pos, this.coinQuat, this.zeroScale);
      else {
        tmp.copy(c.pos);
        tmp.y += Math.sin(t * 3 + c.phase) * 0.15;
        m.compose(tmp, this.coinQuat, this.coinScale);
      }
      this.coinMesh.setMatrixAt(i, m);
    });
    this.coinMesh.instanceMatrix.needsUpdate = true;
  }

  updateCamera(dt, snap = false) {
    const car = this.player.car;
    const cam = this.camera;
    const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
    this.camYaw += wrapAngle(car.heading - this.camYaw) * k;
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    const boosting = this.player.effects.boost > 0;
    if (this.camMode === 2) {
      cam.position.set(car.pos.x + Math.sin(car.heading) * 0.2, car.pos.y + 1.45, car.pos.z + Math.cos(car.heading) * 0.2);
      cam.lookAt(car.pos.x + Math.sin(car.heading) * 12, car.pos.y + 1.1, car.pos.z + Math.cos(car.heading) * 12);
      car.model.root.visible = false;
    } else {
      car.model.root.visible = true;
      const far = this.camMode === 1;
      const dist = (far ? 11.5 : 7.4) + Math.max(0, car.speed) * 0.035;
      const h = far ? 4.8 : 2.9;
      tmp.set(car.pos.x - fx * dist, car.pos.y + h, car.pos.z - fz * dist);
      if (snap) cam.position.copy(tmp);
      else cam.position.lerp(tmp, 1 - Math.exp(-dt * 12));
      cam.lookAt(car.pos.x + fx * 5, car.pos.y + (far ? 1.2 : 1.4), car.pos.z + fz * 5);
    }
    const targetFov = 66 + Math.min(1, Math.max(0, car.speed) / 45) * 8 + (boosting ? 9 : 0);
    cam.fov += (targetFov - cam.fov) * (snap ? 1 : 1 - Math.exp(-dt * 4));
    cam.updateProjectionMatrix();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.audio.engineStop();
    for (const r of this.remotes.values()) r.tag.material.map.dispose();
    this.env.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of [].concat(o.material)) m.dispose();
    });
    this.scene.environment = null;
  }
}

