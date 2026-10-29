// Entry point: renderer, screens and game flow.
import * as THREE from 'three';
import { MAPS, SEASONS, DIFFICULTIES, PARTS, PLACE_BONUS, CATEGORIES, TUNES } from './data.js';
import { profile, saveProfile, addCoins, grantPart, equipPart, recordBest } from './save.js';
import { Race } from './race.js';
import { HUD, formatTime, ordinal } from './hud.js';
import { Showroom } from './showroom.js';
import { Garage } from './garage.js';
import { Sound } from './audio.js';
import { input, bindTouchControls } from './input.js';
import { Online, randomCode, cleanCode, cleanName } from './online.js';
import { Music } from './music.js';
import { Editor } from './editor.js';
import { allMaps, findMap, setNetMap } from './tracks.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const audio = new Sound();
const music = new Music(audio);
audio.onReady = () => music.resume();
const hud = new HUD();
const showroom = new Showroom(renderer);
showroom.setCar(profile.equipped);
let race = null;
let editor = null;

const selection = { map: MAPS[0].id, season: 'spring', difficulty: 'normal', laps: 3 };
try {
  Object.assign(selection, JSON.parse(localStorage.getItem('polyrush.selection') || '{}'));
} catch {
  // ignore
}
if (!findMap(selection.map)) selection.map = MAPS[0].id;
if (!SEASONS[selection.season]) selection.season = 'spring';
if (!DIFFICULTIES[selection.difficulty]) selection.difficulty = 'normal';

// ---------- screens ----------

let currentScreen = 'menu';
function showScreen(id) {
  currentScreen = id;
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('hidden', el.id !== id);
  showroom.active = !race;
  if (!race && id !== 'loading') music.play('menu');
  if (id !== 'editor' && editor) editor.close();
  updateNowPlaying();
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
  openOnline();
});
$('btn-help').addEventListener('click', () => {
  audio.play('click');
  showScreen('help');
});
$('help-back').addEventListener('click', () => showScreen('menu'));
$('btn-editor').addEventListener('click', () => {
  audio.play('click');
  showScreen('editor');
  editor.open();
});
$('btn-settings').addEventListener('click', () => {
  audio.play('click');
  showScreen('settings');
});
$('settings-back').addEventListener('click', () => showScreen('menu'));

