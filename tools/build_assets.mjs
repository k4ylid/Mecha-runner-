// Builds GLB assets for Mecha Runner. Run: npm run assets
// Generates public/assets/{mecha-runner,drone,cell}.glb
// The mecha is built with pivot groups (armL/armR/legL/legR/head/pack)
// so runtime code can drive a procedural run/slide/jet cycle by name.

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// GLTFExporter needs FileReader to assemble binary blobs in Node.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend && this.onloadend();
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const b64 = Buffer.from(buf).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
        this.onloadend && this.onloadend();
      });
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({
    name: opts.name || '',
    color,
    metalness: opts.metalness ?? 0.6,
    roughness: opts.roughness ?? 0.35,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    envMapIntensity: opts.envMapIntensity ?? 1,
  });

const box = (w, h, d, material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
const cyl = (r1, r2, h, material, seg = 10) =>
  new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), material);

// Palette — dusk industrial, cyan accents, hot engines
const HULL = mat(0x9fb4c8, { name: 'hull', metalness: 0.78, roughness: 0.3 });
const DARK = mat(0x2a3644, { name: 'dark', metalness: 0.7, roughness: 0.42 });
const INNER = mat(0x1b222e, { name: 'inner', metalness: 0.55, roughness: 0.55 });
const ACCENT = mat(0x35e0ff, { name: 'accent', emissive: 0x1499bb, emissiveIntensity: 1.5, metalness: 0.3 });
const ENGINE = mat(0xff8f2e, { name: 'engine', emissive: 0xd05200, emissiveIntensity: 1.6, metalness: 0.2 });
const GLASS = mat(0x66f0ff, { name: 'glass', emissive: 0x1a8fa8, emissiveIntensity: 1.9, metalness: 0.1, roughness: 0.12 });
const WARN = mat(0xffb52e, { name: 'warn', emissive: 0x8a5a00, emissiveIntensity: 0.9, metalness: 0.4 });

// ---------------------------------------------------------------------------
// Mecha — ~2.3u tall, feet at local y=0. Pivot groups at anatomical joints.
// Names consumed by Player.js: legL, legR, armL, armR, head, pack, nozzleL/R,
// visor, body.
// ---------------------------------------------------------------------------
function buildMecha() {
  const root = new THREE.Group();
  root.name = 'mecha-runner';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);

  // pelvis + torso core
  const pelvis = box(0.62, 0.34, 0.42, DARK);
  pelvis.name = 'pelvis';
  pelvis.position.y = 1.06;
  const torso = box(0.88, 0.82, 0.52, HULL);
  torso.name = 'torso';
  torso.position.y = 1.66;
  const chestCore = box(0.4, 0.3, 0.1, GLASS);
  chestCore.name = 'chestCore';
  chestCore.position.set(0, 1.72, 0.28);
  chestCore.rotation.x = 0.12;
  const torsoStripe = box(0.9, 0.08, 0.54, ACCENT);
  torsoStripe.name = 'torsoStripe';
  torsoStripe.position.y = 1.38;
  body.add(pelvis, torso, chestCore, torsoStripe);

  // head — pivot at neck so it can duck/look
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 2.14, 0);
  const skull = box(0.36, 0.34, 0.36, HULL);
  skull.position.y = 0.17;
  const visor = box(0.3, 0.09, 0.05, GLASS);
  visor.name = 'visor';
  visor.position.set(0, 0.18, 0.19);
  const crest = box(0.06, 0.22, 0.3, ACCENT);
  crest.position.set(0, 0.32, -0.06);
  crest.rotation.x = -0.25;
  const antenna = cyl(0.012, 0.012, 0.4, DARK, 5);
  antenna.position.set(0.14, 0.42, -0.1);
  antenna.rotation.z = -0.15;
  head.add(skull, visor, crest, antenna);
  body.add(head);

  // arms — pivot at shoulder; chunky forearm ends in a stabilizer cannon
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.name = side < 0 ? 'armL' : 'armR';
    arm.position.set(side * 0.56, 1.95, 0);
    const pad = box(0.3, 0.26, 0.36, ACCENT);
    pad.position.y = 0.05;
    const upper = box(0.24, 0.5, 0.28, HULL);
    upper.position.y = -0.28;
    const fore = box(0.28, 0.5, 0.32, DARK);
    fore.position.y = -0.72;
    const cannon = cyl(0.07, 0.09, 0.3, INNER, 8);
    cannon.position.set(0, -0.98, 0.1);
    cannon.rotation.x = Math.PI / 2 - 0.15;
    const wristGlow = box(0.29, 0.06, 0.33, ENGINE);
    wristGlow.position.y = -0.52;
    arm.add(pad, upper, fore, cannon, wristGlow);
    body.add(arm);
  }

  // legs — pivot at hip; thigh, shin, piston detail, wide foot
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = side < 0 ? 'legL' : 'legR';
    leg.position.set(side * 0.26, 1.02, 0);
    const thigh = box(0.3, 0.52, 0.4, HULL);
    thigh.position.y = -0.26;
    const knee = box(0.32, 0.14, 0.42, ACCENT);
    knee.position.y = -0.55;
    const shin = box(0.26, 0.42, 0.34, DARK);
    shin.position.y = -0.75;
    const piston = cyl(0.04, 0.04, 0.4, ENGINE, 6);
    piston.position.set(0, -0.55, -0.24);
    const foot = box(0.34, 0.16, 0.55, HULL);
    foot.position.set(0, -0.99, 0.1);
    const toe = box(0.34, 0.12, 0.2, ACCENT);
    toe.position.set(0, -1.0, 0.4);
    leg.add(thigh, knee, shin, piston, foot, toe);
    body.add(leg);
  }

  // jetpack — the transform DNA: fold-out wings + twin nozzles
  const pack = new THREE.Group();
  pack.name = 'pack';
  pack.position.set(0, 1.7, -0.34);
  const packCore = box(0.6, 0.6, 0.24, DARK);
  const wingL = box(0.62, 0.2, 0.07, ACCENT);
  wingL.name = 'wingL';
  wingL.position.set(-0.42, 0.12, -0.02);
  wingL.rotation.z = 0.35;
  const wingR = wingL.clone();
  wingR.name = 'wingR';
  wingR.position.x = 0.42;
  wingR.rotation.z = -0.35;
  const nozzleL = cyl(0.09, 0.13, 0.34, ENGINE, 10);
  nozzleL.name = 'nozzleL';
  nozzleL.position.set(-0.2, -0.38, -0.02);
  const nozzleR = nozzleL.clone();
  nozzleR.name = 'nozzleR';
  nozzleR.position.x = 0.2;
  const packGlow = box(0.4, 0.1, 0.05, ENGINE);
  packGlow.position.set(0, -0.1, -0.14);
  pack.add(packCore, wingL, wingR, nozzleL, nozzleR, packGlow);
  body.add(pack);

  return { root, clips: [] };
}

