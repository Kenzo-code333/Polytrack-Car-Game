// Procedurally generated canvas textures, so the game needs no image assets.
import * as THREE from 'three';

const cache = new Map();

function canvasTexture(key, w, h, draw, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

function noise(ctx, w, h, amount, alpha) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
    if (alpha) d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function asphaltTexture(icy) {
  return canvasTexture('asphalt' + (icy ? 'ice' : ''), 512, 512, (ctx, w, h) => {
    ctx.fillStyle = icy ? '#6d7886' : '#4a4d55';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 26, true);
    // Edge lines.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(w * 0.035, 0, w * 0.018, h);
    ctx.fillRect(w * 0.947, 0, w * 0.018, h);
    // Dashed centre line.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(w * 0.492, 0, w * 0.016, h * 0.5);
    if (icy) {
      ctx.fillStyle = 'rgba(230,245,255,0.25)';
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 4 + Math.random() * 10, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, { repeat: true });
}

export function curbTexture() {
  return canvasTexture('curb', 64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e0303a';
    ctx.fillRect(0, 0, w, h / 2);
  }, { repeat: true });
}

export function wallTexture(colors) {
  const [a, b] = colors.map((c) => '#' + c.toString(16).padStart(6, '0'));
  return canvasTexture('wall' + a + b, 128, 64, (ctx, w, h) => {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, h - 6, w, 6);
  }, { repeat: true });
}

export function checkerTexture() {
  return canvasTexture('checker', 256, 64, (ctx, w, h) => {
    const s = 32;
    for (let y = 0; y < h / s; y++) {
      for (let x = 0; x < w / s; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#111' : '#fff';
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
  }, { repeat: true });
}

export function boostPadTexture() {
  return canvasTexture('boostpad', 128, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#00e5ff');
    g.addColorStop(1, '#0066ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let k = 0; k < 3; k++) {
      const y = 30 + k * 75;
      ctx.beginPath();
      ctx.moveTo(w * 0.15, y + 40);
      ctx.lineTo(w * 0.5, y);
      ctx.lineTo(w * 0.85, y + 40);
      ctx.lineTo(w * 0.85, y + 62);
      ctx.lineTo(w * 0.5, y + 22);
      ctx.lineTo(w * 0.15, y + 62);
      ctx.closePath();
      ctx.fill();
    }
  });
}

export function rampTexture() {
  return canvasTexture('ramp', 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ffc81e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b1b1f';
    for (let k = 0; k < 2; k++) {
      const y = 40 + k * 128;
      ctx.beginPath();
      ctx.moveTo(w * 0.1, y + 70);
      ctx.lineTo(w * 0.5, y);
      ctx.lineTo(w * 0.9, y + 70);
      ctx.lineTo(w * 0.9, y + 100);
      ctx.lineTo(w * 0.5, y + 30);
      ctx.lineTo(w * 0.1, y + 100);
      ctx.closePath();
      ctx.fill();
    }
  }, { repeat: true });
}

export function itemBoxTexture() {
  return canvasTexture('itembox', 128, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,90,200,0.9)');
    g.addColorStop(0.5, 'rgba(120,120,255,0.9)');
    g.addColorStop(1, 'rgba(60,230,255,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 86px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', w / 2, h / 2 + 6);
  });
}

export function numberTexture(num) {
  return canvasTexture('num' + num, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), w / 2, h / 2 + 4);
  });
}

export function glowTexture() {
  return canvasTexture('glow', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function particleTexture(kind) {
  return canvasTexture('p_' + kind, 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    if (kind === 'petal') {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w * 0.42, h * 0.24, 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'leaf') {
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.05);
      ctx.quadraticCurveTo(w * 0.95, h * 0.5, w * 0.5, h * 0.95);
      ctx.quadraticCurveTo(w * 0.05, h * 0.5, w * 0.5, h * 0.05);
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

export function smokeTexture() {
  return canvasTexture('smoke', 64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
