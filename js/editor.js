// Track editor: a top-down drawing board for custom tracks. Points are the corners of the
// road; the road is a smooth curve through them. Point 1 is the start line.
import * as THREE from 'three';
import { TUNES } from './data.js';
import { checkTrack } from './trackcheck.js';
import { loadCustom, saveCustom, sanitizeTrack, customToMap } from './tracks.js';

const $ = (id) => document.getElementById(id);
const VIEW = 600; // metres shown across the shorter side of the board
const LIMIT = 290;

function starterTrack() {
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    pts.push([Math.round(Math.sin(a) * 150), 0, Math.round(-Math.cos(a) * 100)]);
  }
  return { id: 'custom-' + Date.now().toString(36), name: 'My Track', points: pts, width: 16, music: 'valley', ramps: [], bumps: [] };
}

export class Editor {
  constructor({ audio, onBack, onTest, onSaved }) {
    this.audio = audio;
    this.onBack = onBack;
    this.onTest = onTest;
    this.onSaved = onSaved;
    this.canvas = $('editor-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.track = starterTrack();
    this.sel = 0;
    this.drag = false;

    const music = $('ed-music');
    music.innerHTML = Object.entries(TUNES).filter(([k]) => k !== 'menu')
      .map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('');

    $('ed-back').addEventListener('click', () => this.onBack());
    $('ed-new').addEventListener('click', () => this.load(starterTrack()));
    $('ed-load').addEventListener('change', (e) => {
      const t = loadCustom().find((x) => x.id === e.target.value);
      if (t) this.load(t);
    });
    $('ed-name').addEventListener('input', (e) => (this.track.name = e.target.value));
    $('ed-width').addEventListener('input', (e) => {
      this.track.width = Number(e.target.value);
      $('ed-width-val').textContent = this.track.width + ' m';
      this.changed();
    });
    music.addEventListener('change', (e) => (this.track.music = e.target.value));
    $('ed-height').addEventListener('input', (e) => {
      const p = this.track.points[this.sel];
      if (!p) return;
      p[1] = Number(e.target.value);
      $('ed-height-val').textContent = p[1] + ' m';
      this.changed();
    });
    $('ed-ramp').addEventListener('click', () => this.toggleFeature('ramps'));
    $('ed-bumps').addEventListener('click', () => this.toggleFeature('bumps'));
    $('ed-delete-point').addEventListener('click', () => this.deletePoint());
    $('ed-save').addEventListener('click', () => this.save());
    $('ed-test').addEventListener('click', () => {
      if (!this.result.ok) return this.flash('Fix the problems listed before test driving.');
      this.save(true);
      this.onTest(customToMap(sanitizeTrack(this.track)));
    });
    $('ed-delete-track').addEventListener('click', () => this.deleteTrack());

    this.canvas.addEventListener('pointerdown', (e) => this.pointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.pointerMove(e));
    window.addEventListener('pointerup', () => (this.drag = false));
    this.canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deletePoint();
      }
    });
    window.addEventListener('resize', () => this.active && this.resize());
  }

  open() {
    this.active = true;
    this.refreshList();
    this.load(this.track);
    requestAnimationFrame(() => this.resize());
  }

  close() {
    this.active = false;
  }

  load(t) {
    this.track = JSON.parse(JSON.stringify(t));
    this.sel = 0;
    $('ed-name').value = this.track.name;
    $('ed-width').value = this.track.width;
    $('ed-width-val').textContent = this.track.width + ' m';
    $('ed-music').value = this.track.music;
    $('ed-load').value = loadCustom().some((x) => x.id === this.track.id) ? this.track.id : '';
    this.changed();
  }

  refreshList() {
    const list = loadCustom();
    $('ed-load').innerHTML = '<option value="">Open a saved track…</option>'
      + list.map((t) => `<option value="${t.id}">${t.name.replace(/[<>&"]/g, '')}</option>`).join('');
    $('ed-load').disabled = list.length === 0;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.dpr = dpr;
    this.draw();
  }

  // World metres <-> canvas pixels.
  get scale() {
    return Math.min(this.canvas.width, this.canvas.height) / VIEW;
  }
  toScreen(x, z) {
    return [this.canvas.width / 2 + x * this.scale, this.canvas.height / 2 + z * this.scale];
  }
  toWorld(px, py) {
    return [(px - this.canvas.width / 2) / this.scale, (py - this.canvas.height / 2) / this.scale];
  }
  eventPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr];
  }

  pointerDown(e) {
    this.canvas.focus();
    const [px, py] = this.eventPos(e);
    const pts = this.track.points;
    let hit = -1;
    let best = (16 * this.dpr) ** 2;
    pts.forEach((p, i) => {
      const [sx, sy] = this.toScreen(p[0], p[2]);
      const d = (sx - px) ** 2 + (sy - py) ** 2;
      if (d < best) {
        best = d;
        hit = i;
      }
    });
    if (hit < 0) {
      // Add a corner in the nearest stretch of road.
      const [wx, wz] = this.toWorld(px, py);
      hit = this.insertPoint(wx, wz);
      this.audio.play('click');
    }
    this.sel = hit;
    this.drag = true;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.changed();
  }

  pointerMove(e) {
    if (!this.drag) return;
    const [px, py] = this.eventPos(e);
    const [wx, wz] = this.toWorld(px, py);
    const p = this.track.points[this.sel];
    p[0] = Math.round(Math.max(-LIMIT, Math.min(LIMIT, wx)));
    p[2] = Math.round(Math.max(-LIMIT, Math.min(LIMIT, wz)));
    this.changed();
  }

  insertPoint(x, z) {
    const pts = this.track.points;
    const n = pts.length;
    const curve = this.curve();
    let bestSeg = 0;
    let bd = Infinity;
    const S = n * 20;
    for (let i = 0; i < S; i++) {
      const q = curve.getPoint(i / S);
      const d = (q.x - x) ** 2 + (q.z - z) ** 2;
      if (d < bd) {
        bd = d;
        bestSeg = Math.floor(i / 20);
      }
    }
    if (pts.length >= 40) {
      this.flash('A track can have at most 40 points.');
      return this.sel;
    }
    const y = (pts[bestSeg][1] + pts[(bestSeg + 1) % n][1]) / 2;
    pts.splice(bestSeg + 1, 0, [Math.round(x), y, Math.round(z)]);
    for (const key of ['ramps', 'bumps']) this.track[key] = this.track[key].map((i) => (i > bestSeg ? i + 1 : i));
    return bestSeg + 1;
  }

  deletePoint() {
    const pts = this.track.points;
    if (pts.length <= 4) return this.flash('A track needs at least 4 points.');
    pts.splice(this.sel, 1);
    for (const key of ['ramps', 'bumps']) {
      this.track[key] = this.track[key].filter((i) => i !== this.sel).map((i) => (i > this.sel ? i - 1 : i));
    }
    this.sel = Math.min(this.sel, pts.length - 1);
    this.changed();
  }

  toggleFeature(key) {
    const list = this.track[key];
    const i = list.indexOf(this.sel);
    if (i >= 0) list.splice(i, 1);
    else if (list.length >= 6) return this.flash('You can place up to 6 of each.');
    else list.push(this.sel);
    this.audio.play('click');
    this.changed();
  }

  curve() {
    return new THREE.CatmullRomCurve3(this.track.points.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
  }

  changed() {
    this.result = checkTrack(this.track.points, this.track.width);
    const p = this.track.points[this.sel];
    $('ed-sel-label').textContent = `Point ${this.sel + 1} of ${this.track.points.length}${this.sel === 0 ? ' · start line' : ''}`;
    $('ed-height').value = p ? p[1] : 0;
    $('ed-height-val').textContent = (p ? p[1] : 0) + ' m';
    $('ed-ramp').classList.toggle('on', this.track.ramps.includes(this.sel));
    $('ed-bumps').classList.toggle('on', this.track.bumps.includes(this.sel));
    const status = $('ed-status');
    status.className = 'ed-status ' + (this.result.ok ? 'good' : 'bad');
    status.innerHTML = this.result.ok
      ? `✔ Ready to race · ${Math.round(this.result.length)} m lap${this.result.bridges ? ` · ${this.result.bridges} bridge${this.result.bridges > 1 ? 's' : ''}` : ''}`
      : this.result.errors.map((e) => `<div>⚠ ${e}</div>`).join('');
    $('ed-test').disabled = !this.result.ok;
    this.draw();
  }

  flash(text) {
    const el = $('ed-flash');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => el.classList.remove('show'), 2200);
    this.audio.play('error');
  }

  save(quiet = false) {
    const clean = sanitizeTrack(this.track);
    if (!clean) return this.flash('This track could not be saved.');
    this.track.id = clean.id;
    const list = loadCustom().filter((t) => t.id !== clean.id);
    list.push(clean);
    if (!saveCustom(list)) return this.flash('Saving is blocked in this browser, so the track will be lost when you leave.');
    this.refreshList();
    $('ed-load').value = clean.id;
    if (!quiet) {
      this.audio.play('buy');
      this.flash(`Saved “${clean.name}”. Find it in the track list when you race.`);
      $('ed-flash').classList.add('ok');
      setTimeout(() => $('ed-flash').classList.remove('ok'), 2300);
    }
    this.onSaved();
  }

  deleteTrack() {
    const btn = $('ed-delete-track');
    if (!btn.dataset.confirm) {
      btn.dataset.confirm = '1';
      btn.textContent = 'Tap again to delete';
      setTimeout(() => {
        delete btn.dataset.confirm;
        btn.textContent = 'Delete track';
      }, 2500);
      return;
    }
    delete btn.dataset.confirm;
    btn.textContent = 'Delete track';
    saveCustom(loadCustom().filter((t) => t.id !== this.track.id));
    this.refreshList();
    this.load(starterTrack());
    this.onSaved();
  }

  draw() {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const s = this.scale;
    ctx.fillStyle = '#3e7d3a';
    ctx.fillRect(0, 0, W, H);
    // 50 m grid.
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let m = -300; m <= 300; m += 50) {
      const [gx] = this.toScreen(m, 0);
      const [, gy] = this.toScreen(0, m);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }
    const [bx, by] = this.toScreen(-LIMIT, -LIMIT);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([8 * this.dpr, 8 * this.dpr]);
    ctx.strokeRect(bx, by, LIMIT * 2 * s, LIMIT * 2 * s);
    ctx.setLineDash([]);

    const pts = this.track.points;
    const curve = this.curve();
    const samples = curve.getSpacedPoints(400);
    const path = () => {
      ctx.beginPath();
      samples.forEach((q, i) => {
        const [x, y] = this.toScreen(q.x, q.z);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    path();
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = (this.track.width + 2.4) * s;
    ctx.stroke();
    path();
    ctx.strokeStyle = '#4a4d55';
    ctx.lineWidth = this.track.width * s;
    ctx.stroke();
    // Centre line coloured by height: blue low, orange high.
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      const h = Math.min(1, ((a.y + b.y) / 2) / 25);
      ctx.strokeStyle = `hsl(${210 - h * 180}, 90%, 60%)`;
      ctx.lineWidth = 2.5 * this.dpr;
      const [x1, y1] = this.toScreen(a.x, a.z);
      const [x2, y2] = this.toScreen(b.x, b.z);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Problem spots and bridges.
    for (const c of this.result.crossings) {
      const [x, y] = this.toScreen(c.x, c.z);
      ctx.fillStyle = c.bridge ? 'rgba(80,170,255,0.9)' : 'rgba(255,60,80,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 10 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${12 * this.dpr}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.bridge ? 'B' : '!', x, y);
    }

    // Start arrow.
    const t0 = curve.getTangent(0);
    const [sx, sy] = this.toScreen(pts[0][0], pts[0][2]);
    const ang = Math.atan2(t0.z, t0.x);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd400';
    ctx.beginPath();
    const a = 26 * this.dpr;
    ctx.moveTo(a, 0);
    ctx.lineTo(a - 12 * this.dpr, -9 * this.dpr);
    ctx.lineTo(a - 12 * this.dpr, 9 * this.dpr);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Points (with ramp / bump badges).
    pts.forEach((p, i) => {
      const [x, y] = this.toScreen(p[0], p[2]);
      const r = (i === this.sel ? 11 : 8) * this.dpr;
      ctx.fillStyle = i === 0 ? '#ffd400' : '#ffffff';
      ctx.strokeStyle = i === this.sel ? '#ff5ac8' : '#111';
      ctx.lineWidth = (i === this.sel ? 4 : 2) * this.dpr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.font = `bold ${10 * this.dpr}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y + 0.5);
      const badges = [];
      if (this.track.ramps.includes(i)) badges.push(['RAMP', '#ffc81e']);
      if (this.track.bumps.includes(i)) badges.push(['BUMPS', '#ff8a3d']);
      badges.forEach(([label, color], k) => {
        ctx.font = `bold ${10 * this.dpr}px sans-serif`;
        const w = ctx.measureText(label).width + 8 * this.dpr;
        const bx2 = x + 12 * this.dpr;
        const by2 = y - 20 * this.dpr + k * 15 * this.dpr;
        ctx.fillStyle = color;
        ctx.fillRect(bx2, by2, w, 13 * this.dpr);
        ctx.fillStyle = '#111';
        ctx.textAlign = 'left';
        ctx.fillText(label, bx2 + 4 * this.dpr, by2 + 7 * this.dpr);
      });
    });
  }
}
