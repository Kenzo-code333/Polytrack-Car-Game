// Car model built from equipped parts, plus arcade driving physics.
import * as THREE from 'three';
import { PART_BY_ID, computeStats } from './data.js';
import { glowTexture, numberTexture } from './textures.js';

const BODIES = {
  classic: {
    body: [[-2.1, 0.38], [2.05, 0.38], [2.15, 0.78], [1.2, 0.98], [-1.95, 1.02], [-2.15, 0.82]],
    cabin: [[-1.25, 0.95], [0.85, 0.95], [0.3, 1.58], [-0.95, 1.58]],
    width: 1.85, cabinWidth: 1.5, wheelZ: 1.32, wheelR: 0.42, wheelX: 1.0, roof: 1.62, roofZ: -0.35, hood: [1.25, 0.98], rear: -2.12,
  },
  sport: {
    body: [[-2.1, 0.32], [2.15, 0.32], [2.3, 0.56], [1.0, 0.86], [-2.0, 0.92], [-2.2, 0.7]],
    cabin: [[-0.95, 0.86], [0.8, 0.86], [0.12, 1.32], [-0.8, 1.34]],
    width: 1.9, cabinWidth: 1.45, wheelZ: 1.38, wheelR: 0.4, wheelX: 1.02, roof: 1.36, roofZ: -0.35, hood: [1.35, 0.86], rear: -2.15,
  },
  buggy: {
    body: [[-1.65, 0.62], [1.75, 0.62], [1.9, 0.98], [0.9, 1.06], [-1.55, 1.1], [-1.75, 0.92]],
    cabin: [[-1.0, 1.05], [0.6, 1.05], [0.25, 1.62], [-0.8, 1.66]],
    width: 1.7, cabinWidth: 1.35, wheelZ: 1.18, wheelR: 0.55, wheelX: 1.12, roof: 1.7, roofZ: -0.3, hood: [1.2, 1.05], rear: -1.7,
  },
  muscle: {
    body: [[-2.25, 0.42], [2.2, 0.42], [2.28, 0.98], [0.75, 1.08], [-2.2, 1.08], [-2.28, 0.82]],
    cabin: [[-1.35, 1.05], [0.5, 1.05], [0.0, 1.6], [-1.15, 1.62]],
    width: 2.0, cabinWidth: 1.6, wheelZ: 1.42, wheelR: 0.45, wheelX: 1.08, roof: 1.66, roofZ: -0.55, hood: [1.4, 1.08], rear: -2.26,
  },
  kart: {
    body: [[-1.2, 0.22], [1.3, 0.22], [1.42, 0.42], [0.6, 0.5], [-1.1, 0.56], [-1.25, 0.44]],
    cabin: [[-0.75, 0.5], [0.05, 0.5], [-0.15, 0.98], [-0.62, 1.02]],
    width: 1.25, cabinWidth: 0.75, wheelZ: 0.85, wheelR: 0.3, wheelX: 0.78, roof: 1.02, roofZ: -0.4, hood: [0.9, 0.5], rear: -1.22,
  },
  retro: {
    body: [[-1.9, 0.4], [1.9, 0.4], [2.02, 0.72], [1.25, 0.98], [-1.6, 1.0], [-2.0, 0.75]],
    cabin: [[-1.3, 0.95], [1.0, 0.95], [0.72, 1.42], [0.2, 1.7], [-0.62, 1.72], [-1.12, 1.42]],
    width: 1.85, cabinWidth: 1.5, wheelZ: 1.25, wheelR: 0.42, wheelX: 1.0, roof: 1.72, roofZ: -0.2, hood: [1.3, 0.98], rear: -1.98,
  },
  pickup: {
    body: [[-2.35, 0.52], [2.2, 0.52], [2.3, 1.02], [1.35, 1.12], [-2.35, 1.12], [-2.4, 0.82]],
    cabin: [[-0.55, 1.08], [1.0, 1.08], [0.68, 1.8], [-0.48, 1.82]],
    width: 2.0, cabinWidth: 1.7, wheelZ: 1.5, wheelR: 0.5, wheelX: 1.08, roof: 1.82, roofZ: 0.1, hood: [1.4, 1.12], rear: -2.38,
  },
  rally: {
    body: [[-1.9, 0.42], [2.0, 0.42], [2.12, 0.8], [1.2, 0.96], [-1.85, 1.0], [-1.96, 0.8]],
    cabin: [[-1.75, 0.95], [0.75, 0.95], [0.18, 1.6], [-1.68, 1.62]],
    width: 1.9, cabinWidth: 1.55, wheelZ: 1.28, wheelR: 0.44, wheelX: 1.04, roof: 1.62, roofZ: -0.7, hood: [1.25, 0.96], rear: -1.95,
  },
  monster: {
    body: [[-2.0, 1.12], [2.0, 1.12], [2.12, 1.52], [1.0, 1.62], [-2.0, 1.62], [-2.12, 1.38]],
    cabin: [[-1.1, 1.58], [0.62, 1.58], [0.2, 2.18], [-1.0, 2.2]],
    width: 2.0, cabinWidth: 1.6, wheelZ: 1.38, wheelR: 0.88, wheelX: 1.3, roof: 2.2, roofZ: -0.4, hood: [1.1, 1.62], rear: -2.08,
  },
  cyber: {
    body: [[-2.3, 0.45], [2.3, 0.45], [2.38, 0.85], [0.1, 1.72], [-2.3, 1.15], [-2.36, 0.8]],
    cabin: [[-0.55, 1.22], [1.1, 1.22], [0.18, 1.62], [-0.4, 1.62]],
    width: 2.0, cabinWidth: 1.85, wheelZ: 1.5, wheelR: 0.46, wheelX: 1.08, roof: 1.62, roofZ: -0.1, hood: [1.2, 1.3], rear: -2.32,
  },
  f1: {
    body: [[-2.3, 0.24], [2.5, 0.24], [2.62, 0.34], [0.8, 0.6], [-1.2, 0.76], [-2.3, 0.6]],
    cabin: [[-0.95, 0.7], [0.15, 0.62], [-0.22, 0.96], [-0.82, 0.98]],
    width: 1.05, cabinWidth: 0.68, wheelZ: 1.62, wheelR: 0.46, wheelX: 1.0, roof: 0.98, roofZ: -0.5, hood: [1.5, 0.5], rear: -2.3,
  },
  hyper: {
    body: [[-2.2, 0.26], [2.3, 0.26], [2.42, 0.44], [0.6, 0.8], [-1.6, 0.88], [-2.25, 0.62]],
    cabin: [[-0.85, 0.76], [0.95, 0.7], [0.05, 1.16], [-0.7, 1.2]],
    width: 2.0, cabinWidth: 1.4, wheelZ: 1.45, wheelR: 0.42, wheelX: 1.08, roof: 1.22, roofZ: -0.3, hood: [1.4, 0.7], rear: -2.22,
  },
};

