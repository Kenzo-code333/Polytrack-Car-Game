// Garage screen: parts grouped into Performance / Looks / Extras, with filters, a details
// card for the selected part, and live stat bars.
import { CATEGORIES, PARTS, PART_BY_ID, computeStats } from './data.js';
import { profile, buyPart, equipPart } from './save.js';

const $ = (id) => document.getElementById(id);

const GROUPS = [
  { id: 'perf', name: 'Performance', hint: 'speed & handling', cats: ['engine', 'tires', 'nitro', 'body'] },
  { id: 'looks', name: 'Looks', hint: 'paint & shape', cats: ['paint', 'wheels', 'spoiler', 'decal'] },
  { id: 'extras', name: 'Extras', hint: 'fun add-ons', cats: ['exhaust', 'underglow', 'topper'] },
];

const STAT_RANGES = {
  speed: { name: 'Top Speed', min: 30, max: 60 },
  accel: { name: 'Acceleration', min: 12, max: 45 },
  turn: { name: 'Handling', min: 2.0, max: 3.0 },
  grip: { name: 'Grip', min: 5, max: 14 },
  nitro: { name: 'Nitro', min: 0.9, max: 1.9 },
};

function swatch(part) {
  const look = part.look || {};
  if (look.rainbow) return '<span class="sw rainbow"></span>';
  const c = part.cat === 'paint' ? look.color : look.glow ?? look.flame ?? look.rim ?? look.stripes;
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

// Owned parts first, then cheapest first, chest exclusives last.
function sortParts(a, b) {
  const rank = (p) => (profile.owned[p.id] ? 0 : p.chest ? 2 : 1);
  return rank(a) - rank(b) || (a.price || 0) - (b.price || 0);
}

export class Garage {
  constructor({ showroom, audio, onBack, onChange }) {
    this.showroom = showroom;
    this.audio = audio;
    this.onBack = onBack;
    this.onChange = onChange;
    this.group = 'perf';
    this.cat = 'engine';
    this.filter = 'all';
    this.selected = null;
    $('garage-back').addEventListener('click', () => this.close());
    $('garage-action').addEventListener('click', () => this.action());
    for (const b of document.querySelectorAll('.garage-filter button')) {
      b.addEventListener('click', () => {
        this.audio.play('click');
        this.filter = b.dataset.filter;
        for (const o of document.querySelectorAll('.garage-filter button')) o.classList.toggle('selected', o === b);
        this.renderParts();
      });
    }
    const seg = $('garage-groups');
    seg.innerHTML = GROUPS.map((g) => `<button role="tab" data-group="${g.id}">${g.name}<small>${g.hint}</small></button>`).join('');
    for (const b of seg.children) {
      b.addEventListener('click', () => {
        this.audio.play('click');
        this.selectGroup(b.dataset.group);
      });
    }
  }

  open() {
    this.preview = { ...profile.equipped };
    this.showroom.setCar(this.preview);
    this.showroom.setView('garage');
    this.selectGroup(this.group, this.cat);
  }

  close() {
    this.showroom.setCar(profile.equipped);
    this.showroom.setView('menu');
    this.onBack();
  }

  selectGroup(id, cat) {
    this.group = id;
    const g = GROUPS.find((x) => x.id === id);
    for (const b of $('garage-groups').children) {
      b.classList.toggle('active', b.dataset.group === id);
      b.setAttribute('aria-selected', b.dataset.group === id);
    }
    const tabs = $('garage-tabs');
    tabs.innerHTML = '';
    for (const cid of g.cats) {
      const c = CATEGORIES.find((x) => x.id === cid);
      const b = document.createElement('button');
      b.className = 'tab';
      b.dataset.cat = cid;
      b.innerHTML = `<span>${c.icon}</span>${c.name}`;
      b.addEventListener('click', () => {
        this.audio.play('click');
        this.selectCat(cid);
      });
      tabs.appendChild(b);
    }
    this.selectCat(cat && g.cats.includes(cat) ? cat : g.cats[0]);
  }

  selectCat(id) {
    this.cat = id;
    for (const b of $('garage-tabs').children) b.classList.toggle('active', b.dataset.cat === id);
    this.preview = { ...profile.equipped };
    this.showroom.setCar(this.preview);
    this.selected = profile.equipped[id];
    this.renderParts();
  }

  renderParts() {
    const grid = $('garage-parts');
    grid.innerHTML = '';
    let parts = PARTS.filter((p) => p.cat === this.cat).sort(sortParts);
    if (this.filter === 'owned') parts = parts.filter((p) => profile.owned[p.id]);
    if (this.filter === 'afford') parts = parts.filter((p) => !profile.owned[p.id] && !p.chest && p.price <= profile.coins);
    if (!parts.length) {
      grid.innerHTML = `<p class="hint">${this.filter === 'afford' ? 'Nothing new you can afford here yet. Race to earn more coins!' : 'No parts here yet.'}</p>`;
    }
    for (const part of parts) {
      const owned = !!profile.owned[part.id];
      const equipped = profile.equipped[part.cat] === part.id;
      const el = document.createElement('button');
      el.className = 'part' + (part.id === this.selected ? ' selected' : '') + (owned ? ' owned' : '') + (part.chest ? ' chest' : '');
      let tag;
      if (equipped) tag = '<em class="tag eq">✔ Equipped</em>';
      else if (owned) tag = '<em class="tag own">Owned</em>';
      else if (part.chest) tag = '<em class="tag ch">🎁 Chest only</em>';
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
    this.renderDetail();
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

  renderDetail() {
    const part = PART_BY_ID[this.selected];
    const btn = $('garage-action');
    const cat = part ? CATEGORIES.find((c) => c.id === part.cat) : null;
    $('detail-name').innerHTML = part ? `${swatch(part)} ${part.name}` : 'Pick a part';
    const perf = GROUPS[0].cats.includes(part?.cat);
    $('detail-stats').innerHTML = part ? statText(part) || `<span>${perf ? 'Standard part with no bonus' : 'Changes how your car looks'}</span>` : '';
    btn.disabled = false;
    btn.className = 'btn primary';
    let tag = '';
    if (!part) {
      btn.textContent = 'Select a part';
      btn.disabled = true;
    } else if (profile.equipped[part.cat] === part.id) {
      tag = 'Equipped';
      btn.textContent = '✔ Equipped';
      btn.disabled = true;
    } else if (profile.owned[part.id]) {
      tag = 'Owned';
      btn.textContent = 'Equip';
    } else if (part.chest) {
      tag = '🎁 Chest only';
      btn.textContent = 'Win races to find this in a treasure chest';
      btn.disabled = true;
      btn.className = 'btn chest';
    } else if (profile.coins < part.price) {
      tag = `🪙 ${part.price}`;
      btn.textContent = `Need 🪙 ${part.price - profile.coins} more coins`;
      btn.disabled = true;
    } else {
      tag = `🪙 ${part.price}`;
      btn.textContent = `Buy for 🪙 ${part.price}`;
      btn.className = 'btn buy';
    }
    $('detail-tag').textContent = tag;
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
