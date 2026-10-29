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
    this.pos.innerHTML = `${p.position}<sup>${ordinal(p.position).slice(-2)}</sup><small>/${race.racers.length}</small>`;
    this.lap.textContent = `Lap ${Math.min(race.laps, Math.max(1, p.lap + 1))} / ${race.laps}`;
    this.timeEl.textContent = race.raceTime > 0 ? formatTime(p.finished ? p.finishTime : race.raceTime) : '0:00.00';
    this.best.textContent = 'Best lap ' + formatTime(p.bestLap);
    this.coins.textContent = race.coinsCollected;
    const kmh = Math.round(Math.abs(car.speed) * 3.6);
    this.speed.textContent = kmh;
    this.speedBar.style.width = Math.min(100, (Math.abs(car.speed) / (car.stats.speed * 1.4)) * 100) + '%';
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

  drawMinimap(race) {
    const ctx = this.ctx;
    const W = this.mini.width;
    ctx.clearRect(0, 0, W, W);
    const pts = race.track.p;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= pts.length; i += 3) {
      const p = pts[i % pts.length];
      const [x, y] = this.mapXY(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 5;
    ctx.stroke();
    const [sx, sy] = this.mapXY(pts[0].x, pts[0].z);
    ctx.fillStyle = '#111';
    ctx.fillRect(sx - 4, sy - 4, 8, 8);
    for (const r of race.racers) {
      if (r.isPlayer) continue;
      const [x, y] = this.mapXY(r.car.pos.x, r.car.pos.z);
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const [px, py] = this.mapXY(race.player.car.pos.x, race.player.car.pos.z);
    ctx.fillStyle = '#ffd400';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