function profileGeometry(points, width, bevel) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const depth = Math.max(0.1, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 4,
  });
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

function makeWheel(look, radius) {
  const r = radius * (look.scale || 1);
  const w = 0.36 * (look.scale || 1);
  const g = new THREE.Group();
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, w, 24),
    new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.9 }),
  );
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  const rimMat = new THREE.MeshStandardMaterial({
    color: look.rim, metalness: look.metal ? 1 : 0.7, roughness: look.metal ? 0.2 : 0.35,
    emissive: look.glow ? look.rim : 0x000000, emissiveIntensity: look.glow ? 1.6 : 0,
  });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 20), rimMat);
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  if (look.style !== 'disc') {
    const spokes = look.style === 'chunky' ? 4 : 5;
    for (let k = 0; k < spokes; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, r * 1.1, look.style === 'chunky' ? 0.16 : 0.09), rimMat);
      s.rotation.x = (k / spokes) * Math.PI;
      g.add(s);
    }
  }
  return { group: g, radius: r };
}

function makeFlame(color) {
  const geo = new THREE.ConeGeometry(0.16, 1.1, 10, 1, true);
  geo.translate(0, -0.55, 0);
  geo.rotateX(-Math.PI / 2); // point backwards (-z)
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}

// Builds the visual model. Returns references used for animation.
export function buildCarModel(equipped, opts = {}) {
  const part = (cat) => PART_BY_ID[equipped[cat]] || {};
  const paint = part('paint').look || { color: 0xe63946 };
  const shape = BODIES[(part('body').look || {}).shape || 'classic'];
  const wheelsLook = part('wheels').look || { rim: 0xcccccc, style: 'disc' };
  const engineLook = part('engine').look || {};
  const spoilerLook = part('spoiler').look || { type: 'none' };
  const exhaustLook = part('exhaust').look || { flame: 0xff8a2a };
  const glowLook = part('underglow').look || {};
  const decalLook = part('decal').look || {};
  const topLook = part('topper').look || {};

  const root = new THREE.Group();
  const body = new THREE.Group(); // tilts and rolls
  root.add(body);
  const rainbowMats = [];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: paint.color, metalness: paint.metalness ?? 0.35, roughness: paint.roughness ?? 0.32,
    clearcoat: 1, clearcoatRoughness: 0.08,
  });
  if (paint.rainbow) rainbowMats.push({ mat: paintMat, key: 'color', offset: 0 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1d1f25, roughness: 0.5, metalness: 0.3 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0d1a2b, metalness: 0.2, roughness: 0.05, clearcoat: 1 });

  const shell = new THREE.Mesh(profileGeometry(shape.body, shape.width, 0.14), paintMat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);
  const cabin = new THREE.Mesh(profileGeometry(shape.cabin, shape.cabinWidth, 0.12), glassMat);
  cabin.castShadow = true;
  body.add(cabin);
  // Painted roof slab over the glass.
  const roofPts = [...shape.cabin].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const roofY = Math.max(roofPts[0][1], roofPts[1][1]) + 0.1;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(shape.cabinWidth - 0.05, 0.08, Math.abs(roofPts[0][0] - roofPts[1][0]) + 0.25), paintMat);
  roof.position.set(0, roofY, (roofPts[0][0] + roofPts[1][0]) / 2);
  body.add(roof);

  // Bumpers, lights, grille.
  const frontZ = shape.body[2][0];
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(shape.width + 0.05, 0.2, 0.25), trimMat);
  bumperF.position.set(0, shape.body[0][1] + 0.08, frontZ - 0.05);
  body.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = shape.rear + 0.05;
  body.add(bumperR);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 1.0 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.08), headMat);
    hl.position.set(s * (shape.width / 2 - 0.35), shape.body[2][1] - 0.12, frontZ - 0.04);
    body.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.13, 0.08), tailMat);
    tl.position.set(s * (shape.width / 2 - 0.33), shape.body[5][1] - 0.05, shape.rear - 0.04);
    body.add(tl);
  }

  // Wheels.
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    const w = makeWheel(wheelsLook, shape.wheelR);
    pivot.position.set(sx * shape.wheelX, w.radius, sz * shape.wheelZ);
    pivot.add(w.group);
    root.add(pivot);
    wheels.push({ pivot, spin: w.group, front: sz > 0, radius: w.radius });
  }
  // Engine visuals.
  const [hoodZ, hoodY] = shape.hood;
  if (engineLook.scoop) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.8), trimMat);
    scoop.position.set(0, hoodY + 0.12, hoodZ - 0.25);
    body.add(scoop);
  }
  if (engineLook.blower) {
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.15 });
    const blower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.6), chromeMat);
    blower.position.set(0, hoodY + 0.2, hoodZ - 0.3);
    body.add(blower);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.3), trimMat);
    intake.position.set(0, hoodY + 0.48, hoodZ - 0.3);
    body.add(intake);
  }

  // Spoilers.
  const rearTop = shape.body[4][1];
  const wingMat = spoilerLook.type === 'dragon'
    ? new THREE.MeshStandardMaterial({ color: 0x8b0000, emissive: 0x330000, metalness: 0.5, roughness: 0.3 })
    : trimMat;
  const addWing = (y, z, w, d) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), wingMat);
    wing.position.set(0, y, z);
    wing.rotation.x = -0.08;
    wing.castShadow = true;
    body.add(wing);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, y - rearTop, 0.2), trimMat);
      post.position.set(s * w * 0.32, (y + rearTop) / 2, z);
      body.add(post);
    }
  };
  const rz = shape.rear + 0.35;
  if (spoilerLook.type === 'duck') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(shape.width - 0.1, 0.12, 0.3), paintMat);
    lip.position.set(0, rearTop + 0.06, rz - 0.05);
    lip.rotation.x = -0.35;
    body.add(lip);
  } else if (spoilerLook.type === 'gt') {
    addWing(rearTop + 0.45, rz, shape.width + 0.1, 0.45);
  } else if (spoilerLook.type === 'twin') {
    addWing(rearTop + 0.4, rz, shape.width + 0.1, 0.38);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(shape.width + 0.1, 0.06, 0.3), trimMat);
    upper.position.set(0, rearTop + 0.62, rz - 0.1);
    body.add(upper);
  } else if (spoilerLook.type === 'dragon') {
    addWing(rearTop + 0.55, rz, shape.width + 0.5, 0.6);
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 4), wingMat);
      fin.position.set(s * (shape.width / 2 + 0.2), rearTop + 0.85, rz);
      fin.rotation.z = -s * 0.3;
      body.add(fin);
    }
  }

  // Exhaust tips and boost flames.
  const flames = [];
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 1, roughness: 0.25 });
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 12), tipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(s * 0.45, shape.body[0][1] + 0.12, shape.rear - 0.08);
    body.add(tip);
    const f = makeFlame(exhaustLook.flame);
    f.position.set(s * 0.45, shape.body[0][1] + 0.12, shape.rear - 0.2);
    f.visible = false;
    body.add(f);
    flames.push(f);
    if (exhaustLook.rainbow) rainbowMats.push({ mat: f.material, key: 'color', offset: s * 0.2 });
  }

  // Underglow.
  let glow = null;
  if (glowLook.glow !== undefined) {
    const gm = new THREE.MeshBasicMaterial({
      map: glowTexture(), color: glowLook.glow, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    glow = new THREE.Mesh(new THREE.PlaneGeometry(shape.width + 2.4, 5.6), gm);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.06;
    root.add(glow);
    if (glowLook.rainbow) rainbowMats.push({ mat: gm, key: 'color', offset: 0.5 });
  }

  // Decals.
  if (decalLook.stripes !== undefined) {
    const sm = new THREE.MeshStandardMaterial({
      color: decalLook.stripes, roughness: 0.3, metalness: decalLook.metal ? 0.6 : 0.1,
      emissive: decalLook.metal ? 0x664400 : 0x000000,
    });
    for (const s of [-0.22, 0.22]) {
      const [z2, y2] = shape.body[2];
      const [z3, y3] = shape.body[3];
      const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, Math.hypot(z2 - z3, y2 - y3)), sm);
      hoodStripe.position.set(s, (y2 + y3) / 2 + 0.125, (z2 + z3) / 2);
      hoodStripe.rotation.x = -Math.atan2(y2 - y3, z2 - z3);
      body.add(hoodStripe);
      const roofStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, roof.geometry.parameters.depth), sm);
      roofStripe.position.set(s, roofY + 0.05, roof.position.z);
      body.add(roofStripe);
    }
  }
  if (decalLook.side !== undefined) {
    const sm = new THREE.MeshStandardMaterial({ color: decalLook.side, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, Math.abs(frontZ - shape.rear) - 0.6), sm);
      stripe.position.set(s * (shape.width / 2 + 0.005), (shape.body[0][1] + shape.body[3][1]) / 2 + 0.05, (frontZ + shape.rear) / 2);
      body.add(stripe);
    }
  }
  if (decalLook.number) {
    const nm = new THREE.MeshStandardMaterial({ map: numberTexture(opts.number || 7), transparent: true, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), nm);
      plate.position.set(s * (shape.width / 2 + 0.01), (shape.body[0][1] + shape.body[3][1]) / 2 + 0.05, -0.1);
      plate.rotation.y = s * Math.PI / 2;
      body.add(plate);
    }
  }

  // Toppers.
  const topY = roofY + 0.04;
  const topZ = roof.position.z;
  if (topLook.kind === 'antenna') {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), trimMat);
    rod.position.set(0.4, topY + 0.45, topZ - 0.4);
    body.add(rod);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.4 }));
    ball.position.set(0.4, topY + 0.92, topZ - 0.4);
    body.add(ball);
  } else if (topLook.kind === 'cone') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.5 }));
    cone.position.set(0, topY + 0.3, topZ);
    cone.castShadow = true;
    body.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.165, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    band.position.set(0, topY + 0.3, topZ);
    body.add(band);
  } else if (topLook.kind === 'fin') {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 3), paintMat);
    fin.scale.set(0.25, 1, 1.4);
    fin.position.set(0, topY + 0.3, topZ - 0.1);
    body.add(fin);
  } else if (topLook.kind === 'duck') {
    const yellow = new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.35 });
    const duck = new THREE.Group();
    const dbody = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), yellow);
    dbody.scale.set(1, 0.8, 1.25);
    duck.add(dbody);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), yellow);
    head.position.set(0, 0.3, 0.17);
    duck.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xff7a1a }));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.29, 0.38);
    duck.add(beak);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      eye.position.set(s * 0.09, 0.36, 0.32);
      duck.add(eye);
    }
    duck.position.set(0, topY + 0.22, topZ);
    duck.traverse((o) => (o.castShadow = true));
    body.add(duck);
  } else if (topLook.kind === 'crown') {
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.2 });
    const crown = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 20, 1, true), gold);
    ring.material.side = THREE.DoubleSide;
    crown.add(ring);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 6), gold);
      spike.position.set(Math.cos(a) * 0.3, 0.22, Math.sin(a) * 0.3);
      crown.add(spike);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({
        color: [0xff2d55, 0x2d9bff, 0x2dff8a][k % 3], emissive: [0xff2d55, 0x2d9bff, 0x2dff8a][k % 3], emissiveIntensity: 0.5,
      }));
      gem.position.set(Math.cos(a) * 0.33, 0.02, Math.sin(a) * 0.33);
      crown.add(gem);
    }
    crown.position.set(0, topY + 0.1, topZ);
    body.add(crown);
  }

  // Shield bubble and mud splotches (hidden until used).
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 32, 18),
    new THREE.MeshPhysicalMaterial({
      color: 0x66ccff, emissive: 0x2288ff, emissiveIntensity: 0.4, transparent: true, opacity: 0.28,
      roughness: 0.1, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  shield.scale.set(1, 0.62, 1);
  shield.position.y = 0.9;
  shield.visible = false;
  root.add(shield);
  const mud = new THREE.Group();
  const mudMat = new THREE.MeshStandardMaterial({ color: 0x5a3b1e, roughness: 1 });
  for (let k = 0; k < 9; k++) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.25, 10, 8), mudMat);
    blob.scale.y = 0.35;
    blob.position.set((Math.random() - 0.5) * shape.width, shape.body[3][1] + 0.1 + Math.random() * 0.4, (Math.random() - 0.5) * 3.2);
    mud.add(blob);
  }
  mud.visible = false;
  body.add(mud);

  return { root, body, wheels, flames, glow, shield, mud, rainbowMats, shape };
}

