// Studio scene used behind the main menu and in the garage.
import * as THREE from 'three';
import { buildCarModel, animateRainbow } from './car.js';

export class Showroom {
  constructor(renderer) {
    this.renderer = renderer;
    // Transparent: the page's dark background (and the big "RUSH" lettering) shows behind the car.
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 200);

    // Reflections from a simple light-box environment.
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x15171d);
    const panel = (w, h, pos, color, intensity) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(10, 3, new THREE.Vector3(0, 8, 0), 0xffffff, 3);
    panel(6, 4, new THREE.Vector3(8, 3, 4), 0xffffff, 1.6);
    panel(6, 4, new THREE.Vector3(-8, 3, -4), 0xffd27a, 1.4);
    panel(20, 2, new THREE.Vector3(0, 1, -10), 0xffffff, 1);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = pmrem.fromScene(env, 0.03);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    // Platform: a dark pad with a yellow ring and a dashed inner line, plus a shadow catcher.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.ShadowMaterial({ opacity: 0.45 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.table = new THREE.Group();
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 96),
      new THREE.MeshStandardMaterial({ color: 0x14171e, roughness: 0.85, transparent: true, opacity: 0.9 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.005;
    pad.receiveShadow = true;
    this.scene.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.035, 8, 128), new THREE.MeshBasicMaterial({ color: 0xffc21a }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);
    const dashPts = [];
    for (let k = 0; k <= 128; k++) {
      const a = (k / 128) * Math.PI * 2;
      dashPts.push(new THREE.Vector3(Math.cos(a) * 2.25, 0.02, Math.sin(a) * 2.25));
    }
    const dashed = new THREE.Line(new THREE.BufferGeometry().setFromPoints(dashPts), new THREE.LineDashedMaterial({ color: 0x3a3f4a, dashSize: 0.35, gapSize: 0.25 }));
    dashed.computeLineDistances();
    this.scene.add(dashed);
    this.scene.add(this.table);

    this.scene.add(new THREE.HemisphereLight(0xf2f4ff, 0x1a1c22, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(6, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -8;
    sc.right = sc.top = 8;
    this.scene.add(key);
    // Warm rim light from behind, picking out the car's outline against the dark page.
    const rim = new THREE.DirectionalLight(0xffd27a, 1.2);
    rim.position.set(-4, 5, -10);
    this.scene.add(rim);

    this.view = 'menu';
    this.camPos = new THREE.Vector3(8.5, 3.6, 9.5);
    this.camLook = new THREE.Vector3(0, 1, 0);
    this.camera.position.copy(this.camPos);
    this.spin = 0.5;
    this.snap = true; // first frame: jump straight to the view instead of gliding in
    this.time = 0;
    this.drag = null;

    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      if (this.active && this.view === 'garage') this.drag = { x: e.clientX };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.table.rotation.y += (e.clientX - this.drag.x) * 0.01;
      this.drag.x = e.clientX;
    });
    window.addEventListener('pointerup', () => (this.drag = null));
  }

  setCar(equipped) {
    if (this.model) {
      this.table.remove(this.model.root);
      this.model.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    this.model = buildCarModel(equipped);
    this.model.root.position.y = 0.02;
    this.model.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.table.add(this.model.root);
  }

  setView(view) {
    this.view = view;
    const narrow = innerWidth < 900;
    if (view === 'garage') {
      // Car sits left of centre, leaving room for the parts panel.
      this.camPos.set(narrow ? 0 : 1.6, narrow ? 5 : 3.4, narrow ? 15 : 13.5);
      this.camLook.set(narrow ? 0 : 3.4, narrow ? -2 : 0.8, 0);
    } else if (narrow) {
      // Phones: side view, car across the top of the screen, menu below.
      this.camPos.set(-17, 2, 0);
      this.camLook.set(0, -2.5, 0);
    } else {
      // Side-on hero shot: car on the right of the screen, nose pointing right.
      this.camPos.set(-10.5, 2.4, -2.2);
      this.camLook.set(0, 0.9, -2.2);
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.setView(this.view);
    this.snap = true;
  }

  update(dt) {
    this.time += dt;
    if (this.view === 'garage') {
      if (!this.drag) this.table.rotation.y += dt * 0.25;
    } else {
      // Menu: hold the side view, with a gentle sway so the car feels alive.
      const target = Math.sin(this.time * 0.45) * 0.22;
      this.table.rotation.y += (target - this.table.rotation.y) * Math.min(1, dt * 2);
    }
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 3);
    this.snap = false;
    this.camera.position.lerp(this.camPos, k);
    this.curLook = this.curLook || this.camLook.clone();
    this.curLook.lerp(this.camLook, k);
    this.camera.lookAt(this.curLook);
    if (this.model) {
      animateRainbow(this.model, this.time);
      for (const f of this.model.flames) {
        f.visible = this.view === 'garage';
        f.scale.set(1, 1, 0.7 + Math.random() * 0.5);
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
