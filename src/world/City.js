// Parallax environment: far skyline silhouettes, mid towers with neon,
// near rooftop clutter, sparse foreground occluders, sweeping searchlights.
// Everything is pooled/instanced — the world treadmill just shifts x.
import * as THREE from 'three';
import { rand, randInt, pick } from '../core/utils.js';
import { facade, holoSign, sparkSprite } from './Textures.js';
import { PALETTE } from './Sky.js';

const KILL_X = -70;
const SPAWN_AHEAD = 80;

// ---------------------------------------------------------------------------
// Instanced layer helper: fixed-capacity InstancedMesh, ring-buffer slots.
// ---------------------------------------------------------------------------
class InstLayer {
  constructor(scene, geo, material, cap, factor) {
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.cap = cap;
    this.factor = factor;
    this.slots = new Array(cap).fill(null); // {x,y,z,sx,sy,sz,ry,seed}
    this.cursor = 0;
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    scene.add(this.mesh);
  }

  place(x, y, z, sx, sy, sz, ry = 0, color = null) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    this.slots[i] = { x, y, z, sx, sy, sz, ry };
    if (color) this.mesh.setColorAt(i, color);
    this._write(i);
    return i;
  }

  _write(i) {
    const s = this.slots[i];
    this._e.set(0, s.ry || 0, 0);
    this._q.setFromEuler(this._e);
    this._p.set(s.x, s.y, s.z);
    this._s.set(s.sx, s.sy, s.sz);
    this._m4.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m4);
  }

  update(dt, speed) {
    const move = speed * this.factor * dt;
    for (let i = 0; i < this.cap; i++) {
      const s = this.slots[i];
      if (!s) continue;
      s.x -= move;
      if (s.x < KILL_X) {
        this.slots[i] = null;
        this._m4.makeTranslation(0, -9999, 0); // park offscreen
        this.mesh.setMatrixAt(i, this._m4);
        continue;
      }
      this._write(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
export class City {
  constructor(scene, quality) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    const d = quality?.cityDensity ?? 1;
    this.flickerT = 0;

    // ---------- materials ----------
    const facA = facade(7, 0.4, '#ffd9a0');
    const facB = facade(21, 0.32, '#9fdcff');
    const facC = facade(33, 0.5, '#ffb06a');
    this.facadeMats = [facA, facB, facC].map(
      (f) =>
        new THREE.MeshStandardMaterial({
          map: f.albedo,
          emissiveMap: f.emissive,
          emissive: 0xffffff,
          emissiveIntensity: 0.9,
          color: 0x8899aa,
          metalness: 0.1,
          roughness: 0.9,
        })
    );
    this.siloMat = new THREE.MeshStandardMaterial({ color: 0x141a24, metalness: 0.3, roughness: 0.8 });
    this.propMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.6, roughness: 0.55 });
    this.propDark = new THREE.MeshStandardMaterial({ color: 0x232c3a, metalness: 0.6, roughness: 0.6 });
    this.accentMat = new THREE.MeshStandardMaterial({
      color: 0x18222e,
      emissive: PALETTE.neonCyan,
      emissiveIntensity: 1.5,
      metalness: 0.4,
      roughness: 0.4,
    });
    this.magentaMat = new THREE.MeshStandardMaterial({
      color: 0x221420,
      emissive: PALETTE.neonMagenta,
      emissiveIntensity: 1.3,
      metalness: 0.4,
      roughness: 0.4,
    });

    // ---------- far skyline (3 facade variants, instanced) ----------
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    boxGeo.translate(0, 0.5, 0); // pivot at base
    this.farLayers = this.facadeMats.map((m) => new InstLayer(this.group, boxGeo, m, Math.ceil(30 * d) + 6, 0.07));
    this.farCursor = -30;

    // mid silhouettes (darker, nearer) + antennas
    this.midLayer = new InstLayer(this.group, boxGeo, this.siloMat, Math.ceil(34 * d) + 6, 0.3);
    this.antennaGeo = new THREE.CylinderGeometry(0.06, 0.1, 1, 5);
    this.antennaGeo.translate(0, 0.5, 0);
    this.antennaLayer = new InstLayer(this.group, this.antennaGeo, this.accentMat, Math.ceil(24 * d), 0.3);
    this.midCursor = -20;

    // ---------- near rooftop props ----------
    this.acUnits = new InstLayer(this.group, boxGeo, this.propMat, Math.ceil(26 * d), 0.85);
    this.pipes = new InstLayer(this.group, boxGeo, this.propDark, Math.ceil(26 * d), 0.85);
    this.towers = new InstLayer(
      this.group,
      new THREE.CylinderGeometry(0.5, 0.62, 1, 10).translate(0, 0.5, 0),
      this.propMat,
      Math.ceil(12 * d) + 2,
      0.85
    );
    this.poles = new InstLayer(
      this.group,
      new THREE.CylinderGeometry(0.07, 0.09, 1, 6).translate(0, 0.5, 0),
      this.propDark,
      Math.ceil(20 * d) + 4,
      0.85
    );
    this.nearCursor = -30;

    // ---------- foreground occluders (sparse, fast) ----------
    this.forePoles = new InstLayer(
      this.group,
      new THREE.CylinderGeometry(0.12, 0.16, 1, 6).translate(0, 0.5, 0),
      this.propDark,
      10,
      1.35
    );
    this.foreCursor = 30;

    // ---------- aviation strobes on mid towers (pooled Points) ----------
    this.beaconCap = Math.ceil(28 * d);
    this.beacons = []; // {x,y,z,phase}
    this.beaconPos = new Float32Array(this.beaconCap * 3).fill(-9999);
    this.beaconPos2 = new Float32Array(this.beaconCap * 3).fill(-9999);
    const mkBeacon = (pos) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({
        map: sparkSprite(),
        color: 0xff4055,
        size: 1.5,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      const pts = new THREE.Points(g, m);
      pts.frustumCulled = false;
      this.group.add(pts);
      return { pts, mat: m, pos };
    };
    this.beaconA = mkBeacon(this.beaconPos);
    this.beaconB = mkBeacon(this.beaconPos2);
    this.beaconB.mat.color.set(0xffb340); // amber strobe for variety
    this._beaconT = 0;

    // ---------- neon signs (few live meshes, pooled) ----------
    this.signs = [];
    this.signPool = [];
    this.signCursor = -10;

    // ---------- searchlights ----------
    this.searchlights = [];
    for (let i = 0; i < 2; i++) {
      const beamGeo = new THREE.ConeGeometry(3.4, 60, 12, 1, true);
      beamGeo.translate(0, -30, 0);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xbfe8ff,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(i * 90 - 40, 70, -120);
      beam.userData = { phase: i * 2.4, speed: 0.14 + i * 0.05 };
      this.group.add(beam);
      this.searchlights.push(beam);
    }

    // ---------- crane silhouettes (event landmarks) ----------
    this.cranes = [];
    this.craneCursor = 160;

    this.density = d;
    this._prime();
  }

  _spawnFar(x) {
    const layer = pick(this.farLayers);
    const h = rand(16, 58);
    const w = rand(5, 11);
    const z = rand(-135, -95);
    const tint = new THREE.Color().setHSL(0.58, 0.12, rand(0.55, 0.85));
    layer.place(x, rand(-2, 3), z, w, h, w, 0, tint);
  }

  _addBeacon(x, y, z) {
    if (this.beacons.length >= this.beaconCap) return;
    this.beacons.push({ x, y, z, alt: Math.random() < 0.5 });
  }

  // Fill every layer ahead of the camera so frame one is already a city.
  _prime() {
    for (let x = -70; x < SPAWN_AHEAD + 40; x += rand(6, 14)) this._spawnFar(x);
    for (let x = -60; x < SPAWN_AHEAD + 20; x += rand(9, 20)) {
      const h = rand(12, 34);
      const z = rand(-62, -38);
      this.midLayer.place(x, rand(-1, 4), z, rand(4, 9), h, rand(4, 8));
      if (Math.random() < 0.4) this.antennaLayer.place(x + rand(-1, 1), h + rand(-1, 3), z, 1, rand(3, 7), 1);
      if (Math.random() < 0.35) this._addBeacon(x + rand(-1.5, 1.5), h + rand(-1, 4) + 0.8, z);
    }
    for (let x = -40; x < SPAWN_AHEAD; x += rand(5, 12) / this.density) {
      const z = rand(-15, -7);
      const r = Math.random();
      if (r < 0.4) this.acUnits.place(x, rand(-0.5, 0.2), z, rand(1.2, 2.6), rand(0.8, 1.8), rand(1, 2));
      else if (r < 0.7) this.pipes.place(x, rand(-0.4, 0.1), z, rand(0.4, 0.7), rand(2, 5), rand(0.4, 0.7));
      else if (r < 0.85) this.towers.place(x, rand(-0.6, 0), z, rand(1, 1.6), rand(2.4, 4), rand(1, 1.6));
      else this.poles.place(x, 0, z, 1, rand(4, 8), 1);
    }
    this.farCursor = SPAWN_AHEAD;
    this.midCursor = SPAWN_AHEAD;
    this.nearCursor = SPAWN_AHEAD;
    this.foreCursor = SPAWN_AHEAD * 1.35;
    this.signCursor = SPAWN_AHEAD;
    this.craneCursor = SPAWN_AHEAD + rand(80, 160);
    this._spawnSign(60);
    this._spawnSign(140);
    this._spawnCrane(180);
  }

  _spawnSign(x) {
    let s = this.signPool.pop();
    if (!s) {
      const tex = holoSign(randInt(1, 999), pick(['#35e0ff', '#ff4d9a', '#ffb52e']));
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 3),
        new THREE.MeshStandardMaterial({
          map: tex,
          emissiveMap: tex,
          emissive: 0xffffff,
          emissiveIntensity: 1.6,
          transparent: true,
          side: THREE.DoubleSide,
          roughness: 0.6,
          metalness: 0.1,
        })
      );
      s = { mesh: m, flickerSeed: rand(100) };
      this.group.add(m);
    }
    s.mesh.position.set(x, rand(7, 16), rand(-38, -30));
    s.mesh.rotation.y = rand(-0.1, 0.1);
    s.mesh.visible = true;
    this.signs.push(s);
  }

  _spawnCrane(x) {
    const g = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.6, 46, 1.6), this.siloMat);
    mast.position.y = 23;
    const jib = new THREE.Mesh(new THREE.BoxGeometry(26, 1.1, 1.1), this.siloMat);
    jib.position.set(9, 44, 0);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 1.4), this.siloMat);
    counter.position.set(-6, 44, 0);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 10, 4), this.propDark);
    cable.position.set(18, 39, 0);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 1), this.propMat);
    hook.position.set(18, 33.5, 0);
    const warn = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff3355 })
    );
    warn.position.set(0, 46.5, 0);
    g.add(mast, jib, counter, cable, hook, warn);
    g.position.set(x, 0, -52);
    g.userData.warn = warn;
    this.group.add(g);
    this.cranes.push(g);
  }

  update(dt, speed, time) {
    // --- far skyline ---
    this.farCursor -= speed * 0.07 * dt;
    while (this.farCursor < SPAWN_AHEAD) {
      this.farCursor += rand(6, 14);
      this._spawnFar(this.farCursor);
    }
    for (const l of this.farLayers) l.update(dt, speed);

    // --- mid towers ---
    this.midCursor -= speed * 0.3 * dt;
    while (this.midCursor < SPAWN_AHEAD) {
      this.midCursor += rand(9, 20);
      const h = rand(12, 34);
      const z = rand(-62, -38);
      this.midLayer.place(this.midCursor, rand(-1, 4), z, rand(4, 9), h, rand(4, 8));
      if (Math.random() < 0.4) {
        this.antennaLayer.place(this.midCursor + rand(-1, 1), h + rand(-1, 3), z, 1, rand(3, 7), 1);
      }
      if (Math.random() < 0.35) this._addBeacon(this.midCursor + rand(-1.5, 1.5), h + rand(-1, 4) + 0.8, z);
    }
    this.midLayer.update(dt, speed);
    this.antennaLayer.update(dt, speed);

    // strobes: scroll with the mid layer; two pools phase-offset so they alternate
    this._beaconT += dt;
    for (const [pool, phase] of [[this.beaconA, 0], [this.beaconB, Math.PI]]) {
      const flash = Math.pow(Math.max(0, Math.sin(this._beaconT * 3.1 + phase)), 18);
      pool.mat.opacity = 0.15 + flash * 0.85;
      pool.mat.size = 1.1 + flash * 1.5;
    }
    let bi = 0, bj = 0;
    for (const b of this.beacons) {
      b.x -= speed * 0.3 * dt;
      const pos = b.alt ? this.beaconB.pos : this.beaconA.pos;
      const i = b.alt ? bj++ : bi++;
      pos[i * 3] = b.x; pos[i * 3 + 1] = b.y; pos[i * 3 + 2] = b.z;
    }
    this.beacons = this.beacons.filter((b) => b.x > -90);
    for (let i = bi; i < this.beaconCap; i++) this.beaconA.pos[i * 3] = -9999;
    for (let i = bj; i < this.beaconCap; i++) this.beaconB.pos[i * 3] = -9999;
    this.beaconA.pts.geometry.attributes.position.needsUpdate = true;
    this.beaconB.pts.geometry.attributes.position.needsUpdate = true;

    // --- near props: clutter between the track and mid city ---
    this.nearCursor -= speed * 0.85 * dt;
    while (this.nearCursor < SPAWN_AHEAD) {
      this.nearCursor += rand(5, 12) / this.density;
      const z = rand(-15, -7);
      const r = Math.random();
      if (r < 0.4) {
        this.acUnits.place(this.nearCursor, rand(-0.5, 0.2), z, rand(1.2, 2.6), rand(0.8, 1.8), rand(1, 2));
      } else if (r < 0.7) {
        this.pipes.place(this.nearCursor, rand(-0.4, 0.1), z, rand(0.4, 0.7), rand(2, 5), rand(0.4, 0.7));
      } else if (r < 0.85) {
        this.towers.place(this.nearCursor, rand(-0.6, 0), z, rand(1, 1.6), rand(2.4, 4), rand(1, 1.6));
      } else {
        this.poles.place(this.nearCursor, 0, z, 1, rand(4, 8), 1);
      }
    }
    this.acUnits.update(dt, speed);
    this.pipes.update(dt, speed);
    this.towers.update(dt, speed);
    this.poles.update(dt, speed);

    // --- foreground occluders: fast poles sweeping past the lens ---
    this.foreCursor -= speed * 1.35 * dt;
    while (this.foreCursor < SPAWN_AHEAD * 1.35) {
      this.foreCursor += rand(70, 130);
      this.forePoles.place(this.foreCursor, -4, rand(5.5, 7.5), 1, rand(9, 13), 1);
    }
    this.forePoles.update(dt, speed);

    // --- neon signs ---
    this.signCursor -= speed * 0.3 * dt;
    if (this.signCursor < SPAWN_AHEAD && this.signs.length < 8) {
      this._spawnSign(this.signCursor + rand(15, 40));
      this.signCursor = this.signCursor + rand(30, 70);
    }
    this.flickerT += dt;
    for (let i = this.signs.length - 1; i >= 0; i--) {
      const s = this.signs[i];
      s.mesh.position.x -= speed * 0.3 * dt;
      // occasional flicker burst
      const f = Math.sin(time * 7 + s.flickerSeed) * Math.sin(time * 13.7 + s.flickerSeed * 2);
      s.mesh.material.emissiveIntensity = f > 0.93 ? 0.4 : 1.6;
      if (s.mesh.position.x < KILL_X) {
        s.mesh.visible = false;
        this.signs.splice(i, 1);
        this.signPool.push(s);
      }
    }

    // --- cranes ---
    this.craneCursor -= speed * 0.3 * dt;
    if (this.craneCursor < SPAWN_AHEAD) {
      this._spawnCrane(this.craneCursor + rand(60, 120));
      this.craneCursor += rand(240, 420);
    }
    for (let i = this.cranes.length - 1; i >= 0; i--) {
      const c = this.cranes[i];
      c.position.x -= speed * 0.3 * dt;
      c.userData.warn.material.color.setScalar(0); // blink via intensity
      if (Math.sin(time * 2.4) > 0) c.userData.warn.material.color.setHex(0xff3355);
      if (c.position.x < KILL_X - 30) {
        this.group.remove(c);
        this.cranes.splice(i, 1);
      }
    }

    // --- searchlights sweep ---
    for (const b of this.searchlights) {
      b.position.x -= speed * 0.05 * dt;
      if (b.position.x < -140) b.position.x += 300;
      const t = time * b.userData.speed + b.userData.phase;
      b.rotation.z = Math.sin(t) * 0.5 - 0.2;
      b.rotation.x = Math.cos(t * 0.7) * 0.2;
    }
  }
}
