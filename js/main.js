// Entry point: renderer, screens and game flow.
import * as THREE from 'three';
import { MAPS, SEASONS, DIFFICULTIES, PARTS, PLACE_BONUS, CATEGORIES } from './data.js';
import { profile, saveProfile, addCoins, grantPart, equipPart, recordBest } from './save.js';
import { Race } from './race.js';
import { HUD, formatTime, ordinal } from './hud.js';
import { Showroom } from './showroom.js';
import { Garage } from './garage.js';
import { Sound } from './audio.js';
import { input, bindTouchControls } from './input.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const audio = new Sound();
const hud = new HUD();
const showroom = new Showroom(renderer);
showroom.setCar(profile.equipped);
let race = null;

const selection = { map: MAPS[0].id, season: 'spring', difficulty: 'normal', laps: 3 };
try {
  Object.assign(selection, JSON.parse(localStorage.getItem('polyrush.selection') || '{}'));
} catch {
  // ignore
}
if (!MAPS.some((m) => m.id === selection.map)) selection.map = MAPS[0].id;
if (!SEASONS[selection.season]) selection.season = 'spring';
if (!DIFFICULTIES[selection.difficulty]) selection.difficulty = 'normal';

// ---------- screens ----------

function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('hidden', el.id !== id);
  showroom.active = !race;
}

