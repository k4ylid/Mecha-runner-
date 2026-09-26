// Track — the treadmill. Owns rooftop pads (with gaps/steps), obstacle and
// pickup spawning from the pattern library, recycling, floor queries, and
// player collision. Everything lives at z≈0 on the XY gameplay plane.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER_X, KILL_X, SPAWN_X, SPEED, MECHA } from '../core/config.js';
import { rand, pick, rng, clamp } from '../core/utils.js';
import { PATTERNS, POWERUP_TYPES, patternsForTier } from './Patterns.js';
import { deckPlate, deckRoughness, hazardStripes, facade, cratePanel } from '../world/Textures.js';
import { PALETTE } from '../world/Sky.js';

const DECK_DEPTH = 8;
const DECK_FRONT = 4; // z of the face the camera sees

// ---------------------------------------------------------------------------
// Materials (built once, shared)
// ---------------------------------------------------------------------------
function buildMats() {
  const plate = deckPlate();
  const rough = deckRoughness();
  const hazard = hazardStripes();
  const crate = cratePanel();
  const fac = facade(93, 0.25, '#6f86a8');
  return {
    deck: new THREE.MeshStandardMaterial({ map: plate, roughnessMap: rough, color: 0xb8c2cf, metalness: 0.55, roughness: 0.6 }),
    body: new THREE.MeshStandardMaterial({ map: fac.albedo, emissiveMap: fac.emissive, emissive: 0x9fb8d8, emissiveIntensity: 0.5, color: 0x2a3442, metalness: 0.3, roughness: 0.8 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazard, metalness: 0.3, roughness: 0.7, emissive: 0xaa5500, emissiveMap: hazard, emissiveIntensity: 0.85 }),
    edgeGlow: new THREE.MeshStandardMaterial({ color: 0x0e1a24, emissive: PALETTE.neonCyan, emissiveIntensity: 1.8 }),
    edgeGlowWarm: new THREE.MeshStandardMaterial({ color: 0x241a0e, emissive: PALETTE.horizon, emissiveIntensity: 1.5 }),
    crate: new THREE.MeshStandardMaterial({ map: crate, color: 0xaab6c6, metalness: 0.5, roughness: 0.55 }),
    barrierPost: new THREE.MeshStandardMaterial({ color: 0x2a3644, metalness: 0.75, roughness: 0.4 }),
    laser: new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2244, emissiveIntensity: 3.2 }),
    beamWarn: new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff7722, emissiveIntensity: 2.2 }),
    droneShell: null, // from GLB
    prop: new THREE.MeshStandardMaterial({ color: 0x46536a, metalness: 0.6, roughness: 0.55 }),
    propDark: new THREE.MeshStandardMaterial({ color: 0x1f2836, metalness: 0.6, roughness: 0.6 }),
  };
}

// ---------------------------------------------------------------------------
// Obstacle mesh builders — visual language: hot emissive = deadly.
// ---------------------------------------------------------------------------
function makeBarrierMesh(m) {
  const g = new THREE.Group();
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), m.barrierPost);
  postL.position.set(-0.28, 0.6, 0);
  const postR = postL.clone();
  postR.position.x = 0.28;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.22), m.beamWarn);
  beam.position.y = 0.85;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.5), m.barrierPost);
  base.position.y = 0.06;
  const capL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), m.edgeGlow);
  capL.position.set(-0.28, 1.22, 0);
  const capR = capL.clone();
  capR.position.x = 0.28;
  g.add(postL, postR, beam, base, capL, capR);
  return g;
}

function makeLaserMesh(m, high) {
  // two emitter posts + a crackling beam sheet
  const g = new THREE.Group();
  const y0 = high ? 0 : 0.55;
  const y1 = high ? 1.15 : 2.45;
  const postGeo = new THREE.CylinderGeometry(0.09, 0.12, y1 + 0.3, 8);
  const postL = new THREE.Mesh(postGeo, m.barrierPost);
  postL.position.set(-0.4, (y1 + 0.3) / 2, 0);
  const postR = postL.clone();
  postR.position.x = 0.4;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.74, y1 - y0, 0.06), m.laser);
  beam.name = 'beam';
  beam.position.y = (y0 + y1) / 2;
  const tipL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), m.laser);
  tipL.position.set(-0.4, y1 + 0.34, 0);
  const tipR = tipL.clone();
  tipR.position.x = 0.4;
  g.add(postL, postR, beam, tipL, tipR);
  return g;
}

