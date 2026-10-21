// Studio scene used behind the main menu and in the garage.
import * as THREE from 'three';
import { buildCarModel, animateRainbow } from './car.js';

export class Showroom {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x151a2b);
    this.scene.fog = new THREE.Fog(0x151a2b, 18, 46);
    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);

    // Reflections from a simple light-box environment.
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x202434);
    const panel = (w, h, pos, color, intensity) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(10, 3, new THREE.Vector3(0, 8, 0), 0xffffff, 3);
    panel(6, 4, new THREE.Vector3(8, 3, 4), 0x9fd8ff, 2);
    panel(6, 4, new THREE.Vector3(-8, 3, -4), 0xffb0e0, 2);
    panel(20, 2, new THREE.Vector3(0, 1, -10), 0xffffff, 1);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = pmrem.fromScene(env, 0.03);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.MeshStandardMaterial({ color: 0x1c2236, roughness: 0.55, metalness: 0.3 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.table = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.4, 0.25, 64),
      new THREE.MeshStandardMaterial({ color: 0x2b3250, roughness: 0.3, metalness: 0.6 }),
    );
    disc.position.y = 0.12;
    disc.receiveShadow = true;
    this.table.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.3, 0.06, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x46d4ff }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    this.table.add(ring);
    this.scene.add(this.table);

    this.scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x20243a, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(6, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -8;
    sc.right = sc.top = 8;
    this.scene.add(key);
    const rimA = new THREE.PointLight(0x46d4ff, 40, 30);
    rimA.position.set(-6, 3, -5);
    const rimB = new THREE.PointLight(0xff5ac8, 40, 30);
    rimB.position.set(6, 3, -5);
    this.scene.add(rimA, rimB);

    this.view = 'menu';
    this.camPos = new THREE.Vector3(8.5, 3.6, 9.5);
    this.camLook = new THREE.Vector3(0, 1, 0);
    this.camera.position.copy(this.camPos);
    this.spin = 0.5;
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
    this.model.root.position.y = 0.25;
    this.model.root.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.table.add(this.model.root);
  }

  setView(view) {
    this.view = view;
    if (view === 'garage') {
      // Car sits left of centre, leaving room for the parts panel.
      const narrow = innerWidth < 800;
      this.camPos.set(narrow ? 0 : 1.6, narrow ? 4.5 : 3.2, narrow ? 12.5 : 10.5);
      this.camLook.set(narrow ? 0 : 2.8, narrow ? -1.2 : 0.9, 0);
    } else {
      this.camPos.set(8.5, 3.6, 9.5);
      this.camLook.set(0, 1, 0);
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.time += dt;
    if (!this.drag) this.table.rotation.y += dt * (this.view === 'garage' ? 0.25 : 0.45);
    const k = 1 - Math.exp(-dt * 3);
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