// Volume sliders (the same pair appears in Sound settings and in the pause menu).
for (const group of document.querySelectorAll('.vol-group')) {
  group.innerHTML = [['music', '🎵 Music'], ['sfx', '🔊 Effects']].map(([k, label]) => {
    const id = `vol-${k}-${group.closest('.screen').id}`;
    return `<label class="vol" for="${id}">${label}<input id="${id}" type="range" min="0" max="100" data-vol="${k}" /><output></output></label>`;
  }).join('');
}
function syncVolumes() {
  for (const el of document.querySelectorAll('[data-vol]')) {
    const v = Math.round(audio.volumes[el.dataset.vol] * 100);
    el.value = v;
    el.nextElementSibling.textContent = v + '%';
  }
}
for (const el of document.querySelectorAll('[data-vol]')) {
  el.addEventListener('input', () => {
    audio.init();
    audio.setVolume(el.dataset.vol, el.value / 100);
    syncVolumes();
  });
}
syncVolumes();
function updateNowPlaying() {
  const t = TUNES[music.wanted] || TUNES.menu;
  for (const el of document.querySelectorAll('.now-playing')) el.textContent = t.name;
}
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
  for (const m of allMaps()) {
    const card = document.createElement('button');
    card.className = 'map-card' + (m.id === selection.map ? ' selected' : '');
    card.innerHTML = `<canvas width="220" height="150"></canvas><div class="map-name">${esc(m.name)}${m.custom ? '<span class="custom-tag">Yours</span>' : ''}</div>
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

let raceCfg = null;

function startRace(cfg = null) {
  audio.init();
  audio.play('click');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (race) {
    race.dispose();
    race = null;
  }
  raceCfg = cfg || { map: selection.map, season: selection.season, difficulty: selection.difficulty, laps: selection.laps, net: null };
  const mapDef = raceCfg.mapDef || findMap(raceCfg.map) || MAPS[0];
  raceCfg.mapDef = mapDef;
  music.play(mapDef.music || mapDef.id);
  updateNowPlaying();
  showScreen('loading');
  // Let the loading screen paint before the (synchronous) world build.
  setTimeout(() => {
    input.clearPressed();
    race = new Race(renderer, {
      map: raceCfg.mapDef,
      season: SEASONS[raceCfg.season],
      difficulty: DIFFICULTIES[raceCfg.difficulty],
      laps: raceCfg.laps,
      net: raceCfg.net,
      equipped: { ...profile.equipped },
      audio,
      hud,
      onEnd: endRace,
    });
    showScreen(null);
    hud.show(true);
    $('pause-restart').classList.toggle('hidden', !!raceCfg.net);
    $('bar-restart').classList.toggle('hidden', !!raceCfg.net);
  }, 50);
}

function quitRace() {
  const wasOnline = !!(race && race.net);
  const fromEditor = !!(raceCfg && raceCfg.fromEditor);
  if (race) race.dispose();
  race = null;
  clearInterval(resultsTimer);
  hud.show(false);
  showroom.setCar(profile.equipped);
  showroom.setView('menu');
  refreshCoins();
  if (wasOnline) {
    online.set({ raceId: null, st: null, hits: [], oil: [], used: [] });
    openOnline();
    return;
  }
  if (fromEditor) {
    showScreen('editor');
    editor.open();
    return;
  }
  showScreen('menu');
}

let resultsTimer = null;
function renderStandings(standings) {
  $('res-table').innerHTML = standings
    .map((s) => `<tr class="${s.isPlayer ? 'me' : ''}"><td>${s.place}</td><td>${esc(s.name)}</td><td>${s.time ? formatTime(s.time) : 'racing…'}</td></tr>`)
    .join('');
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
  const record = recordBest(`${raceCfg.mapDef.id}:${raceCfg.season}:${raceCfg.laps}`, res.time);
  if (res.online) online.set({ res: { raceId: raceCfg.net.raceId, place: res.place } });
  saveProfile();

  $('res-title').textContent = won ? '🏆 Victory!' : `You finished ${ordinal(res.place)}`;
  $('res-sub').textContent = `${raceCfg.mapDef.name} · ${SEASONS[raceCfg.season].name} · `
    + (res.online ? 'Online' : DIFFICULTIES[raceCfg.difficulty].name);
  $('res-time').textContent = formatTime(res.time) + (record ? '  ⭐ New record!' : '');
  $('res-lap').textContent = formatTime(res.bestLap);
  $('res-coins').innerHTML = `🪙 ${res.coins} collected + ${bonus} place bonus = <b>${total}</b>`;
  renderStandings(res.standings);
  // Online: friends may still be finishing, so keep the table live.
  clearInterval(resultsTimer);
  if (res.online) resultsTimer = setInterval(() => race && renderStandings(race.results().standings), 500);
  $('res-again').textContent = res.online ? 'Back to lobby' : 'Race again';
  $('res-tracks').classList.toggle('hidden', !!res.online);
  $('res-tracks').textContent = raceCfg.fromEditor ? 'Back to editor' : 'Change track';
  $('res-chest').classList.toggle('hidden', !won);
  refreshCoins();
  showScreen('results');
}

$('res-chest').addEventListener('click', () => openChest('results'));
$('res-again').addEventListener('click', () => {
  if (race && race.net) quitRace();
  else startRace(raceCfg);
});
$('res-tracks').addEventListener('click', () => {
  const fromEditor = raceCfg && raceCfg.fromEditor;
  quitRace();
  if (!fromEditor) openMapSelect();
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
$('bar-menu').addEventListener('click', () => setPaused(true));
$('bar-sound').addEventListener('click', () => setPaused(true));
$('bar-restart').addEventListener('click', () => startRace(raceCfg));
$('bar-exit').addEventListener('click', () => quitRace());
$('pause-resume').addEventListener('click', () => setPaused(false));
$('pause-restart').addEventListener('click', () => startRace(raceCfg));
$('pause-quit').addEventListener('click', () => quitRace());

// ---------- track editor ----------

editor = new Editor({
  audio,
  onBack: () => showScreen('menu'),
  onTest: (mapDef) => startRace({
    mapDef, map: mapDef.id, season: selection.season, difficulty: selection.difficulty, laps: 3, net: null, fromEditor: true,
  }),
  onSaved: () => {},
});

// ---------- online ----------

const online = new Online();
let hostLobby = null;
let lastStartSeen = 0;
try {
  $('online-name').value = cleanName(localStorage.getItem('polyrush.name') || '');
} catch {
  // ignore
}

function fillSelect(el, items, value) {
  el.innerHTML = items.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
  el.value = String(value);
}
function refreshLobbyMaps(extra) {
  const el = $('lobby-map');
  const value = el.value || MAPS[0].id;
  const items = allMaps().map((m) => [m.id, m.custom ? `✏️ ${m.name}` : m.name]);
  if (extra && !items.some(([id]) => id === extra.id)) items.push([extra.id, `✏️ ${extra.name}`]);
  fillSelect(el, items, items.some(([id]) => id === value) ? value : MAPS[0].id);
}
refreshLobbyMaps();
fillSelect($('lobby-season'), Object.values(SEASONS).map((s) => [s.id, `${s.icon} ${s.name}`]), 'spring');
fillSelect($('lobby-laps'), [[1, '1 lap'], [3, '3 laps'], [5, '5 laps']], 3);

// A custom track arrives with the host's lobby; build it once per change.
let netTrackKey = '';
function validLobby(lb) {
  if (!lb || typeof lb !== 'object') return null;
  if (!SEASONS[lb.season] || ![1, 3, 5].includes(lb.laps)) return null;
  if (MAPS.some((m) => m.id === lb.map)) return lb;
  if (!lb.track || typeof lb.track !== 'object') return null;
  const key = JSON.stringify(lb.track);
  if (key !== netTrackKey) {
    netTrackKey = key;
    setNetMap({ ...lb.track, id: lb.map });
  }
  return findMap(lb.map) ? lb : null;
}

// Host: the lobby settings from the selects, carrying the track itself when it is a custom one.
function lobbyFromInputs(extra = {}) {
  const map = findMap($('lobby-map').value) || MAPS[0];
  return {
    ...(hostLobby || {}),
    map: map.id,
    season: $('lobby-season').value,
    laps: Number($('lobby-laps').value),
    track: map.custom ? map.source : null,
    ...extra,
  };
}

const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
const tallied = new Set();
// Host: add each player's finishing place from the latest race to the championship.
function tallyResults() {
  if (!online.isHost() || !hostLobby || !hostLobby.startId) return;
  let changed = false;
  const scores = { ...(hostLobby.scores || {}) };
  for (const p of online.players()) {
    const r = p.presence.res;
    if (!r || r.raceId !== hostLobby.startId || !Number.isInteger(r.place) || r.place < 1 || r.place > 8) continue;
    const key = p.peer + ':' + r.raceId;
    if (tallied.has(key)) continue;
    tallied.add(key);
    const name = cleanName(p.presence.name) || 'Racer';
    const s = scores[name] || { pts: 0, wins: 0 };
    scores[name] = { pts: s.pts + POINTS[r.place - 1], wins: s.wins + (r.place === 1 ? 1 : 0) };
    changed = true;
  }
  if (changed && Object.keys(scores).length <= 16) {
    hostLobby = { ...hostLobby, scores };
    online.set({ lobby: hostLobby });
  }
}

// claude.ai link when running there; otherwise this website's own address.
const INVITE_LINK = typeof window.POLYRUSH_LINK === 'string'
  ? window.POLYRUSH_LINK
  : /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? location.origin + location.pathname : '';
function inviteText(code) {
  return INVITE_LINK
    ? `Race me in PolyRush! ${INVITE_LINK}#race-${code.toLowerCase()} (code ${code})`
    : `Race me in PolyRush! Open the game, press Online and join with code ${code}`;
}
$('invite-copy').addEventListener('click', () => {
  const field = $('invite-text');
  const done = () => toast('Invite copied. Paste it to your friends!');
  const fallback = () => {
    field.focus();
    field.select();
    toast('Press Ctrl+C (or long-press) to copy the invite.');
  };
  try {
    navigator.clipboard.writeText(field.value).then(done, fallback);
  } catch {
    fallback();
  }
});

