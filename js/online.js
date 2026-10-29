// Online races. Two ways to connect, with the same calls on top:
// - inside the claude.ai viewer: its `room` capability (each race code is a named room);
// - anywhere else (the public website): PeerJS, browser to browser. No accounts needed.
// Everything travels as presence: each player's own state object, shared with everyone.

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

const PEER_PREFIX = 'polyrush-v1-';
const MAX_PRESENCE = 8000;

function peerOptions() {
  return {
    debug: 0,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] },
    ...(window.POLYRUSH_PEER || {}),
  };
}

const isPresence = (p) => !!p && typeof p === 'object' && !Array.isArray(p) && JSON.stringify(p).length < MAX_PRESENCE;

// A race room over PeerJS. The host's browser is the hub: guests send it their presence, and it
// passes everyone's on. Offers the same calls as a claude.ai named room.
class PeerRoom {
  constructor() {
    this.mine = {};
    this.others = new Map(); // peer id -> frozen presence
    this.cache = new Map(); // peer id -> frozen Peer object, reused while presence is unchanged
    this.conns = new Map();
    this.listeners = new Set();
    this.errorListeners = new Set();
    this.snap = Object.freeze([]);
    this.alive = true;
    this.sendTimer = null;
  }

  static create(code) {
    return new Promise((resolve, reject) => {
      const r = new PeerRoom();
      r.isHost = true;
      const peer = new window.Peer(PEER_PREFIX + code.toLowerCase(), peerOptions());
      r.peer = peer;
      const timer = setTimeout(() => fail(Object.assign(new Error('timeout'), { type: 'timeout' })), 12000);
      const fail = (e) => {
        clearTimeout(timer);
        peer.destroy();
        reject(e);
      };
      peer.on('open', (id) => {
        clearTimeout(timer);
        r.myId = id;
        r.rebuild();
        resolve(r);
      });
      peer.on('error', (e) => (r.myId ? null : fail(e)));
      peer.on('connection', (conn) => r.acceptGuest(conn));
      // Keep the matchmaking link up so friends can still join; open races carry on regardless.
      peer.on('disconnected', () => r.alive && !peer.destroyed && peer.reconnect());
    });
  }

  static join(code) {
    return new Promise((resolve, reject) => {
      const r = new PeerRoom();
      r.isHost = false;
      const peer = new window.Peer(peerOptions());
      r.peer = peer;
      const timer = setTimeout(() => fail(Object.assign(new Error('not found'), { type: 'peer-unavailable' })), 15000);
      const fail = (e) => {
        clearTimeout(timer);
        peer.destroy();
        reject(e);
      };
      peer.on('error', (e) => (r.conn && r.conn.open ? null : fail(e)));
      peer.on('open', (id) => {
        r.myId = id;
        const conn = peer.connect(PEER_PREFIX + code.toLowerCase(), { reliable: true, serialization: 'json' });
        r.conn = conn;
        conn.on('open', () => {
          clearTimeout(timer);
          r.rebuild();
          r.flush();
          resolve(r);
        });
        conn.on('data', (m) => r.fromHost(m));
        conn.on('close', () => r.lost('The host left, so the race closed.'));
        conn.on('error', () => r.lost('Lost the connection to the host.'));
      });
    });
  }

  acceptGuest(conn) {
    conn.on('open', () => {
      if (!this.alive || this.conns.size >= 11) return conn.close();
      this.conns.set(conn.peer, conn);
      const peers = [[this.myId, this.mine], ...this.others];
      conn.send({ t: 'snap', peers });
    });
    conn.on('data', (m) => {
      if (!m || m.t !== 'p' || !isPresence(m.p)) return;
      this.others.set(conn.peer, Object.freeze(m.p));
      this.broadcast({ t: 'p', id: conn.peer, p: m.p }, conn.peer);
      this.rebuild();
    });
    const gone = () => {
      if (!this.conns.has(conn.peer)) return;
      this.conns.delete(conn.peer);
      this.others.delete(conn.peer);
      this.broadcast({ t: 'left', id: conn.peer });
      this.rebuild();
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  fromHost(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'snap' && Array.isArray(m.peers)) {
      this.others.clear();
      for (const [id, p] of m.peers.slice(0, 12)) if (typeof id === 'string' && id !== this.myId && isPresence(p)) this.others.set(id, Object.freeze(p));
    } else if (m.t === 'p' && typeof m.id === 'string' && m.id !== this.myId && isPresence(m.p)) {
      this.others.set(m.id, Object.freeze(m.p));
    } else if (m.t === 'left' && typeof m.id === 'string') {
      this.others.delete(m.id);
    } else {
      return;
    }
    this.rebuild();
  }

  broadcast(msg, except) {
    for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg);
  }

