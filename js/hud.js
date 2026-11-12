// In-race HUD: position, laps, timer, speed, coins, item slot, minimap, messages, mud overlay.
import { POWERUPS } from './data.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function formatTime(t) {
  if (!isFinite(t) || t <= 0) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export class HUD {
  constructor() {
    this.root = $('hud');
    this.pos = $('hud-pos');
    this.lap = $('hud-lap');
    this.timeEl = $('hud-time');
    this.best = $('hud-best');
    this.coins = $('hud-coins');
    this.speed = $('speed-val');
    this.speedBar = $('speed-bar');
    this.itemIcon = $('item-icon');
    this.itemName = $('item-name');
    this.itemBox = $('hud-item');
    this.msg = $('hud-msg');
    this.count = $('hud-countdown');
    this.wrong = $('hud-wrong');
    this.board = $('hud-board');
    this.effects = $('hud-effects');
    this.mud = $('mud-overlay');
    this.boostFx = $('boost-lines');
    this.mini = $('minimap');
    this.ctx = this.mini.getContext('2d');
    this.msgTimer = null;
    this.lastBoard = '';
    this.last = {};
  }

  show(v) {
    this.root.classList.toggle('hidden', !v);
  }

  setupRace(race) {
    this.mud.innerHTML = '';
    this.msg.className = '';
    this.msg.textContent = '';
    this.count.textContent = '';
    this.setItem(null);
    // Minimap transform.
    const pts = race.track.p;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const W = this.mini.width;
    const pad = 16;
    const s = (W - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    const ox = (W - (maxX - minX) * s) / 2;
    const oz = (W - (maxZ - minZ) * s) / 2;
    this.mapXY = (x, z) => [ox + (x - minX) * s, oz + (z - minZ) * s];
    this.lastBoard = '';
    this.last = {};
    this.miniTrack = null;
  }

  setItem(id, uses = 1) {
    const p = id ? POWERUPS[id] : null;
    this.itemIcon.textContent = p ? p.icon + (uses > 1 ? `×${uses}` : '') : '';
    this.itemName.textContent = p ? p.name : 'No item';
    this.itemBox.classList.toggle('has-item', !!p);
    if (p) {
      this.itemBox.classList.remove('pop');
      void this.itemBox.offsetWidth;
      this.itemBox.classList.add('pop');
    }
  }

  message(text, dur = 1.5, cls = '') {
    this.msg.textContent = text;
    this.msg.className = 'show ' + cls;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => (this.msg.className = ''), dur * 1000);
  }

  countdown(text) {
    this.count.textContent = text;
    this.count.classList.remove('tick');
    void this.count.offsetWidth;
    this.count.classList.add('tick');
    if (text === 'GO!') setTimeout(() => (this.count.textContent = ''), 900);
  }

  finishBanner(place) {
    this.message(place === 1 ? '🏆 YOU WIN! 🏆' : `🏁 Finished ${ordinal(place)}!`, 3.2, 'big');
  }

  zapFlash() {
    const el = document.getElementById('zap-flash');
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
  }

  mudSplash() {
    this.mud.innerHTML = '';
    const n = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const b = document.createElement('div');
      b.className = 'blob';
      const size = 14 + Math.random() * 22;
      b.style.width = size + 'vmin';
      b.style.height = size * (0.75 + Math.random() * 0.5) + 'vmin';
      b.style.left = 5 + Math.random() * 80 + '%';
      b.style.top = Math.random() * 70 + '%';
      const r = () => 35 + Math.floor(Math.random() * 30);
      b.style.borderRadius = `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%`;
      b.style.animationDelay = Math.random() * 0.15 + 's';
      for (let d = 0; d < 2; d++) {
        const drip = document.createElement('i');
        drip.style.left = 20 + Math.random() * 60 + '%';
        drip.style.animationDelay = 0.2 + Math.random() * 0.5 + 's';
        b.appendChild(drip);
      }
      this.mud.appendChild(b);
    }
    this.mud.classList.remove('active');
    void this.mud.offsetWidth;
    this.mud.classList.add('active');
  }

  update(race) {
    const p = race.player;
    const car = p.car;
    const setText = (el, key, text) => {
      if (this.last[key] !== text) {
        this.last[key] = text;
        el.textContent = text;
      }
    };
    const posHtml = `${p.position}<sup>${ordinal(p.position).slice(-2)}</sup><small>/${race.racers.length}</small>`;
    if (this.last.pos !== posHtml) {
      this.last.pos = posHtml;
      this.pos.innerHTML = posHtml;
    }
    setText(this.lap, 'lap', `Lap ${Math.min(race.laps, Math.max(1, p.lap + 1))} / ${race.laps}`);
    this.timeEl.textContent = race.raceTime > 0 ? formatTime(p.finished ? p.finishTime : race.raceTime) : '0:00.00';
    setText(this.best, 'best', 'Best lap ' + formatTime(p.bestLap));
    setText(this.coins, 'coins', String(race.coinsCollected));
    const kmh = Math.round(Math.abs(car.speed) * 3.6);
    setText(this.speed, 'speed', String(kmh));
    const bar = Math.round(Math.min(100, (Math.abs(car.speed) / (car.stats.speed * 1.4)) * 100)) + '%';
    if (this.last.bar !== bar) {
      this.last.bar = bar;
      this.speedBar.style.width = bar;
    }
    this.wrong.classList.toggle('show', race.wrongTimer > 1.2);
    this.boostFx.classList.toggle('active', p.effects.boost > 0);

    const fx = [];
    if (p.effects.boost > 0) fx.push(`🚀 ${p.effects.boost.toFixed(1)}s`);
    if (p.effects.shield > 0) fx.push(`🛡️ ${p.effects.shield.toFixed(1)}s`);
    if (p.effects.magnet > 0) fx.push(`🧲 ${p.effects.magnet.toFixed(1)}s`);
    if (p.effects.mud > 0) fx.push('🟤 Muddy!');
    if (p.effects.ghost > 0) fx.push(`👻 ${p.effects.ghost.toFixed(1)}s`);
    if (p.effects.stun > 0) fx.push('⚡ Stunned!');
    const fxHtml = fx.map((t) => `<span>${t}</span>`).join('');
    if (fxHtml !== this.effects.innerHTML) this.effects.innerHTML = fxHtml;

    const board = race.standings.map((r) => `<li class="${r.isPlayer ? 'me' : ''}"><b>${r.position}</b>${esc(r.name)}${r.finished ? ' 🏁' : ''}</li>`).join('');
    if (board !== this.lastBoard) {
      this.board.innerHTML = board;
      this.lastBoard = board;
    }
    this.drawMinimap(race);
  }

  // The track outline is drawn once into an offscreen canvas; each frame only copies it and
  // adds the racer dots.
  drawMinimap(race) {
    const ctx = this.ctx;
    const W = this.mini.width;
    if (this.miniTrack !== race.track) {
      this.miniTrack = race.track;
      const bg = document.createElement('canvas');
      bg.width = bg.height = W;
      const b = bg.getContext('2d');
      const pts = race.track.p;
      b.lineJoin = 'round';
      b.beginPath();
      for (let i = 0; i <= pts.length; i += 3) {
        const p = pts[i % pts.length];
        const [x, y] = this.mapXY(p.x, p.z);
        if (i === 0) b.moveTo(x, y);
        else b.lineTo(x, y);
      }
      b.closePath();
      b.strokeStyle = 'rgba(0,0,0,0.45)';
      b.lineWidth = 9;
      b.stroke();
      b.strokeStyle = 'rgba(255,255,255,0.9)';
      b.lineWidth = 5;
      b.stroke();
      const [sx, sy] = this.mapXY(pts[0].x, pts[0].z);
      b.fillStyle = '#111';
      b.fillRect(sx - 4, sy - 4, 8, 8);
      this.miniBg = bg;
    }
    ctx.clearRect(0, 0, W, W);
    ctx.drawImage(this.miniBg, 0, 0);
    ctx.fillStyle = '#ff5a5f';
    for (const r of race.racers) {
      if (r.isPlayer) continue;
      const [x, y] = this.mapXY(r.car.pos.x, r.car.pos.z);
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const [px, py] = this.mapXY(race.player.car.pos.x, race.player.car.pos.z);
    ctx.fillStyle = '#ffc21a';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

}