// ---------------------------------------------------------------------------
// Patrol drone — hovers at head height, forces slides or careful jumps.
// ---------------------------------------------------------------------------
function buildDrone() {
  const g = new THREE.Group();
  g.name = 'drone';
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.28, 8), mat(0x3a4a5f, { metalness: 0.8, roughness: 0.35 }));
  const belly = box(0.4, 0.2, 0.4, DARK);
  belly.position.y = -0.22;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(0xff3355, { emissive: 0xff0033, emissiveIntensity: 2.4 }));
  eye.name = 'drone_eye';
  eye.position.set(0, -0.02, 0.42);
  const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16), WARN);
  eyeRing.position.copy(eye.position);
  const rotors = new THREE.Group();
  rotors.name = 'rotors';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const armM = box(0.5, 0.06, 0.1, DARK);
    armM.position.set(Math.cos(a) * 0.5, 0.18, Math.sin(a) * 0.5);
    armM.rotation.y = -a;
    const blade = box(0.44, 0.02, 0.08, INNER);
    blade.name = 'blade';
    blade.position.set(Math.cos(a) * 0.72, 0.26, Math.sin(a) * 0.72);
    rotors.add(armM, blade);
  }
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mat(0xff3355, { emissive: 0xff0033, emissiveIntensity: 2 }));
  antennaTip.position.set(0, 0.34, 0);
  const antennaM = cyl(0.015, 0.015, 0.22, DARK, 5);
  antennaM.position.y = 0.24;
  g.add(hull, belly, eye, eyeRing, rotors, antennaM, antennaTip);
  return { root: g, clips: [] };
}

// ---------------------------------------------------------------------------
// Energy cell — the collectible. Octahedral core inside a gyro ring.
// ---------------------------------------------------------------------------
function buildCell() {
  const g = new THREE.Group();
  g.name = 'cell';
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.24, 0),
    mat(0x4de8ff, { name: 'cell_core', emissive: 0x18c0e8, emissiveIntensity: 2.6, metalness: 0.2, roughness: 0.2 })
  );
  core.name = 'cell_core';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 20), mat(0x2a3644, { metalness: 0.85, roughness: 0.3 }));
  ring.name = 'cell_ring';
  ring.rotation.x = Math.PI / 2;
  const ringGlow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.012, 6, 20), ACCENT);
  ringGlow.rotation.x = Math.PI / 2;
  g.add(core, ring, ringGlow);
  return { root: g, clips: [] };
}

// ---------------------------------------------------------------------------
async function exportGLB(root, clips, file) {
  const exporter = new GLTFExporter();
  const buf = await new Promise((resolve, reject) => {
    exporter.parse(root, resolve, reject, { binary: true, animations: clips });
  });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(buf));
  console.log('wrote', file, buf.byteLength, 'bytes');
}

const jobs = [
  ['mecha-runner.glb', buildMecha],
  ['drone.glb', buildDrone],
  ['cell.glb', buildCell],
];

for (const [file, build] of jobs) {
  const { root, clips } = build();
  await exportGLB(root, clips, file);
}
console.log('done ->', OUT);