async function openOnline() {
  showScreen('online');
  refreshLobbyMaps();
  await online.ready;
  renderOnline();
}

function renderOnline() {
  if (currentScreen !== 'online') return;
  const avail = online.available;
  $('online-unavailable').classList.toggle('hidden', avail);
  $('online-home').classList.toggle('hidden', !avail || !!online.lobby);
  $('online-lobby').classList.toggle('hidden', !online.lobby);
  $('online-dot').classList.toggle('on', online.connected());
  if (!online.lobby) return;
  $('lobby-code').textContent = online.code;
  const host = online.host();
  const players = online.players();
  $('lobby-players').innerHTML = players.length
    ? players.map((p) => {
      const racing = p.presence.raceId && p.presence.st && !p.sameTab ? ' · racing' : '';
      return `<li class="${p.sameTab ? 'me' : ''}"><span>${esc(cleanName(p.presence.name) || 'Racer')}${p.sameTab ? ' (you)' : ''}</span>`
        + `<em>${p === host ? 'host' : ''}${racing}</em></li>`;
    }).join('')
    : '<li><em>Connecting…</em></li>';
  const amHost = online.isHost();
  for (const id of ['lobby-map', 'lobby-season', 'lobby-laps']) $(id).disabled = !amHost;
  const lb = amHost ? hostLobby : validLobby(host && host.presence.lobby);
  $('invite-text').value = inviteText(online.code);
  if (lb && !amHost) {
    if (![...$('lobby-map').options].some((o) => o.value === lb.map)) refreshLobbyMaps(findMap(lb.map));
    $('lobby-map').value = lb.map;
    $('lobby-season').value = lb.season;
    $('lobby-laps').value = String(lb.laps);
  }
  $('lobby-start').classList.toggle('hidden', !amHost);
  const scores = Object.entries((lb && lb.scores && typeof lb.scores === 'object') ? lb.scores : {})
    .filter(([, s]) => s && Number.isFinite(s.pts))
    .sort((a, b) => b[1].pts - a[1].pts);
  $('lobby-champ').classList.toggle('hidden', scores.length === 0);
  $('champ-table').innerHTML = scores
    .map(([name, s], i) => `<tr><td>${i + 1}</td><td>${esc(cleanName(name))}</td><td>🏆 ${Math.max(0, s.wins | 0)}</td><td>${Math.max(0, s.pts | 0)} pts</td></tr>`)
    .join('');
  $('lobby-status').textContent = amHost
    ? (players.length > 1 ? `${players.length} racers ready. Start when everyone is here!` : 'Waiting for friends to join with the code…')
    : 'Waiting for the host to start the race…';
}