  // Send our latest presence at most 20 times a second.
  flush() {
    this.sendTimer = null;
    if (!this.alive) return;
    if (this.isHost) this.broadcast({ t: 'p', id: this.myId, p: this.mine });
    else if (this.conn && this.conn.open) this.conn.send({ t: 'p', p: this.mine });
  }

  presence(patch) {
    const next = { ...this.mine };
    for (const k in patch) {
      if (patch[k] === null) delete next[k];
      else next[k] = patch[k];
    }
    if (!isPresence(next)) return Promise.reject(Object.assign(new Error('presence too large'), { code: 'invalid_argument' }));
    this.mine = Object.freeze(next);
    if (!this.sendTimer) this.sendTimer = setTimeout(() => this.flush(), 50);
    this.rebuild();
    return Promise.resolve();
  }

  rebuild() {
    const make = (id, presence, me) => {
      const old = this.cache.get(id);
      if (old && old.presence === presence) return old;
      const obj = Object.freeze({ peer: id, by: null, isMe: me, sameTab: me, kind: 'viewer', guest: false, presence, updatedAt: Date.now() });
      this.cache.set(id, obj);
      return obj;
    };
    const list = [];
    if (this.myId) list.push(make(this.myId, this.mine, true));
    for (const [id, p] of this.others) list.push(make(id, p, false));
    for (const id of this.cache.keys()) if (id !== this.myId && !this.others.has(id)) this.cache.delete(id);
    this.snap = Object.freeze(list);
    const change = { peers: this.snap, joined: [], left: [], updated: [] };
    this.listeners.forEach((fn) => fn(change));
  }

  lost(reason) {
    if (!this.alive) return;
    this.alive = false;
    this.others.clear();
    this.peer.destroy();
    this.errorListeners.forEach((fn) => fn({ code: 'revoked', message: reason }));
  }

  peers() {
    return this.snap;
  }

  onPeers(fn, onError) {
    this.listeners.add(fn);
    if (onError) this.errorListeners.add(onError);
    setTimeout(() => fn({ peers: this.snap, joined: this.snap, left: [], updated: [] }));
    return () => {
      this.listeners.delete(fn);
      if (onError) this.errorListeners.delete(onError);
    };
  }

  connected() {
    return this.alive && (this.isHost ? !this.peer.destroyed : !!(this.conn && this.conn.open));
  }

  async leave() {
    this.alive = false;
    clearTimeout(this.sendTimer);
    this.peer.destroy();
  }
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
    // Outside claude.ai, connect browser to browser instead (the claude.ai viewer blocks this).
    this.mode = this.room ? 'room' : typeof window.Peer === 'function' && !window.POLYRUSH_LINK ? 'peer' : null;
    return this.available;
  }

  get available() {
    return !!this.mode;
  }

  // `create`: this player hosts the race. Rejects with `type: 'unavailable-id'` when a PeerJS
  // race code is already taken, and `type: 'peer-unavailable'` when no race has that code.
  async join(code, presence, { create = false } = {}) {
    await this.leave();
    this.lostReason = '';
    this.lobby = this.mode === 'room'
      ? await this.room.join('race-' + code.toLowerCase())
      : await (create ? PeerRoom.create(code) : PeerRoom.join(code));
    this.code = code;
    this.unsub = this.lobby.onPeers(() => this.listeners.forEach((fn) => fn()), (e) => {
      this.lobby = null;
      this.code = null;
      this.lostReason = (e && e.message) || 'The connection to the race was lost.';
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
