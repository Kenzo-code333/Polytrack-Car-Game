// Online races through the artifact viewer's `room` capability. Everything travels in
// presence (each player's own state object), so friends with view-only access can play too.
// Each race code is its own named room: "race-<code>".

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function cleanCode(text) {
  return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function cleanName(text) {
  return String(text || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').trim().slice(0, 16);
}

export class Online {
  constructor() {
    this.room = null;
    this.lobby = null;
    this.code = null;
    this.listeners = new Set();
    this.ready = this.init();
  }

  async init() {
    try {
      if (window.claude && typeof window.claude.use === 'function') this.room = await window.claude.use('room');
    } catch {
      this.room = null;
    }
    return !!this.room;
  }

  get available() {
    return !!this.room;
  }

  async join(code, presence) {
    await this.leave();
    this.lobby = await this.room.join('race-' + code.toLowerCase());
    this.code = code;
    this.unsub = this.lobby.onPeers(() => this.listeners.forEach((fn) => fn()), () => {
      this.lobby = null;
      this.listeners.forEach((fn) => fn());
    });
    await this.set(presence);
  }

  async leave() {
    if (this.unsub) this.unsub();
    this.unsub = null;
    const l = this.lobby;
    this.lobby = null;
    this.code = null;
    if (l) await l.leave().catch(() => {});
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  set(patch) {
    if (!this.lobby) return Promise.resolve();
    return this.lobby.presence(patch).catch(() => {});
  }

  connected() {
    return !!this.lobby && this.lobby.connected();
  }

  // Players who have announced themselves (a name in presence), sorted the same way on every page.
  players() {
    if (!this.lobby) return [];
    return this.lobby.peers()
      .filter((p) => p.kind === 'viewer' && p.presence && typeof p.presence.name === 'string')
      .slice()
      .sort((a, b) => (a.peer < b.peer ? -1 : a.peer > b.peer ? 1 : 0));
  }

  me() {
    return this.players().find((p) => p.sameTab) || null;
  }

  // The race creator hosts; if they leave, everyone agrees on the first remaining player.
  host() {
    const ps = this.players();
    return ps.find((p) => p.presence.host) || ps[0] || null;
  }

  isHost() {
    const h = this.host();
    return !!h && h.sameTab;
  }
}
