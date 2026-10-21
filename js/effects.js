// Pooled sprite particles: smoke, sparks, flames, coin sparkles, mud splats.
import * as THREE from 'three';
import { smokeTexture } from './textures.js';

export class Particles {
  constructor(scene, max = 320) {
    this.items = [];
    this.next = 0;
    for (let i = 0; i < max; i++) {
      const mat = new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      scene.add(s);
      this.items.push({ s, vel: new THREE.Vector3(), life: 0, max: 1, size: 1, grow: 1, gravity: 0 });
    }
  }

  spawn(pos, vel, { color = 0xffffff, size = 1, life = 0.8, grow = 1.5, additive = false, gravity = 0, opacity = 0.8 } = {}) {
    const p = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    p.s.position.copy(pos);
    p.vel.copy(vel);
    p.life = p.max = life;
    p.size = size;
    p.grow = grow;
    p.gravity = gravity;
    p.opacity = opacity;
    p.s.material.color.set(color);
    p.s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.s.visible = true;
    p.s.scale.setScalar(size);
  }

  burst(pos, n, opts, speed = 6) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.spawn(pos, v, opts);
    }
  }

  update(dt) {
    for (const p of this.items) {
      if (!p.s.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.s.position.addScaledVector(p.vel, dt);
      const k = 1 - p.life / p.max;
      p.s.scale.setScalar(p.size * (1 + (p.grow - 1) * k));
      p.s.material.opacity = p.opacity * (1 - k);
    }
  }
}