// See-through while the Ghost power-up is active.
export function setGhost(model, on) {
  if (model.ghost === on) return;
  model.ghost = on;
  if (!model.solid) {
    model.solid = [];
    model.root.traverse((o) => {
      for (const m of o.material ? [].concat(o.material) : []) {
        if (!m.transparent && !model.solid.includes(m)) model.solid.push(m);
      }
    });
  }
  for (const m of model.solid) {
    m.transparent = on;
    m.opacity = on ? 0.35 : 1;
    m.depthWrite = !on;
    m.needsUpdate = true;
  }
}

export function animateRainbow(model, time) {
  for (const r of model.rainbowMats) r.mat[r.key].setHSL((time * 0.15 + r.offset) % 1, 0.85, 0.55);
}

const UP = new THREE.Vector3(0, 1, 0);
const GRAVITY = 26;

export class Car {
  constructor(equipped, track, opts = {}) {
    this.equipped = equipped;
    this.track = track;
    this.stats = computeStats(equipped);
    if (opts.statScale) {
      this.stats.speed *= opts.statScale;
      this.stats.accel *= opts.statScale;
    }
    this.model = buildCarModel(equipped, opts);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.steerVis = 0;
    this.roll = 0;
    this.pitch = 0;
    this.input = { throttle: 0, brake: 0, steer: 0 };
    this.proj = {};
    this.hint = -1;
    this.speed = 0;
    this.lateral = 0;
    this.wallHit = 0;
    this.grip = 1;
    this.slip = 0;
    this.yawRate = 0;
    this.vy = 0;
    this.groundY = 0;
    this.airborne = false;
    this.airTime = 0;
    this.landed = 0;
  }

