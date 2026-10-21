// Player profile persisted in localStorage.
import { DEFAULT_EQUIPPED, PARTS, PART_BY_ID } from './data.js';

const KEY = 'polyrush.save.v1';

function fresh() {
  const owned = {};
  for (const p of PARTS) if (p.price === 0 && !p.chest) owned[p.id] = true;
  return { coins: 150, owned, equipped: { ...DEFAULT_EQUIPPED }, best: {}, races: 0, wins: 0, chests: 0 };
}

function load() {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const data = JSON.parse(raw);
    const merged = { ...base, ...data, owned: { ...base.owned, ...data.owned }, equipped: { ...base.equipped, ...data.equipped } };
    // Drop anything that no longer exists or is not owned.
    for (const [cat, id] of Object.entries(merged.equipped)) {
      if (!PART_BY_ID[id] || !merged.owned[id]) merged.equipped[cat] = base.equipped[cat];
    }
    return merged;
  } catch {
    return base;
  }
}

export const profile = load();

export function saveProfile() {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable (private mode etc.) — progress lasts for this session only.
  }
}

export function addCoins(n) {
  profile.coins += n;
  saveProfile();
}

export function buyPart(id) {
  const part = PART_BY_ID[id];
  if (!part || part.chest || profile.owned[id] || profile.coins < part.price) return false;
  profile.coins -= part.price;
  profile.owned[id] = true;
  profile.equipped[part.cat] = id;
  saveProfile();
  return true;
}

export function equipPart(id) {
  const part = PART_BY_ID[id];
  if (!part || !profile.owned[id]) return false;
  profile.equipped[part.cat] = id;
  saveProfile();
  return true;
}

export function grantPart(id) {
  profile.owned[id] = true;
  saveProfile();
}

export function recordBest(key, time) {
  if (!profile.best[key] || time < profile.best[key]) {
    profile.best[key] = time;
    saveProfile();
    return true;
  }
  return false;
}