function myPresence(host) {
  return { name: cleanName($('online-name').value) || 'Racer', host, eq: { ...profile.equipped }, raceId: null, st: null, hits: [], oil: [], used: [] };
}

function saveName() {
  try {
    localStorage.setItem('polyrush.name', cleanName($('online-name').value));
  } catch {
    // ignore
  }
}

$('online-create').addEventListener('click', async () => {
  audio.init();
  saveName();
  hostLobby = null;
  hostLobby = lobbyFromInputs({ startId: 0, grid: [], scores: {} });
  $('online-create').disabled = true;
  $('online-create').textContent = 'Creating…';
  // A code can already be in use by another race; try a few.
  let ok = false;
  for (let tries = 0; tries < 4 && !ok; tries++) {
    try {
      await online.join(randomCode(), { ...myPresence(true), lobby: hostLobby }, { create: true });
      ok = true;
    } catch (e) {
      if (!e || e.type !== 'unavailable-id') break;
    }
  }
  $('online-create').disabled = false;
  $('online-create').textContent = 'Create a race';
  if (!ok) toast('Could not create the race. Check your internet connection and try again.');
  lastStartSeen = 0;
  renderOnline();
});

$('online-join').addEventListener('click', async () => {
  audio.init();
  saveName();
  const code = cleanCode($('online-code').value);
  if (code.length < 4) {
    toast('Type the 4-letter race code your friend gave you.');
    return;
  }
  hostLobby = null;
  $('online-join').disabled = true;
  $('online-join').textContent = 'Joining…';
  try {
    await online.join(code, myPresence(false));
  } catch (e) {
    toast(e && e.type === 'peer-unavailable'
      ? `No race found with code ${code}. Check the code, and that the host is still in the lobby.`
      : 'Could not join that race. Check your internet connection and try again.');
  }
  $('online-join').disabled = false;
  $('online-join').textContent = 'Join';
  lastStartSeen = -1;
  renderOnline();
});