function makeBlockMesh(m, w = 1.7, h = 2.7) {
  const g = new THREE.Group();
  const n = Math.round(h / 0.9);
  for (let i = 0; i < n; i++) {
    const ww = w - (i === n - 1 ? 0.25 : 0);
    const c = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.88, 1.6), i % 2 ? m.propDark : m.crate);
    c.position.set((i % 2 ? -0.06 : 0.06) * w, i * 0.9 + 0.44, 0);
    g.add(c);
  }
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.16, 1.64), m.hazard);
  stripe.position.y = h - 0.35;
  g.add(stripe);
  const topGlow = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.09, 0.14), m.beamWarn);
  topGlow.position.set(0, h + 0.02, 0.74); // front lip — the face the runner reads
  const topGlowB = topGlow.clone();
  topGlowB.position.z = -0.74;
  g.add(topGlow, topGlowB);
  return g;
}

function makeBeamMesh(m) {
  // overhead girder — bottom at 1.45: slide under
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.15, 1.4), m.propDark);
  beam.position.y = 2.62;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.2, 1.44), m.hazard);
  stripe.position.y = 2.0;
  const underGlow = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.06, 1.3), m.beamWarn);
  underGlow.position.y = 2.06;
  const cableL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 8, 5), m.prop);
  cableL.position.set(-1, 6.6, 0);
  const cableR = cableL.clone();
  cableR.position.x = 1;
  g.add(beam, stripe, underGlow, cableL, cableR);
  return g;
}

function makePowerupMesh(m, type) {
  const g = new THREE.Group();
  const colors = { shield: 0x35e0ff, magnet: 0xff4d9a, surge: 0xffb52e, jet: 0xff8f2e };
  const c = colors[type] || 0xffffff;
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.28, 0),
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.8, metalness: 0.3, roughness: 0.3 })
  );
  core.name = 'core';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 22), m.barrierPost);
  ring.name = 'ring';
  const glyph = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 14), new THREE.MeshBasicMaterial({ color: c }));
  glyph.name = 'glyph';
  g.add(core, ring, glyph);
  return g;
}

// ---------------------------------------------------------------------------
export class Track {
  constructor(scene, mats = null) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mats = mats || buildMats();

    // roof pads: {x, len, y, mesh}
    this.pads = [];
    this.padPool = [];
    // obstacles: {type, mesh, x, y, w, h, passed, hitW, hitH, hitY}
    this.obstacles = [];
    this.obsPool = {};
    // cells: instanced
    this.cellCap = 320;
    this.cellMesh = null; // built after cell GLB loads (fallback octahedron)
    this.cells = []; // {x,y,taken,seed,idx}
    this.cellCursor = 0;
    // powerups
    this.powerups = [];
    this.powerPool = [];

