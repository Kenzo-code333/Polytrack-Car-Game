// Tiny synthesized sound engine (no audio files needed).
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineNodes = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, { type = 'sine', vol = 0.2, to = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.3, freq = 1200, to = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  play(name) {
    switch (name) {
      case 'coin':
        this.tone(1320, 0.08, { vol: 0.12, type: 'square' });
        this.tone(1980, 0.14, { vol: 0.1, type: 'square', delay: 0.06 });
        break;
      case 'item':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.1, { vol: 0.12, type: 'triangle', delay: i * 0.05 }));
        break;
      case 'boost':
        this.noise(0.7, { vol: 0.35, freq: 400, to: 4000 });
        this.tone(200, 0.6, { vol: 0.12, type: 'sawtooth', to: 800 });
        break;
      case 'mud':
        this.noise(0.4, { vol: 0.5, freq: 600, to: 120 });
        break;
      case 'throw':
        this.tone(500, 0.25, { vol: 0.12, type: 'triangle', to: 180 });
        break;
      case 'shield':
        this.tone(300, 0.5, { vol: 0.12, type: 'sine', to: 900 });
        break;
      case 'pop':
        this.tone(900, 0.15, { vol: 0.15, type: 'square', to: 200 });
        break;
      case 'oil':
        this.noise(0.3, { vol: 0.25, freq: 300 });
        break;
      case 'spin':
        this.tone(700, 0.6, { vol: 0.12, type: 'sawtooth', to: 120 });
        break;
      case 'hit':
        this.noise(0.15, { vol: 0.3, freq: 2000, to: 300 });
        break;
      case 'beep':
        this.tone(440, 0.22, { vol: 0.2, type: 'square' });
        break;
      case 'go':
        this.tone(880, 0.5, { vol: 0.22, type: 'square' });
        break;
      case 'lap':
        this.tone(660, 0.12, { vol: 0.15, type: 'triangle' });
        this.tone(990, 0.2, { vol: 0.15, type: 'triangle', delay: 0.1 });
        break;
      case 'win':
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.18, { vol: 0.15, type: 'triangle', delay: i * 0.12 }));
        break;
      case 'chest':
        this.noise(0.25, { vol: 0.3, freq: 800 });
        [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.25, { vol: 0.13, type: 'triangle', delay: 0.2 + i * 0.08 }));
        break;
      case 'click':
        this.tone(700, 0.05, { vol: 0.08, type: 'square' });
        break;
      case 'buy':
        this.tone(880, 0.08, { vol: 0.12, type: 'square' });
        this.tone(1320, 0.18, { vol: 0.12, type: 'square', delay: 0.08 });
        break;
      case 'error':
        this.tone(200, 0.2, { vol: 0.15, type: 'square' });
        break;
      default:
        break;
    }
  }

  engineStart() {
    if (!this.ctx || this.engineNodes) return;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    o1.connect(f);
    o2.connect(f);
    f.connect(g).connect(this.master);
    o1.start();
    o2.start();
    this.engineNodes = { o1, o2, f, g };
  }

  engine(speedNorm, throttle) {
    const n = this.engineNodes;
    if (!n) return;
    const t = this.ctx.currentTime;
    const freq = 55 + speedNorm * 150 + throttle * 12;
    n.o1.frequency.setTargetAtTime(freq, t, 0.05);
    n.o2.frequency.setTargetAtTime(freq * 0.5, t, 0.05);
    n.f.frequency.setTargetAtTime(500 + speedNorm * 1500 + throttle * 300, t, 0.05);
    n.g.gain.setTargetAtTime(0.035 + throttle * 0.03 + speedNorm * 0.02, t, 0.08);
  }

  engineStop() {
    const n = this.engineNodes;
    if (!n) return;
    n.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    setTimeout(() => {
      n.o1.stop();
      n.o2.stop();
    }, 300);
    this.engineNodes = null;
  }
}