function refreshCoins() {
  for (const el of document.querySelectorAll('.coin-count')) el.textContent = profile.coins;
  const n = profile.chests || 0;
  $('menu-chests').classList.toggle('hidden', n === 0);
  $('menu-chests-count').textContent = n;
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

document.addEventListener('pointerdown', () => audio.init(), { once: false });

// Main menu.
$('btn-play').addEventListener('click', () => {
  audio.play('click');
  openMapSelect();
});
$('btn-garage').addEventListener('click', () => {
  audio.play('click');
  showScreen('garage');
  garage.open();
});
$('btn-online').addEventListener('click', () => {
  audio.play('click');
  toast('🌐 Online races with friends are coming in a future update!');
});
$('btn-help').addEventListener('click', () => {
  audio.play('click');
  showScreen('help');
});
$('help-back').addEventListener('click', () => showScreen('menu'));
$('menu-chests').addEventListener('click', () => openChest('menu'));
$('btn-mute').addEventListener('click', () => {
  const m = audio.toggleMute();
  $('btn-mute').textContent = m ? '🔇' : '🔊';
});

const garage = new Garage({
  showroom,
  audio,
  onBack: () => {
    showScreen('menu');
    refreshCoins();
  },
  onChange: refreshCoins,
});

// ---------- map & season select ----------

function drawPreview(cv, map) {
  const ctx = cv.getContext('2d');
  const curve = new THREE.CatmullRomCurve3(map.points.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
  const pts = curve.getSpacedPoints(200);
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
  const W = cv.width;
  const H = cv.height;
  const s = Math.min((W - 30) / (maxX - minX), (H - 30) / (maxZ - minZ));
  const ox = (W - (maxX - minX) * s) / 2;
  const oy = (H - (maxZ - minZ) * s) / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = ox + (p.x - minX) * s;
    const y = oy + (p.z - minZ) * s;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 6;
  ctx.stroke();
  const p0 = pts[0];
  ctx.fillStyle = '#ffd400';
  ctx.beginPath();
  ctx.arc(ox + (p0.x - minX) * s, oy + (p0.z - minZ) * s, 7, 0, Math.PI * 2);
  ctx.fill();
}

function bestKey() {
  return `${selection.map}:${selection.season}:${selection.laps}`;
}

function openMapSelect() {
  showScreen('select');
  const maps = $('map-list');
  maps.innerHTML = '';
  for (const m of MAPS) {
    const card = document.createElement('button');
    card.className = 'map-card' + (m.id === selection.map ? ' selected' : '');
    card.innerHTML = `<canvas width="220" height="150"></canvas><div class="map-name">${m.name}</div>
      <div class="map-stars">${'★'.repeat(m.stars)}${'☆'.repeat(3 - m.stars)}</div><div class="map-desc">${m.desc}</div>`;
    drawPreview(card.querySelector('canvas'), m);
    card.addEventListener('click', () => {
      audio.play('click');
      selection.map = m.id;
      openMapSelect();
    });
    maps.appendChild(card);
  }
  const seasons = $('season-list');
  seasons.innerHTML = '';
  for (const s of Object.values(SEASONS)) {
    const b = document.createElement('button');
    b.className = `season-card ${s.id}` + (s.id === selection.season ? ' selected' : '');
    b.innerHTML = `<div class="season-icon">${s.icon}</div><div class="season-name">${s.name}</div><div class="season-desc">${s.desc}</div>`;
    b.addEventListener('click', () => {
      audio.play('click');
      selection.season = s.id;
      openMapSelect();
    });
    seasons.appendChild(b);
  }
  const chips = (el, items, key) => {
    el.innerHTML = '';
    for (const [val, label] of items) {
      const b = document.createElement('button');
      b.className = 'chip' + (selection[key] === val ? ' selected' : '');
      b.textContent = label;
      b.addEventListener('click', () => {
        audio.play('click');
        selection[key] = val;
        openMapSelect();
      });
      el.appendChild(b);
    }
  };
  chips($('diff-list'), Object.values(DIFFICULTIES).map((d) => [d.id, d.name]), 'difficulty');
  chips($('laps-list'), [[1, '1 lap'], [3, '3 laps'], [5, '5 laps']], 'laps');
  const best = profile.best[bestKey()];
  $('select-best').textContent = best ? `Your best here: ${formatTime(best)}` : 'No record yet — set one!';
  try {
    localStorage.setItem('polyrush.selection', JSON.stringify(selection));
  } catch {
    // ignore
  }
}
$('select-back').addEventListener('click', () => showScreen('menu'));
$('select-start').addEventListener('click', () => startRace());

// ---------- race ----------

function startRace() {
  audio.init();
  audio.play('click');
  if (race) {
    race.dispose();
    race = null;
  }
  showScreen('loading');
  // Let the loading screen paint before the (synchronous) world build.
  setTimeout(() => {
    input.clearPressed();
    race = new Race(renderer, {
      map: MAPS.find((m) => m.id === selection.map),
      season: SEASONS[selection.season],
      difficulty: DIFFICULTIES[selection.difficulty],
      laps: selection.laps,
      equipped: { ...profile.equipped },
      audio,
      hud,
      onEnd: endRace,
    });
    showScreen(null);
    hud.show(true);
  }, 50);
}

function quitRace() {
  if (race) race.dispose();
  race = null;
  hud.show(false);
  showroom.setCar(profile.equipped);
  showroom.setView('menu');
  showScreen('menu');
  refreshCoins();
}

function endRace(res) {
  hud.show(false);
  const bonus = PLACE_BONUS[res.place - 1] || 0;
  const total = res.coins + bonus;
  addCoins(total);
  profile.races++;
  const won = res.place === 1;
  if (won) {
    profile.wins++;
    profile.chests = (profile.chests || 0) + 1;
  }
  const record = recordBest(bestKey(), res.time);
  saveProfile();

  $('res-title').textContent = won ? '🏆 Victory!' : `You finished ${ordinal(res.place)}`;
  $('res-sub').textContent = `${MAPS.find((m) => m.id === selection.map).name} · ${SEASONS[selection.season].name} · ${DIFFICULTIES[selection.difficulty].name}`;
  $('res-time').textContent = formatTime(res.time) + (record ? '  ⭐ New record!' : '');
  $('res-lap').textContent = formatTime(res.bestLap);
  $('res-coins').innerHTML = `🪙 ${res.coins} collected + ${bonus} place bonus = <b>${total}</b>`;
  $('res-table').innerHTML = res.standings
    .map((s) => `<tr class="${s.isPlayer ? 'me' : ''}"><td>${s.place}</td><td>${s.name}</td><td>${s.time ? formatTime(s.time) : 'racing…'}</td></tr>`)
    .join('');
  $('res-chest').classList.toggle('hidden', !won);
  refreshCoins();
  showScreen('results');
}

$('res-chest').addEventListener('click', () => openChest('results'));
$('res-again').addEventListener('click', () => startRace());
$('res-tracks').addEventListener('click', () => {
  quitRace();
  openMapSelect();
});
$('res-menu').addEventListener('click', () => quitRace());

// Pause.
function setPaused(p) {
  if (!race || race.ended) return;
  race.paused = p;
  showScreen(p ? 'pause' : null);
  if (p) audio.engine(0, 0);
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (race && !race.ended) setPaused(!race.paused);
  }
  if (e.code === 'KeyM') $('btn-mute').click();
});
$('pause-btn').addEventListener('click', () => setPaused(true));
$('pause-resume').addEventListener('click', () => setPaused(false));
$('pause-restart').addEventListener('click', () => startRace());
$('pause-quit').addEventListener('click', () => quitRace());

