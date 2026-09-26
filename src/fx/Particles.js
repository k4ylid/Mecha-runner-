// Pooled CPU particle systems on THREE.Points — dust, sparks, exhaust,
// debris, ambient motes. Zero allocation per frame after init.
import * as THREE from 'three';
import { rand, TAU } from '../core/utils.js';
import { puffSprite, sparkSprite } from '../world/Textures.js';

class Pool {
  constructor(scene, cap, texture, { additive = false, size = 1, gravity = 0, drag = 1 } = {}) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.sizeA = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.baseSize = new Float32Array(cap);
    this.gravity = gravity;
    this.drag = drag;
    this.cursor = 0;
    this.liveCount = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('psize', new THREE.BufferAttribute(this.sizeA, 1).setUsage(THREE.DynamicDrawUsage));

    const mat = new THREE.PointsMaterial({
      map: texture,
      size,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });
    // custom size attribute needs shader patch — use onBeforeCompile
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = size * psize;'
      );
      sh.vertexShader = 'attribute float psize;\n' + sh.vertexShader;
    };
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
    // park all offscreen
    for (let i = 0; i < cap; i++) this.pos[i * 3 + 1] = -9999;
  }

  emit(x, y, z, vx, vy, vz, life, size, r, g, b) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.baseSize[i] = size;
    this.col[i * 3] = r;
    this.col[i * 3 + 1] = g;
    this.col[i * 3 + 2] = b;
  }

  update(dt, worldSpeed) {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -9999;
        this.sizeA[i] = 0;
        continue;
      }
      const t = this.life[i] / this.maxLife[i];
      this.vel[i * 3 + 1] += this.gravity * dt;
      this.vel[i * 3] *= Math.pow(this.drag, dt * 60);
      this.vel[i * 3 + 1] *= Math.pow(this.drag, dt * 60);
      this.pos[i * 3] += (this.vel[i * 3] - worldSpeed * 0.98) * dt; // trail with the world
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.sizeA[i] = this.baseSize[i] * (0.4 + 0.6 * t);
      const fade = Math.min(1, t * 3);
      this.col[i * 3 + 0] *= 1;
      // fade via size only (vertexColors can't do alpha per-point cheaply)
      this.sizeA[i] *= fade > 0 ? 1 : 0;
    }
    if (any) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
      this.geo.attributes.psize.needsUpdate = true;
    }
    this.points.visible = any;
  }
}

export class Particles {
  constructor(scene, budget = 1) {
    this.scene = scene;
    this.budget = budget;
    const dustTex = puffSprite();
    const sparkTex = sparkSprite();
    this.dust = new Pool(scene, Math.ceil(420 * budget), dustTex, { size: 1.5, gravity: -2.5, drag: 0.92 });
    this.sparks = new Pool(scene, Math.ceil(380 * budget), sparkTex, { additive: true, size: 0.7, gravity: -14, drag: 0.97 });
    this.exhaust = new Pool(scene, Math.ceil(300 * budget), sparkTex, { additive: true, size: 0.9, gravity: 2, drag: 0.94 });
    // ambient motes — separate always-on system drifting through the air
    this.motes = new Pool(scene, 160, dustTex, { additive: true, size: 0.35, gravity: 0, drag: 1 });
    this._moteT = 0;
  }

  setBudget(b) {
    this.budget = b;
  }

  // feet dust while running
  runDust(x, y, speed) {
    if (Math.random() > this.budget * 0.85) return;
    this.dust.emit(
      x + rand(-0.3, 0.1), y + rand(0.02, 0.12), rand(-0.4, 0.4),
      rand(-0.5, -1.6) - speed * 0.12, rand(0.6, 1.6), rand(-0.6, 0.6),
      rand(0.35, 0.7), rand(0.5, 1.0), 0.62, 0.66, 0.72
    );
  }