  placeAt(f, lat) {
    const fr = this.track.frameAt(f);
    this.pos.copy(fr.point).addScaledVector(fr.right, lat);
    this.heading = Math.atan2(fr.tangent.x, fr.tangent.z);
    this.vel.set(0, 0, 0);
    this.yawRate = 0;
    this.hint = Math.floor(f);
    this.track.project(this.pos, this.hint, this.proj);
    this.pos.y = this.proj.point.y;
    this.vy = 0;
    this.groundY = this.pos.y;
    this.airborne = false;
    this.airTime = 0;
  }

  // env: { seasonGrip, winter, boost, mud, spin, speedScale }
  step(dt, env) {
    const st = this.stats;
    const inp = this.input;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = -fz;
    const rz = fx;
    let vf = this.vel.x * fx + this.vel.z * fz;
    let vl = this.vel.x * rx + this.vel.z * rz;
    if (this.airborne) return this.stepAir(dt);

    const boostMul = env.boost ? 1.32 + 0.12 * (st.nitro - 1) : 1;
    const maxV = st.speed * boostMul * (env.mud ? 0.55 : 1) * (env.stun ? 0.6 : 1) * (env.speedScale || 1);
    if (inp.throttle > 0 && !env.spin) {
      if (vf < maxV) {
        const a = st.accel * (env.boost ? 1.8 : 1) * inp.throttle;
        vf = Math.min(maxV, vf + a * dt * (1.15 - 0.75 * Math.max(0, vf) / maxV));
      }
    } else if (inp.brake <= 0) {
      vf -= Math.sign(vf) * Math.min(Math.abs(vf), (3 + Math.abs(vf) * 0.25) * dt);
    }
    if (vf > maxV) vf = Math.max(maxV, vf - 14 * dt);
    if (inp.brake > 0) {
      if (vf > 0.5) vf -= 38 * inp.brake * dt;
      else vf = Math.max(-11, vf - st.accel * 0.55 * inp.brake * dt);
    }

    let grip = st.grip * env.seasonGrip;
    if (env.winter) grip *= 1 + st.winter;
    if (env.spin) grip *= 0.15;
    this.grip = grip;
    vl *= Math.exp(-grip * dt);

    this.vel.x = fx * vf + rx * vl;
    this.vel.z = fz * vf + rz * vl;

    const speedFactor = Math.max(-1, Math.min(1, vf / 7));
    const highSpeedDamp = 1 - 0.45 * Math.min(1, Math.max(0, vf) / st.speed);
    let turn = st.turn * inp.steer * speedFactor * highSpeedDamp;
    if (env.mud) turn += Math.sin(performance.now() * 0.006) * 0.06;
    if (env.spin) turn = 10;
    // Ease the turn rate in and out so the car sweeps through corners instead of snapping.
    this.yawRate += (turn - this.yawRate) * (1 - Math.exp(-dt * (env.spin ? 30 : 7)));
    this.heading -= this.yawRate * dt;

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.constrain(dt);
    this.speed = vf;
    this.slip = vl;
  }