// ---------- treasure chest ----------

let chestFrom = 'menu';
let chestReward = null;

function rollChest() {
  const r = Math.random();
  const lockedChest = PARTS.filter((p) => p.chest && !profile.owned[p.id]);
  const lockedShop = PARTS.filter((p) => !p.chest && !profile.owned[p.id] && p.price <= 800);
  if (r < 0.22) {
    if (lockedChest.length) return { rarity: 'legendary', part: lockedChest[Math.floor(Math.random() * lockedChest.length)] };
    return { rarity: 'legendary', coins: 500 };
  }
  if (r < 0.45 && lockedShop.length) return { rarity: 'epic', part: lockedShop[Math.floor(Math.random() * lockedShop.length)] };
  if (r < 0.72) return { rarity: 'rare', coins: 150 + Math.floor(Math.random() * 16) * 10 };
  return { rarity: 'common', coins: 60 + Math.floor(Math.random() * 7) * 10 };
}

function openChest(from) {
  if (!profile.chests) return;
  chestFrom = from;
  chestReward = null;
  $('chest').className = 'chest-box';
  $('chest-screen').className = 'screen';
  $('reward').classList.add('hidden');
  $('chest-hint').classList.remove('hidden');
  $('chest-left').textContent = profile.chests > 1 ? `${profile.chests} chests waiting` : '';
  showScreen('chest-screen');
}

$('chest').addEventListener('click', () => {
  if (chestReward || !profile.chests) return;
  audio.init();
  chestReward = rollChest();
  profile.chests--;
  if (chestReward.part) grantPart(chestReward.part.id);
  else addCoins(chestReward.coins);
  saveProfile();
  $('chest').classList.add('shake');
  $('chest-hint').classList.add('hidden');
  setTimeout(() => {
    audio.play('chest');
    $('chest').classList.add('open');
    $('chest-screen').classList.add(chestReward.rarity);
    const rw = chestReward;
    const cat = rw.part ? CATEGORIES.find((c) => c.id === rw.part.cat) : null;
    $('reward-rarity').textContent = rw.rarity.toUpperCase();
    $('reward-icon').textContent = rw.part ? cat.icon : '🪙';
    $('reward-name').textContent = rw.part ? rw.part.name : `${rw.coins} coins`;
    $('reward-desc').textContent = rw.part
      ? `New ${cat.name.toLowerCase()} unlocked${rw.part.chest ? ' — a chest exclusive!' : '!'}`
      : 'Spend them in the garage on new parts.';
    $('reward-equip').classList.toggle('hidden', !rw.part);
    $('reward-next').classList.toggle('hidden', !profile.chests);
    $('reward').classList.remove('hidden');
    refreshCoins();
  }, 1100);
});
$('reward-equip').addEventListener('click', () => {
  if (chestReward && chestReward.part) {
    equipPart(chestReward.part.id);
    showroom.setCar(profile.equipped);
    toast(`${chestReward.part.name} equipped!`);
  }
  $('reward-equip').classList.add('hidden');
});
$('reward-next').addEventListener('click', () => openChest(chestFrom));
$('reward-done').addEventListener('click', () => {
  if (chestFrom === 'results') {
    $('res-chest').classList.add('hidden');
    showScreen('results');
  } else {
    showScreen('menu');
  }
  refreshCoins();
});

// ---------- loop ----------

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  showroom.resize(innerWidth, innerHeight);
  if (race) race.resize(innerWidth, innerHeight);
});

if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
bindTouchControls(document.getElementById('touch'));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (race) {
    race.update(dt);
    race.render();
  } else {
    showroom.update(dt);
    showroom.render();
  }
  requestAnimationFrame(frame);
}

refreshCoins();
showScreen('menu');
showroom.setView('menu');
requestAnimationFrame(frame);
window.__game = { get race() { return race; }, profile, startRace, selection };