  landBurst(x, y, hard) {
    const n = Math.ceil((hard ? 22 : 10) * this.budget);
    for (let i = 0; i < n; i++) {
      const a = rand(-0.4, 0.4) + (i / n) * Math.PI - Math.PI / 2;
      const sp = rand(2, hard ? 7 : 4);
      this.dust.emit(
        x + rand(-0.3, 0.3), y + 0.05, rand(-0.5, 0.5),
        Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1) * 0.5 - 1.5, Math.abs(Math.sin(a)) * sp * 0.5, rand(-1.2, 1.2),
        rand(0.4, 0.9), rand(0.7, 1.4), 0.6, 0.64, 0.7
      );
    }
    if (hard) {
      for (let i = 0; i < 8 * this.budget; i++) {
        this.sparks.emit(
          x, y + 0.1, 0,
          rand(-5, 5), rand(1, 6), rand(-2, 2),
          rand(0.2, 0.5), rand(0.4, 0.8), 1, 0.7, 0.3
        );
      }
    }
  }

  slideScrape(x, y) {
    if (Math.random() > this.budget * 0.7) return;
    this.sparks.emit(
      x + rand(-0.4, 0.2), y + rand(0.05, 0.2), rand(-0.5, 0.5),
      rand(-7, -3), rand(0.5, 2.5), rand(-1, 1),
      rand(0.15, 0.4), rand(0.3, 0.55), 1, 0.75, 0.3
    );
  }

  jetFlare(x, y, tint = null) {
    const n = Math.ceil(3 * this.budget);
    const [tr, tg, tb] = tint || [1, 0.55, 0.15];
    for (let i = 0; i < n; i++) {
      this.exhaust.emit(
        x + rand(-0.15, 0.15), y + rand(-0.1, 0.2), rand(-0.15, 0.15),
        rand(-2.5, -5), rand(-2, 1), rand(-0.5, 0.5),
        rand(0.25, 0.5), rand(0.6, 1.1), tr, tg + rand(0.3) * tg, tb
      );
    }
  }

  cellPop(x, y) {
    const n = Math.ceil(8 * this.budget);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.sparks.emit(
        x, y, 0,
        Math.cos(a) * rand(2, 4), Math.sin(a) * rand(2, 4), rand(-0.5, 0.5),
        rand(0.25, 0.5), rand(0.4, 0.7), 0.35, 0.9, 1
      );
    }
  }

  hitBurst(x, y) {
    const n = Math.ceil(26 * this.budget);
    for (let i = 0; i < n; i++) {
      this.sparks.emit(
        x + rand(-0.3, 0.3), y + rand(0, 1.8), rand(-0.4, 0.4),
        rand(-8, 4), rand(-2, 9), rand(-3, 3),
        rand(0.3, 0.8), rand(0.5, 1.1), 1, rand(0.3, 0.6), 0.15
      );
    }
    const dn = Math.ceil(14 * this.budget);
    for (let i = 0; i < dn; i++) {
      this.dust.emit(
        x + rand(-0.5, 0.5), y + rand(0, 2), rand(-0.6, 0.6),
        rand(-3, 2), rand(0.5, 4), rand(-1.5, 1.5),
        rand(0.5, 1.1), rand(1, 1.8), 0.35, 0.38, 0.45
      );
    }
  }

  nearMissFx(x, y) {
    for (let i = 0; i < 6 * this.budget; i++) {
      this.sparks.emit(
        x + rand(-0.3, 0.3), y + rand(0, 1), 0,
        rand(-4, -1), rand(-0.5, 1.5), rand(-1, 1),
        rand(0.15, 0.3), rand(0.3, 0.5), 0.6, 0.85, 1
      );
    }
  }

  update(dt, worldSpeed, camX) {
    this.dust.update(dt, worldSpeed);
    this.sparks.update(dt, worldSpeed);
    this.exhaust.update(dt, worldSpeed);
    // ambient motes — emission rate ramps with speed so the air reads faster
    const speedN = Math.min(1, worldSpeed / 27);
    this._moteT += dt;
    if (this._moteT > 0.08 - speedN * 0.05) {
      this._moteT = 0;
      this.motes.emit(
        camX + rand(-15, 40), rand(-1, 14), rand(-14, 4),
        rand(-0.4, 0.4) - worldSpeed * (0.03 + speedN * 0.05), rand(-0.15, 0.35), rand(-0.1, 0.1),
        rand(3, 7), rand(0.14, 0.4), 0.5 + speedN * 0.3, 0.7, 0.85 + speedN * 0.15
      );
    }
    this.motes.update(dt, worldSpeed * 0.4);
  }
}
