// Particles: smoke, sparks, flames, coin sparkles, mud splats. Two point clouds (normal and
// additive blending) hold every particle, so all effects cost two draw calls. Point size is
// capped so smoke right in front of the camera can't fill the whole screen.
import * as THREE from 'three';
import { smokeTexture } from './textures.js';

const vert = `
attribute float size;
attribute float alpha;
attribute vec3 tint;
varying float vAlpha;
varying vec3 vTint;
uniform float scale;
uniform float maxSize;
void main() {
  vAlpha = alpha;
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(maxSize, size * scale / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const frag = `
uniform sampler2D map;
varying float vAlpha;
varying vec3 vTint;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  if (t.a * vAlpha < 0.01) discard;
  gl_FragColor = vec4(vTint, t.a * vAlpha);
  #include <colorspace_fragment>
}`;

class Cloud {
  constructor(scene, max, additive) {
    this.max = max;
    this.next = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.tint = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.opacity = new Float32Array(max);
    this.live = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { map: { value: smokeTexture() }, scale: { value: 600 }, maxSize: { value: 140 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(p, v, o) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    _c.set(o.color ?? 0xffffff);
    this.tint.set([_c.r, _c.g, _c.b], i * 3);
    this.life[i] = this.maxLife[i] = o.life ?? 0.8;
    this.baseSize[i] = this.size[i] = o.size ?? 1;
    this.grow[i] = o.grow ?? 1.5;
    this.gravity[i] = o.gravity ?? 0;
    this.opacity[i] = this.alpha[i] = o.opacity ?? 0.8;
  }

  update(dt) {
    let live = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      live++;
      const j = i * 3;
      this.vel[j + 1] -= this.gravity[i] * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const k = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = this.baseSize[i] * (1 + (this.grow[i] - 1) * k);
      this.alpha[i] = this.opacity[i] * (1 - k);
    }
    // Skip the upload entirely when nothing is alive.
    if (live || this.live) {
      for (const name of ['position', 'tint', 'size', 'alpha']) this.geo.attributes[name].needsUpdate = true;
    }
    this.live = live;
  }
}

const _c = new THREE.Color();

export class Particles {
  constructor(scene, max = 320) {
    this.normal = new Cloud(scene, max, false);
    this.additive = new Cloud(scene, Math.round(max * 0.75), true);
  }

  // Sizes are in world metres; the shader turns them into pixels for this camera and screen.
  setViewport(bufferHeight, fovDeg, pixelRatio) {
    const scale = bufferHeight / (2 * Math.tan((fovDeg * Math.PI) / 360));
    for (const c of [this.normal, this.additive]) {
      c.material.uniforms.scale.value = scale;
      c.material.uniforms.maxSize.value = 110 * pixelRatio;
    }
  }

  spawn(pos, vel, opts = {}) {
    (opts.additive ? this.additive : this.normal).spawn(pos, vel, opts);
  }

  burst(pos, n, opts, speed = 6) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.spawn(pos, v, opts);
    }
  }

  update(dt) {
    this.normal.update(dt);
    this.additive.update(dt);
  }
}