  // Flying off a ramp or crest: no grip, a little air steering, gravity pulls us down.
  stepAir(dt) {
    this.airTime += dt;
    this.yawRate *= Math.exp(-dt * 3);
    this.heading -= (this.yawRate + this.input.steer * 0.35) * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.constrain(dt);
    this.speed = this.vel.x * Math.sin(this.heading) + this.vel.z * Math.cos(this.heading);
    this.slip = 0;
  }

  // Follow the road height (with jumps) and bounce off the barriers.
  constrain(dt) {
    const pr = this.track.project(this.pos, this.hint, this.proj);
    this.hint = pr.i;
    const ground = pr.point.y;
    const groundRate = (ground - this.groundY) / dt;
    this.groundY = ground;
    if (this.airborne) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        this.landed = Math.max(this.landed, groundRate - this.vy);
        this.pos.y = ground;
        this.vy = groundRate;
        this.airborne = false;
        this.airTime = 0;
        if (this.landed > 9) this.vel.multiplyScalar(0.96);
      }
    } else if (groundRate < this.vy - GRAVITY * dt * 1.5 - 2.5 && this.vy > 1) {
      // The road drops away faster than gravity can follow: take off.
      this.airborne = true;
      this.pos.y += this.vy * dt;
    } else {
      this.pos.y = ground;
      this.vy = Math.max(-40, Math.min(40, groundRate));
    }
    const limit = this.track.width / 2 + 0.05;
    this.wallHit = 0;
    if (Math.abs(pr.lateral) > limit) {
      const s = Math.sign(pr.lateral);
      const push = pr.lateral - s * limit;
      this.pos.x -= pr.right.x * push;
      this.pos.z -= pr.right.z * push;
      const vn = this.vel.x * pr.right.x + this.vel.z * pr.right.z;
      if (vn * s > 0) {
        this.vel.x -= pr.right.x * vn * 1.35;
        this.vel.z -= pr.right.z * vn * 1.35;
        this.wallHit = Math.abs(vn);
      }
      this.vel.multiplyScalar(Math.exp(-0.9 * dt));
      // Nudge the nose away from the wall so you don't grind along it forever.
      const tanHeading = Math.atan2(pr.tangent.x, pr.tangent.z);
      let d = tanHeading - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < Math.PI / 2) this.heading += d * Math.min(1, 2.5 * dt);
    }
    this.lateral = pr.lateral;
  }

  syncVisual(dt, time) {
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.set(0, this.heading, 0, 'YXZ');
    // Pitch from the track slope along the car's direction.
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const t = this.proj.tangent || UP;
    const along = t.x * fx + t.z * fz;
    let targetPitch = -Math.asin(Math.max(-1, Math.min(1, t.y))) * Math.sign(along || 1);
    if (this.airborne) targetPitch = Math.max(-0.45, Math.min(0.45, -Math.atan2(this.vy, Math.max(8, Math.abs(this.speed)))));
    const k = 1 - Math.exp(-dt * 10);
    this.pitch += (targetPitch - this.pitch) * k;
    const targetRoll = -this.input.steer * Math.min(1, Math.abs(this.speed) / 30) * 0.07 + this.slip * 0.004;
    this.roll += (targetRoll - this.roll) * k;
    m.root.rotation.x = this.pitch;
    m.body.rotation.z = this.roll;
    m.body.position.y = Math.sin(time * 18) * 0.008 * Math.min(1, Math.abs(this.speed) / 10);

    this.steerVis += (this.input.steer - this.steerVis) * (1 - Math.exp(-dt * 12));
    for (const w of m.wheels) {
      w.spin.rotation.x += (this.speed / w.radius) * dt;
      if (w.front) w.pivot.rotation.y = -this.steerVis * 0.45;
    }
    animateRainbow(m, time);
  }
}