$('online-code').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('online-join').click();
});

for (const id of ['lobby-map', 'lobby-season', 'lobby-laps']) {
  $(id).addEventListener('change', () => {
    if (!online.isHost()) return;
    hostLobby = lobbyFromInputs();
    online.set({ lobby: hostLobby });
  });
}

$('lobby-start').addEventListener('click', () => {
  if (!online.isHost()) return;
  hostLobby = lobbyFromInputs({ startId: Date.now(), grid: online.players().map((p) => p.peer) });
  online.set({ lobby: hostLobby, host: true });
  lastStartSeen = hostLobby.startId;
  beginOnlineRace(hostLobby);
});

$('lobby-leave').addEventListener('click', async () => {
  await online.leave();
  renderOnline();
});
$('online-back').addEventListener('click', async () => {
  await online.leave();
  showScreen('menu');
});

function beginOnlineRace(lb) {
  startRace({
    map: lb.map,
    season: lb.season,
    laps: lb.laps,
    difficulty: 'normal',
    net: { online, raceId: lb.startId, grid: Array.isArray(lb.grid) ? lb.grid.map(String) : [], myPeer: online.me()?.peer || '' },
  });
}

// Follow the host: start when they start a new race.
function watchHost() {
  if (!online.lobby) return;
  const h = online.host();
  if (!h || h.sameTab) return;
  // A host who left hands over to us: keep their settings.
  const lb = validLobby(h.presence.lobby);
  const id = lb && typeof lb.startId === 'number' ? lb.startId : 0;
  if (lastStartSeen === -1) {
    lastStartSeen = id;
    return;
  }
  if (!id || id === lastStartSeen) return;
  lastStartSeen = id;
  const waiting = currentScreen === 'online' || (currentScreen === 'results' && race && race.net);
  if (waiting) beginOnlineRace(lb);
}

online.onChange(() => {
  if (!online.lobby && online.lostReason && online.mode === 'peer') {
    toast(online.lostReason);
    online.lostReason = '';
    if (race && race.net) quitRace();
  }
  watchHost();
  tallyResults();
  if (online.isHost() && !hostLobby) {
    const prev = online.players().find((p) => validLobby(p.presence.lobby));
    hostLobby = prev ? { ...prev.presence.lobby } : { map: MAPS[0].id, season: 'spring', laps: 3, startId: 0, grid: [], scores: {} };
    online.set({ lobby: hostLobby });
  }
  renderOnline();
});

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
const invited = /^#race-([a-z0-9]{4,6})$/i.exec(location.hash || '');
// Opening an invite link joins that race straight away, like tapping into a game.
if (invited) {
  const code = cleanCode(invited[1]);
  $('online-code').value = code;
  openOnline().then(() => {
    if (!online.available) return;
    if (!cleanName($('online-name').value)) $('online-name').value = `Racer ${Math.floor(10 + Math.random() * 90)}`;
    toast(`Joining race ${code}…`);
    $('online-join').click();
  });
}
showroom.setView('menu');
requestAnimationFrame(frame);
window.__game = { get race() { return race; }, profile, startRace, selection, music, audio };
