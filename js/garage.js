// Garage screen: browse, preview, buy and equip car parts.
import { CATEGORIES, PARTS, PART_BY_ID, computeStats } from './data.js';
import { profile, buyPart, equipPart } from './save.js';

const $ = (id) => document.getElementById(id);

const STAT_RANGES = {
  speed: { name: 'Top Speed', min: 30, max: 60 },
  accel: { name: 'Acceleration', min: 12, max: 45 },
  turn: { name: 'Handling', min: 2.0, max: 3.0 },
  grip: { name: 'Grip', min: 5, max: 14 },
  nitro: { name: 'Nitro', min: 0.9, max: 1.9 },
};

function swatch(part) {
  const look = part.look || {};
  if (part.cat === 'paint') {
    if (look.rainbow) return '<span class="sw rainbow"></span>';
    return `<span class="sw" style="background:#${look.color.toString(16).padStart(6, '0')}"></span>`;
  }
  const c = look.glow ?? look.flame ?? look.rim ?? look.stripes;
  if (look.rainbow) return '<span class="sw rainbow"></span>';
  if (c !== undefined) return `<span class="sw" style="background:#${c.toString(16).padStart(6, '0')}"></span>`;
  return '';
}

function statText(part) {
  if (!part.stats) return '';
  const names = { speed: 'Speed', accel: 'Accel', turn: 'Handling', grip: 'Grip', nitro: 'Nitro', winter: 'Snow grip' };
  return Object.entries(part.stats)
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : ''}${k === 'turn' || k === 'nitro' || k === 'winter' ? Math.round(v * 100) + '%' : v} ${names[k]}</span>`)
    .join('');
}

export class Garage {
  constructor({ showroom, audio, onBack, onChange }) {
    this.showroom = showroom;
    this.audio = audio;
    this.onBack = onBack;
    this.onChange = onChange;
    this.cat = CATEGORIES[0].id;
    this.selected = null;
    $('garage-back').addEventListener('click', () => this.close());
    $('garage-action').addEventListener('click', () => this.action());
  }

  open() {
    this.preview = { ...profile.equipped };
    this.showroom.setCar(this.preview);
    this.showroom.setView('garage');
    this.renderTabs();
    this.selectCat(this.cat);
  }

  close() {
    this.showroom.setCar(profile.equipped);
    this.showroom.setView('menu');
    this.onBack();
  }

  renderTabs() {
    const tabs = $('garage-tabs');
    tabs.innerHTML = '';
    for (const c of CATEGORIES) {
      const b = document.createElement('button');
      b.className = 'tab' + (c.id === this.cat ? ' active' : '');
      b.innerHTML = `<span>${c.icon}</span>${c.name}`;
      b.addEventListener('click', () => {
        this.audio.play('click');
        this.selectCat(c.id);
      });
      tabs.appendChild(b);
    }
  }

  selectCat(id) {
    this.cat = id;
    [...$('garage-tabs').children].forEach((b, i) => b.classList.toggle('active', CATEGORIES[i].id === id));
    this.preview = { ...profile.equipped };
    this.showroom.setCar(this.preview);
    this.selected = profile.equipped[id];
    this.renderParts();
  }

  renderParts() {
    const grid = $('garage-parts');
    grid.innerHTML = '';
    for (const part of PARTS.filter((p) => p.cat === this.cat)) {
      const owned = !!profile.owned[part.id];
      const equipped = profile.equipped[part.cat] === part.id;
      const el = document.createElement('button');
      el.className = 'part' + (part.id === this.selected ? ' selected' : '') + (owned ? ' owned' : '') + (part.chest ? ' chest' : '');
      let tag;
      if (equipped) tag = '<em class="tag eq">Equipped</em>';
      else if (owned) tag = '<em class="tag own">Owned</em>';
      else if (part.chest) tag = '<em class="tag ch">🎁 Chest</em>';
      else tag = `<em class="tag price">🪙 ${part.price}</em>`;
      el.innerHTML = `<div class="pname">${swatch(part)}${part.name}</div><div class="pstats">${statText(part)}</div>${tag}`;
      el.addEventListener('click', () => {
        this.audio.play('click');
        this.selected = part.id;
        this.preview = { ...profile.equipped, [part.cat]: part.id };
        this.showroom.setCar(this.preview);
        this.renderParts();
      });
      grid.appendChild(el);
    }
    this.renderStats();
    this.renderAction();
    $('garage-coins').textContent = profile.coins;
  }

  renderStats() {
    const cur = computeStats(profile.equipped);
    const next = computeStats(this.preview);
    const box = $('garage-stats');
    box.innerHTML = '';
    for (const [k, r] of Object.entries(STAT_RANGES)) {
      const pct = (v) => Math.max(3, Math.min(100, ((v - r.min) / (r.max - r.min)) * 100));
      const a = pct(cur[k]);
      const b = pct(next[k]);
      const row = document.createElement('div');
      row.className = 'stat';
      row.innerHTML = `<label>${r.name}</label><div class="bar"><i style="width:${Math.min(a, b)}%"></i>${b > a ? `<i class="gain" style="left:${a}%;width:${b - a}%"></i>` : ''}${b < a ? `<i class="loss" style="left:${b}%;width:${a - b}%"></i>` : ''}</div>`;
      box.appendChild(row);
    }
  }

  renderAction() {
    const btn = $('garage-action');
    const part = PART_BY_ID[this.selected];
    btn.disabled = false;
    btn.className = 'btn primary';
    if (!part) {
      btn.textContent = 'Select a part';
      btn.disabled = true;
    } else if (profile.equipped[part.cat] === part.id) {
      btn.textContent = '✔ Equipped';
      btn.disabled = true;
    } else if (profile.owned[part.id]) {
      btn.textContent = 'Equip';
    } else if (part.chest) {
      btn.textContent = '🎁 Win races to find this in a treasure chest';
      btn.disabled = true;
      btn.className = 'btn chest';
    } else if (profile.coins < part.price) {
      btn.textContent = `Need 🪙 ${part.price - profile.coins} more coins`;
      btn.disabled = true;
    } else {
      btn.textContent = `Buy for 🪙 ${part.price}`;
      btn.className = 'btn buy';
    }
  }

  action() {
    const part = PART_BY_ID[this.selected];
    if (!part) return;
    if (profile.owned[part.id]) {
      equipPart(part.id);
      this.audio.play('click');
    } else if (buyPart(part.id)) {
      this.audio.play('buy');
    } else {
      this.audio.play('error');
      return;
    }
    this.preview = { ...profile.equipped };
    this.showroom.setCar(this.preview);
    this.renderParts();
    this.onChange();
  }
}