    this.cursor = 0; // next pad start (world x)
    this.padY = 0;
    this.distance = 0;
    this.timeAlive = 0;
    this.tier = 0;
    this.sincePowerup = 0;
    this._cellGeo = new THREE.OctahedronGeometry(0.24, 0);
    this._cellMat = new THREE.MeshStandardMaterial({ color: 0x4de8ff, emissive: 0x18c0e8, emissiveIntensity: 2.4, metalness: 0.3, roughness: 0.25 });
    this._droneProto = null;
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3(1, 1, 1);
    this._m4 = new THREE.Matrix4();
    this._buildCellMesh();
    this.reset();
  }

  async loadAssets() {
    const loader = new GLTFLoader();
    try {
      const [drone, cell] = await Promise.all([
        loader.loadAsync('/assets/drone.glb'),
        loader.loadAsync('/assets/cell.glb'),
      ]);
      this._droneProto = drone.scene;
      // swap cell instancing to the GLB look: extract core geo + material
      const core = cell.scene.getObjectByName('cell_core');
      const ring = cell.scene.getObjectByName('cell_ring');
      if (core) {
        this._cellGeo = core.geometry;
        this._cellMat = core.material;
      }
      if (ring) this._cellRing = ring;
      this._buildCellMesh();
    } catch (e) {
      console.warn('asset load failed, using fallbacks', e);
    }
  }

  _buildCellMesh() {
    if (this.cellMesh) {
      this.group.remove(this.cellMesh);
      this.cellMesh.dispose?.();
    }
    const im = new THREE.InstancedMesh(this._cellGeo, this._cellMat, this.cellCap);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    im.count = this.cellCap;
    this.cellMesh = im;
    this.group.add(im);
  }

  // -------------------------------------------------------------------------
  // World generation
  // -------------------------------------------------------------------------


  tierForDistance(d) {
    if (d < 140) return 1;
    if (d < 500) return 2;
    return 3;
  }

  _reactionGap(speed) {
    return speed * 0.62 + 4.5;
  }

  _extendPad(len, y, extraItems) {
    const pad = this._newPad(this.cursor, len, y);
    this.pads.push(pad);
    for (const it of extraItems) this._stampItem(this.cursor + it.dx, it);
    this.cursor += len;
  }

  _newPad(x, len, y) {
    let p = this.padPool.pop();
    if (!p) {
      const g = new THREE.Group();
      p = {
        mesh: g,
        body: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.mats.body),
        deck: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.mats.deck),
        fascia: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.mats.edgeGlow),
        hazardBand: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.mats.hazard),
        clutter: new THREE.Group(),
        clutterKind: -1,
      };
      p.body.castShadow = false;
      p.body.receiveShadow = true;
      p.deck.castShadow = false;
      p.deck.receiveShadow = true;
      g.add(p.body, p.deck, p.fascia, p.hazardBand, p.clutter);
      this.group.add(g);
    }
    p.mesh.visible = true;
    p.x = x;
    p.len = len;
    p.y = y;
    const depth = y + 10; // building body reaches down into the dark
    p.body.scale.set(len - 0.35, depth, DECK_DEPTH - 0.7);
    p.body.position.set(x + len / 2, y - depth / 2 - 0.0, 0);
    p.deck.scale.set(len, 0.55, DECK_DEPTH);
    p.deck.position.set(x + len / 2, y - 0.28, 0);
    // texture repeat follows length so plates stay square-ish
    if (this.mats.deck.map) {
      // per-pad repeat would need cloned materials; instead tweak deck UV via geometry scale — cheap visual compromise kept subtle
    }
    p.fascia.scale.set(len, 0.14, 0.1);
    p.fascia.position.set(x + len / 2, y - 0.1, DECK_FRONT - 0.05);
    p.fascia.material = Math.random() < 0.75 ? this.mats.edgeGlow : this.mats.edgeGlowWarm;
    // hazard band on the face you crash into — reads "wall" instantly
    const faceH = y > 0.4 ? Math.min(1.2, y) : 0;
    p.hazardBand.visible = faceH > 0;
    if (faceH > 0) {
      p.hazardBand.scale.set(0.12, faceH, DECK_DEPTH - 0.5);
      p.hazardBand.position.set(x + 0.06, y - faceH / 2, 0);
    }
    this._dressPad(p);
    return p;
  }

  _dressPad(p) {
    // deterministic clutter per pad: ac units / vents / pipes on the deck,
    // kept behind the play line (z < -1.6) so obstacles stay readable
    p.clutter.clear();
    const R = rng(Math.floor(p.x * 13.7));
    const n = Math.min(3, Math.floor(R() * 4));
    for (let i = 0; i < n; i++) {
      const kind = Math.floor(R() * 4);
      const z = -1.8 - R() * 1.6;
      const px = p.x + 2 + R() * Math.max(2, p.len - 4);
      let m;
      if (kind === 0) {
        m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.1), this.mats.prop);
        m.position.set(px, p.y + 0.45, z);
      } else if (kind === 1) {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.5, 8), this.mats.propDark);
        m.position.set(px, p.y + 0.75, z);
      } else if (kind === 2) {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), this.mats.prop);
        m.rotation.z = Math.PI / 2;
        m.rotation.y = R() * 0.3;
        m.position.set(px, p.y + 0.55, z);
      } else {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.6, 5), this.mats.propDark);
        m.position.set(px, p.y + 1.3, z);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), this.mats.edgeGlow);
        tip.position.y = 1.4;
        m.add(tip);
      }
      m.castShadow = true;
      p.clutter.add(m);
    }
  }

  // choose + stamp a pattern at pad-relative position
  _stampPattern(px, pattern, floorY) {
    for (const it of pattern.items) {
      this._stampItem(px + it.dx, it, floorY);
    }
  }

  _stampItem(wx, it, floorY = 0) {
    switch (it.type) {
      case 'cell':
        this._spawnCell(wx, it.dy ?? 0.7);
        break;
      case 'barrier':
        this._spawnObstacle('barrier', wx, floorY);
        break;
      case 'laserHigh':
        this._spawnObstacle('laserHigh', wx, floorY);
        break;
      case 'laserLow':
        this._spawnObstacle('laserLow', wx, floorY);
        break;
      case 'block':
        this._spawnObstacle('block', wx, floorY);
        break;
      case 'beam':
        this._spawnObstacle('beam', wx, floorY);
        break;
      case 'droneHigh':
        this._spawnObstacle('droneHigh', wx, floorY);
        break;
      case 'droneLow':
        this._spawnObstacle('droneLow', wx, floorY);
        break;
      case 'powerup':
        this._spawnPowerup(wx, it.dy ?? 1.2, it.kind);
        break;
    }
  }

  _spawnObstacle(type, x, floorY) {
    let o = (this.obsPool[type] || []).pop();
    if (!o) {
      o = { type, mesh: null };
      if (type === 'barrier') o.mesh = makeBarrierMesh(this.mats);
      else if (type === 'laserHigh') o.mesh = makeLaserMesh(this.mats, true);
      else if (type === 'laserLow') o.mesh = makeLaserMesh(this.mats, false);
      else if (type === 'block') o.mesh = makeBlockMesh(this.mats);
      else if (type === 'beam') o.mesh = makeBeamMesh(this.mats);
      else if (type === 'droneHigh' || type === 'droneLow') {
        o.mesh = this._droneProto ? this._droneProto.clone() : this._droneFallback();
      }
      o.mesh.traverse?.((c) => (c.castShadow = true));
      this.group.add(o.mesh);
      // hitboxes in local coords (from floor beneath the obstacle)
      if (type === 'barrier') Object.assign(o, { hitW: 0.62, hitY0: 0, hitY1: 1.18 });
      if (type === 'laserHigh') Object.assign(o, { hitW: 0.75, hitY0: 0.15, hitY1: 1.15 });
      if (type === 'laserLow') Object.assign(o, { hitW: 0.75, hitY0: 0.55, hitY1: 2.45 });
      if (type === 'block') Object.assign(o, { hitW: 1.65, hitY0: 0, hitY1: 2.72 });
      if (type === 'beam') Object.assign(o, { hitW: 2.6, hitY0: 1.42, hitY1: 3.3 });
      if (type === 'droneHigh') Object.assign(o, { hitW: 1.1, hitY0: 1.35, hitY1: 2.5 });
      if (type === 'droneLow') Object.assign(o, { hitW: 1.1, hitY0: 0.2, hitY1: 1.0 });
    }
    o.x = x;
    o.y = floorY;
    o.passed = false;
    o.seed = rand(100);
    o.mesh.visible = true;
    const dy = type === 'droneHigh' ? 1.9 : type === 'droneLow' ? 0.35 : 0;
    o.mesh.position.set(x, floorY + dy, 0);
    this.obstacles.push(o);
  }

  _droneFallback() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.28, 8), this.mats.propDark);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), this.mats.laser);
    eye.position.z = 0.42;
    g.add(hull, eye);
    return g;
  }

  _spawnCell(x, y) {
    // find free slot
    for (let i = 0; i < this.cellCap; i++) {
      const idx = (this.cellCursor + i) % this.cellCap;
      const c = this.cells[idx];
      if (!c || c.taken || c.x < KILL_X) {
        const cell = c || { idx };
        cell.x = x;
        cell.y = y;
        cell.taken = false;
        cell.seed = rand(10);
        this.cells[idx] = cell;
        this.cellCursor = (idx + 1) % this.cellCap;
        return;
      }
    }
  }

  _spawnPowerup(x, y, kind) {
    const type = kind || pick(POWERUP_TYPES);
    let p = this.powerPool.pop();
    if (!p) {
      p = { type, mesh: makePowerupMesh(this.mats, type) };
      this.group.add(p.mesh);
    }
    p.type = type;
    p.x = x;
    p.y = y;
    p.taken = false;
    p.seed = rand(10);
    p.mesh.visible = true;
    p.mesh.position.set(x, y, 0);
    // tint ring to type color
    const glyph = p.mesh.getObjectByName('glyph');
    if (glyph) {
      const colors = { shield: 0x35e0ff, magnet: 0xff4d9a, surge: 0xffb52e, jet: 0xff8f2e };
      glyph.material = glyph.material.clone();
      glyph.material.color.setHex(colors[type]);
      const core = p.mesh.getObjectByName('core');
      core.material.emissive.setHex(colors[type]);
      core.material.color.setHex(colors[type]);
    }
    this.powerups.push(p);
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------
  // top surface y of the pad covering x, or null for a gap
  floorYAt(x) {
    for (const p of this.pads) {
      if (x >= p.x - 0.15 && x <= p.x + p.len + 0.15) return p.y;
    }
    return null;
  }

  update(dt, speed, worldT) {
    this.distance += speed * dt;
    this.timeAlive += dt;
    this.sincePowerup += speed * dt;
    const move = speed * dt;

    // ---- advance generation ----
    while (this.cursor < SPAWN_X + 20) {
      this._generateChunk(speed);
    }

    // ---- treadmill ----
    this.cursor -= move;
    this._syncPads(move);
    for (const o of this.obstacles) {
      o.x -= move;
      o.mesh.position.x = o.x;
      if (o.type === 'droneHigh' || o.type === 'droneLow') {
        o.mesh.position.y = o.y + (o.type === 'droneHigh' ? 1.9 : 0.35) + Math.sin(worldT * 2.2 + o.seed) * 0.12;
        o.mesh.rotation.y += dt * 3;
        const rotors = o.mesh.getObjectByName('rotors');
        if (rotors) rotors.rotation.y += dt * 24;
      }
    }
    for (const pw of this.powerups) {
      pw.x -= move;
      pw.mesh.position.x = pw.x;
      pw.mesh.position.y = pw.y + Math.sin(worldT * 2 + pw.seed) * 0.15;
      pw.mesh.rotation.y += dt * 1.8;
    }
    // cells: write matrices only for visible range
    for (let i = 0; i < this.cellCap; i++) {
      const c = this.cells[i];
      if (!c || c.taken) continue;
      c.x -= move;
      if (c.x < KILL_X || c.x > SPAWN_X + 30) {
        this._parkCell(i);
        continue;
      }
      this._e.set(0, worldT * 2.2 + c.seed, 0);
      this._q.setFromEuler(this._e);
      this._p = this._p || new THREE.Vector3();
      this._p.set(c.x, c.y + Math.sin(worldT * 2.6 + c.seed * 3) * 0.1, 0);
      this._s.set(1, 1, 1);
      this._m4.compose(this._p, this._q, this._s);
      this.cellMesh.setMatrixAt(i, this._m4);
    }
    this.cellMesh.instanceMatrix.needsUpdate = true;

    // ---- recycle ----
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.x < KILL_X) {
        o.mesh.visible = false;
        (this.obsPool[o.type] = this.obsPool[o.type] || []).push(o);
        this.obstacles.splice(i, 1);
      }
    }
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pw = this.powerups[i];
      if (pw.x < KILL_X || pw.taken) {
        pw.mesh.visible = false;
        this.powerups.splice(i, 1);
        this.powerPool.push(pw);
      }
    }
    for (let i = this.pads.length - 1; i >= 0; i--) {
      const p = this.pads[i];
      if (p.x + p.len < KILL_X - 20) {
        p.mesh.visible = false;
        this.pads.splice(i, 1);
        this.padPool.push(p);
      }
    }
  }

  _parkCell(i) {
    this._m4.makeTranslation(0, -9999, 0);
    this.cellMesh.setMatrixAt(i, this._m4);
    if (this.cells[i]) this.cells[i].x = -9999;
  }

  _syncPads(move) {
    for (const p of this.pads) {
      p.x -= move; // logical position
      // children hold absolute x positions — shift their x by -move
      p.body.position.x -= move;
      p.deck.position.x -= move;
      p.fascia.position.x -= move;
      p.hazardBand.position.x -= move;
      for (const c of p.clutter.children) c.position.x -= move;
    }
  }

  _generateChunk(speed) {
    // decide pad length and whether a height step or gap follows
    const tier = this.tierForDistance(this.distance);
    const R = Math.random();
    let nextY = this.padY;

    // Occasionally a pad hosts a pattern with its own internal gap/steps —
    // we carve those at pad construction so floorYAt stays honest.
    const padLen = rand(16, 30);

    // height step: small chance, biased later game
    if (this.distance > 160 && R < 0.22) {
      const step = pick([-1.3, 1.3]);
      nextY = clamp(this.padY + step, 0, 2.6);
    }

    // build the pad; pattern gap may split it
    const startX = this.cursor;
    let pattern = null;
    if (startX > 75) {
      // warm-up zone ends ~8s in; first obstacle is always the calibration one
      if (!this._calibrated) {
        pattern = PATTERNS.find((p) => p.id === 'calib_barrier');
        this._calibrated = true;
      } else {
        const eligible = patternsForTier(tier).filter((pp) => pp.len <= padLen - 4);
        if (Math.random() < 0.85 && eligible.length) pattern = pick(eligible);
      }
    }

    if (pattern && pattern.gap) {
      // carve gap: pad becomes [start..gapStart] then gap then [gapEnd..end]
      const g = pattern.gap;
      const items = pattern.items;
      this._makePadSegments(startX, padLen, this.padY, [{ start: g.start, len: g.len }]);
      for (const it of items) {
        const wx = startX + it.dx;
        // items over the gap float at dy relative to deck level anyway
        const fy = this.floorYAt(wx);
        this._stampItem(wx, it, fy === null ? this.padY : fy);
      }
    } else if (pattern && pattern.steps) {
      // height steps inside the pad
      const cuts = pattern.steps.map((s) => ({ x: s.dx, dy: s.dy }));
      let y = this.padY;
      let last = 0;
      const segs = [];
      for (const c of cuts) {
        segs.push({ x0: last, x1: c.x, y });
        y = clamp(y + c.dy, 0, 3.9);
        last = c.x;
      }
      segs.push({ x0: last, x1: padLen, y });
      for (const sg of segs) {
        const pad = this._newPad(startX + sg.x0, sg.x1 - sg.x0, sg.y);
        this.pads.push(pad);
      }
      for (const it of pattern.items) {
        const wx = startX + it.dx;
        const fy = this.floorYAt(wx);
        this._stampItem(wx, it, fy === null ? y : fy);
      }
      // track current pad height as the last step's height
      nextY = y;
    } else {
      const pad = this._newPad(startX, padLen, this.padY);
      this.pads.push(pad);
      if (pattern) this._stampPattern(startX + 1, pattern, this.padY);
      else if (Math.random() < 0.5) {
        // bare stretch still gets a breadcrumb of cells sometimes
        for (let i = 0; i < 4; i++) this._spawnCell(startX + 4 + i * 2.2, this.padY + 0.7);
      }
    }

    // powerup sprinkle — after enough distance without one
    if (this.sincePowerup > 220 && Math.random() < 0.5) {
      const fy = this.padY;
      this._spawnPowerup(startX + padLen * 0.6, fy + 1.4);
      this.sincePowerup = 0;
    }

    // gap after some pads (inter-pad gaps = classic rooftop jumps)
    let gapLen = 0;
    if (this.distance > 90 && Math.random() < (tier >= 2 ? 0.3 : 0.18)) {
      gapLen = tier >= 3 ? rand(3, 6.5) : rand(2.2, 4.5);
      gapLen = Math.min(gapLen, speed * 0.55); // never wider than a jump's reach
    }

    this.cursor += padLen + gapLen;
    this.padY = nextY;
    this.tier = tier;
  }

  _makePadSegments(startX, padLen, y, holes) {
    let cur = 0;
    const sorted = holes.slice().sort((a, b) => a.start - b.start);
    for (const h of sorted) {
      if (h.start > cur) {
        const pad = this._newPad(startX + cur, h.start - cur, y);
        this.pads.push(pad);
      }
      cur = h.start + h.len;
    }
    if (cur < padLen) {
      const pad = this._newPad(startX + cur, padLen - cur, y);
      this.pads.push(pad);
    }
  }

  // -------------------------------------------------------------------------
  // Collision: player capsule at PLAYER_X, bottom y=player.y, height hitH.
  // Returns events list: {kind: 'hit'|'cell'|'powerup'|'nearmiss'|'wall', ...}
  // -------------------------------------------------------------------------
  collide(py, hitH, sliding, opts) {
    const ev = [];
    const px0 = PLAYER_X - MECHA.hitW / 2;
    const px1 = PLAYER_X + MECHA.hitW / 2;
    const py0 = py;
    const py1 = py + hitH;

    // wall check — player inside a pad but below its top = face-plant
    const floorY = this.floorYAt(PLAYER_X);
    if (floorY !== null && floorY - py > 0.4) {
      ev.push({ kind: 'wall' });
      return ev;
    }

    for (const o of this.obstacles) {
      const ox0 = o.x - o.hitW / 2;
      const ox1 = o.x + o.hitW / 2;
      const oy0 = o.y + o.hitY0;
      const oy1 = o.y + o.hitY1;
      const overlap = px1 > ox0 && px0 < ox1 && py1 > oy0 && py0 < oy1;
      if (overlap && !o.dead) {
        o.dead = true;
        ev.push({ kind: 'hit', obstacle: o });
      } else if (!o.passed && ox1 < px0) {
        o.passed = true;
        // near-miss: cleared with < 0.85u to spare vertically
        const gap = py0 - oy1;
        if (gap > -0.1 && gap < 0.85) ev.push({ kind: 'nearmiss', obstacle: o });
      }
    }

    // cells
    const pr2 = opts.magnet ? 6.5 * 6.5 : 0.85 * 0.85;
    for (let i = 0; i < this.cellCap; i++) {
      const c = this.cells[i];
      if (!c || c.taken || c.x < -20 || c.x > 30) continue;
      const dx = c.x - PLAYER_X;
      const dy = c.y - (py + hitH * 0.5);
      const d2 = dx * dx + dy * dy;
      if (d2 < pr2) {
        c.taken = true;
        this._parkCell(i);
        ev.push({ kind: 'cell', cell: c });
      } else if (opts.magnet && d2 < 6.5 * 6.5 * 4) {
        // drift toward player when magnetized but not yet in range
        const d = Math.sqrt(d2) || 1;
        c.x -= (dx / d) * 14 * opts.dt;
        c.y -= (dy / d) * 14 * opts.dt;
      }
    }

    // powerups
    for (const pw of this.powerups) {
      if (pw.taken) continue;
      const dx = pw.x - PLAYER_X;
      const dy = pw.y - (py + hitH * 0.5);
      if (dx * dx + dy * dy < 1.1 * 1.1) {
        pw.taken = true;
        pw.mesh.visible = false;
        ev.push({ kind: 'powerup', powerup: pw });
      }
    }

    return ev;
  }

  reset() {
    for (const o of this.obstacles) {
      o.mesh.visible = false;
      (this.obsPool[o.type] = this.obsPool[o.type] || []).push(o);
    }
    this.obstacles.length = 0;
    for (const pw of this.powerups) {
      pw.mesh.visible = false;
      this.powerPool.push(pw);
    }
    this.powerups.length = 0;
    for (const p of this.pads) {
      p.mesh.visible = false;
      this.padPool.push(p);
    }
    this.pads.length = 0;
    this.cells.length = 0;
    for (let i = 0; i < this.cellCap; i++) this._parkCell(i);
    this.cellMesh.instanceMatrix.needsUpdate = true;
    this.cursor = -70; // runway behind the player for the attract view
    this.padY = 0;
    this.distance = 0;
    this.timeAlive = 0;
    this.sincePowerup = 400; // let an early powerup appear sometimes
    this.tier = 0;
    this._calibrated = false;
    // guaranteed flat runway: ~90u of solid deck before generation resumes
    this._extendPad(90, 0, []);
    while (this.cursor < SPAWN_X + 20) this._generateChunk(SPEED.start);
  }
}
