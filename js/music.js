// Procedural soundtrack: each track's tune (data.js TUNES) is composed from its key, scale,
// chord progression and style, then played live with Web Audio. No audio files needed.
import { TUNES, SCALES } from './data.js';

function rng(seedText) {
  let a = 2166136261;
  for (let i = 0; i < seedText.length; i++) a = Math.imul(a ^ seedText.charCodeAt(i), 16777619);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 16-step patterns per style: x = hit.
const STYLES = {
  pop: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.x.x.x.x.x.x.x.', density: 0.45 },
  synth: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'xxxxxxxxxxxxxxxx', density: 0.5 },
  rock: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.x.x.x.x.x.x.x.', density: 0.4 },
  funk: { kick: 'x..x..x...x..x..', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', bass: 'x..x..x.x.x..x..', density: 0.42 },
  tropical: { kick: 'x...x...x...x...', snare: '......x.......x.', hat: '..x...x...x...x.', bass: 'x..x..x.x..x..x.', density: 0.38 },
  chill: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x.......x.......', density: 0.3 },
};

function midiHz(m) {
  return 440 * 2 ** ((m - 69) / 12);
}

// A 16-bar song: intro (no melody), two main sections with melody A/B, then a lighter breakdown.
function compose(tune) {
  const r = rng(tune.name);
  const scale = SCALES[tune.scale] || SCALES.major;
  const style = STYLES[tune.style] || STYLES.pop;
  const note = (deg, octave = 0) => tune.root + octave * 12 + Math.floor(deg / 7) * 12 + scale[((deg % 7) + 7) % 7];
  const phrase = () => {
    const notes = [];
    let deg = 7 + Math.floor(r() * 3);
    for (let s = 0; s < 32; s++) {
      const strong = s % 4 === 0;
      if (r() < (strong ? style.density + 0.25 : style.density)) {
        deg += Math.round((r() - 0.5) * 4);
        deg = Math.max(4, Math.min(13, deg));
        const len = 1 + Math.floor(r() * (strong ? 4 : 2));
        notes.push({ s, deg, len });
        s += len - 1;
      }
    }
    return notes;
  };
  return { tune, style, note, melodyA: phrase(), melodyB: phrase(), stepDur: 60 / tune.bpm / 4 };
}

export class Music {
  constructor(sound) {
    this.sound = sound;
    this.wanted = 'menu';
    this.playing = null;
    this.timer = null;
    this.bus = null;
  }

  // `id` is a key of TUNES; unknown ids fall back to the menu tune.
  play(id) {
    this.wanted = TUNES[id] ? id : 'menu';
    if (this.sound.ctx && this.playing !== this.wanted) this.start(this.wanted);
  }

  // Called once audio is unlocked by the first click.
  resume() {
    if (this.sound.ctx && this.playing !== this.wanted) this.start(this.wanted);
  }

  start(id) {
    const ctx = this.sound.ctx;
    const song = compose(TUNES[id]);
    this.playing = id;
    clearInterval(this.timer);
    if (this.bus) {
      const old = this.bus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => old.disconnect(), 2000);
    }
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.gain.setTargetAtTime(1, ctx.currentTime + 0.1, 0.4);
    bus.connect(this.sound.musicGain);
    this.bus = bus;
    let step = 0;
    let next = ctx.currentTime + 0.15;
    this.timer = setInterval(() => {
      // After the tab was hidden, skip ahead instead of playing a burst of late notes.
      if (next < ctx.currentTime - 0.2) next = ctx.currentTime + 0.05;
      while (next < ctx.currentTime + 0.2) {
        this.playStep(song, step, next, bus);
        step++;
        next += song.stepDur;
      }
    }, 30);
  }

  playStep(song, step, t, bus) {
    const { tune, style, note, stepDur } = song;
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % 16;
    const chord = tune.prog[Math.floor(step / 16) % tune.prog.length];
    const intro = bar < 2;
    const breakdown = bar >= 12;

    if (style.kick[s16] === 'x' && !breakdown) this.kick(t, bus);
    if (style.snare[s16] === 'x' && !intro && !breakdown) this.snare(t, bus);
    if (style.hat[s16] === 'x') this.hat(t, bus, s16 % 8 === 6 && tune.style === 'rock');

    if (style.bass[s16] === 'x' && !intro) {
      const oct = tune.style === 'synth' && s16 % 2 ? -1 : -2;
      const deg = tune.style === 'rock' && s16 % 8 === 4 ? chord + 4 : chord;
      this.bass(t, midiHz(note(deg, oct)), stepDur * (style.bass === 'xxxxxxxxxxxxxxxx' ? 0.9 : 1.8), bus);
    }
    if (s16 === 0) {
      this.pad(t, [note(chord, -1), note(chord + 2, -1), note(chord + 4, -1)].map(midiHz), stepDur * 16, bus);
    }
    if (bar >= 4 && bar < 16) {
      const mel = bar % 4 < 2 ? song.melodyA : song.melodyB;
      const local = (bar % 2) * 16 + s16;
      for (const n of mel) {
        if (n.s === local) this.lead(t, midiHz(note(n.deg)), stepDur * n.len, bus, tune.lead, breakdown ? 0.6 : 1);
      }
    }
  }

  env(g, t, peak, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  kick(t, bus) {
    const ctx = this.sound.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.8, 0.005, 0.28);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.3);
  }

  noiseHit(t, bus, type, freq, peak, dur) {
    const ctx = this.sound.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.sound.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.003, dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  snare(t, bus) {
    this.noiseHit(t, bus, 'bandpass', 1800, 0.35, 0.16);
    const ctx = this.sound.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    this.env(g, t, 0.15, 0.003, 0.08);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.1);
  }

  hat(t, bus, open) {
    this.noiseHit(t, bus, 'highpass', 7500, open ? 0.08 : 0.06, open ? 0.18 : 0.04);
  }

  bass(t, hz, dur, bus) {
    const ctx = this.sound.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(250, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.22, 0.01, dur);
    o.connect(f).connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  pad(t, freqs, dur, bus) {
    const ctx = this.sound.ctx;
    for (const hz of freqs) {
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = hz;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.025, t + 0.3);
        g.gain.setValueAtTime(0.025, t + dur - 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + dur + 0.02);
      }
    }
  }

  lead(t, hz, dur, bus, type, level) {
    const ctx = this.sound.ctx;
    const o = ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.value = hz;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    const g = ctx.createGain();
    this.env(g, t, (type === 'triangle' ? 0.12 : 0.06) * level, 0.01, Math.max(0.08, dur * 0.95));
    o.connect(f).connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
