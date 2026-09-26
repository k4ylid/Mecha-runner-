// Player — mecha physics + procedural animation. Gameplay on XY plane at
// z=0; x stays pinned at PLAYER_X (the world moves), only y is simulated.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER_X, PHYS, MECHA, SPEED } from '../core/config.js';
import { clamp, damp } from '../core/utils.js';

const ST_RUN = 'run';
const ST_AIR = 'air';
const ST_SLIDE = 'slide';
const ST_DEAD = 'dead';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(PLAYER_X, 0, 0);
    scene.add(this.group);
    this.mecha = null;
    this.parts = {};
    this.ready = false;
    this.reset();
  }

  async load() {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync('/assets/mecha-runner.glb');
      this.mecha = gltf.scene;
    } catch (e) {
      console.warn('mecha glb failed, using fallback', e);
      this.mecha = this._fallback();
    }
    this.mecha.traverse((c) => {
      c.castShadow = true;
      if (c.isMesh) c.material.envMapIntensity = 1.15;
    });
    for (const n of ['body', 'head', 'armL', 'armR', 'legL', 'legR', 'pack', 'wingL', 'wingR', 'nozzleL', 'nozzleR', 'visor']) {
      const o = this.mecha.getObjectByName(n);
      if (o) this.parts[n] = o;
    }
    // rim/back lighting accent so the mech reads against dark rooftops
    this.mecha.rotation.y = Math.PI / 2; // face +X — toward oncoming obstacles (player POV: runner strides right)
    this.mecha.scale.setScalar(1.14); // a touch bigger than authored — more presence at gameplay distance
    this.group.add(this.mecha);
    this.ready = true;
  }

  _fallback() {
    const g = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, metalness: 0.7, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a3644, metalness: 0.7 });
    const acc = new THREE.MeshStandardMaterial({ color: 0x35e0ff, emissive: 0x1499bb, emissiveIntensity: 1.5 });
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.82, 0.52), hull);
    t.name = 'torso';
    t.position.y = 1.66;
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.36), acc);
    h.position.y = 2.3;
    const mk = (x, nm) => {
      const grp = new THREE.Group();
      grp.name = nm;
      grp.position.set(x, nm.includes('leg') ? 1.02 : 1.95, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, nm.includes('leg') ? 1.0 : 0.9, 0.36), nm.includes('leg') ? hull : dark);
      m.position.y = -0.5;
      grp.add(m);
      return grp;
    };
    const body = new THREE.Group();
    body.name = 'body';
    body.add(t, h, mk(-0.56, 'armL'), mk(0.56, 'armR'), mk(-0.26, 'legL'), mk(0.26, 'legR'));
    g.add(body);
    return g;
  }

  reset() {
    this.state = ST_RUN;
    this.y = 0;
    this.vy = 0;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumpsLeft = 1;
    this.slideT = 0;
    this.slideCd = 0;
    this.jetT = 0; // >0 while jet-boost flame is on
    this.jetPowerup = 0; // unlimited-jump window
    this.dead = false;
    this.deadT = 0;
    this.runPhase = 0;
    this.leanX = 0;
    this.invuln = 0;
    this.landEvent = 0; // set to impact vy on the landing frame
    this._squash = 0;
    this.tumble = 0;
    if (this.group) {
      this.group.position.set(PLAYER_X, 0, 0);
      this.group.rotation.set(0, 0, 0);
      this.group.visible = true;
      const b = this.parts.body || this.mecha?.getObjectByName('body');
      if (b) {
        b.position.set(0, 0, 0);
        b.rotation.set(0, 0, 0);
        b.scale.set(1, 1, 1);
      }
    }
  }

  get hitH() {
    return this.state === ST_SLIDE ? MECHA.hitHSlide : MECHA.hitH;
  }

  update(dt, input, ctx) {
    // ctx: { speed, floorY, autopilot }
    if (this.state === ST_DEAD) {
      this.deadT += dt;
      // tumble: fall with spin, slight forward pitch
      this.tumble += dt * 9;
      this.vy += PHYS.gravity * 0.7 * dt;
      this.y += this.vy * dt;
      this.group.position.y = this.y;
      this.group.rotation.z = -this.tumble;
      this.group.position.x = PLAYER_X + this.deadT * -1.4; // slide backward as world passes
      return;
    }

    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.slideCd = Math.max(0, this.slideCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.jetPowerup = Math.max(0, this.jetPowerup - dt);
    this.landEvent = 0;

    // ---------------- input ----------------
    const wantJump = input.justPressed('jump') || (ctx.autopilot && ctx.autoJump);
    const jumpHeld = input.held('jump') || (ctx.autopilot && ctx.autoJumpHeld);
    const wantSlide = input.held('slide') || (ctx.autopilot && ctx.autoSlide);
    const wantFastFall = input.held('slide') || (ctx.autopilot && ctx.autoSlide);

    if (wantJump) this.jumpBuf = PHYS.buffer;

    // buffered + coyote jump
    if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
      this._doJump(PHYS.jumpVel);
      this.jumpBuf = 0;
      ctx.onJump && ctx.onJump();
    } else if (this.jumpBuf > 0 && !this.grounded && (this.jumpsLeft > 0 || this.jetPowerup > 0)) {
      // jet-boost double jump — the transform flourish
      this._doJump(PHYS.jetVel);
      this.jetT = 0.42;
      if (this.jetPowerup <= 0) this.jumpsLeft = Math.max(0, this.jumpsLeft - 1);
      this.jumpBuf = 0;
      ctx.onJet && ctx.onJet();
    }

    // slide start
    if (wantSlide && this.grounded && this.state !== ST_SLIDE && this.slideCd <= 0) {
      this.state = ST_SLIDE;
      this.slideT = PHYS.slideTime;
      ctx.onSlide && ctx.onSlide();
    }

    // ---------------- vertical physics ----------------
    const floorY = ctx.floorY;
    const wasGrounded = this.grounded;

    if (this.state === ST_SLIDE) {
      this.slideT -= dt;
      if (this.slideT <= 0 || !wantSlide && this.slideT < PHYS.slideTime - 0.25) {
        this.state = ST_RUN;
        this.slideCd = PHYS.slideCooldown;
      }
      // sliding keeps you glued to the deck
      if (floorY !== null && this.y <= floorY + 0.02) this.y = floorY;
      else {
        // slid off an edge — convert to air
        this.state = ST_AIR;
        this.grounded = false;
      }
    }

    if (!this.grounded || this.state === ST_AIR) {
      let g = PHYS.gravity;
      if (jumpHeld && this.vy > 0) g *= 0.86; // hold = floatier rise
      // release-cut: let go early and the rise dies fast — tap = hop, hold = full arc
      if (!jumpHeld && this.vy > 0 && this._wasHeld) this.vy *= 1 - PHYS.releaseDamp;
      this._wasHeld = jumpHeld;
      if (wantFastFall && this.vy < 4) this.vy = Math.min(this.vy, 0) + PHYS.fastFall * dt * 3;
      this.vy += g * dt;
      this.y += this.vy * dt;
      this.grounded = false;
      this.state = this.state === ST_SLIDE ? ST_SLIDE : ST_AIR;

      // land?
      if (floorY !== null && this.y <= floorY && this.vy <= 0) {
        this.y = floorY;
        this.landEvent = this.vy; // for squash/dust scaling
        this.vy = 0;
        this.grounded = true;
        this.jumpsLeft = 1; // regains the jet boost
        if (this.state === ST_AIR) this.state = wantSlide ? ST_SLIDE : ST_RUN;
        if (this.state === ST_SLIDE) this.slideT = Math.max(this.slideT, 0.2);
        ctx.onLand && ctx.onLand(this.landEvent);
      }
      // walked off an edge?
      if (floorY === null && this.y <= 0.01) {
        // genuinely over a gap — keep falling
      }
    } else {
      // grounded: follow the deck, detect ledges
      if (floorY === null) {
        this.grounded = false;
        this.state = ST_AIR;
        this.coyote = PHYS.coyote;
      } else if (floorY - this.y > 0.4) {
        // stepped wall — Track reports wall hit separately
      } else {
        const before = this.y;
        this.y = floorY; // snap to pad (steps ≤0.4 auto-climb)
        if (before !== floorY && Math.abs(this.vy) < 0.01) this.vy = 0;
      }
    }
    // left the ground under our feet without jumping?
    if (wasGrounded && !this.grounded && this.coyote <= 0) this.coyote = PHYS.coyote;

    // fell into the abyss
    if (this.y < -9 && !this.dead) {
      ctx.onFall && ctx.onFall();
    }

    // ---------------- animation ----------------
    this._animate(dt, ctx);
    this.group.position.set(PLAYER_X, this.y, 0);
  }

  _doJump(v) {
    this.vy = v;
    this.grounded = false;
    this.state = ST_AIR;
    this.coyote = 0;
  }

  _animate(dt, ctx) {
    const p = this.parts;
    if (!p.legL) return;
    const speedN = clamp((ctx.speed - SPEED.start) / (SPEED.max - SPEED.start), 0, 1);
    const body = p.body;

    // landing squash: hard hits compress the frame for a beat
    if (this.landEvent) this._squash = clamp(-this.landEvent * 0.026, 0, 0.3);
    this._squash = damp(this._squash, 0, 9, dt);
    const sqY = 1 - this._squash;
    const sqX = 1 + this._squash * 0.55;

    if (this.state === ST_RUN) {
      // stride frequency scales with speed; legs counter-swing
      this.runPhase += dt * (5.2 + speedN * 4.6);
      const s = Math.sin(this.runPhase);
      const c = Math.cos(this.runPhase);
      p.legL.rotation.x = s * 1.05;
      p.legR.rotation.x = -s * 1.05;
      if (p.armL) p.armL.rotation.x = -s * 0.75;
      if (p.armR) p.armR.rotation.x = s * 0.75;
      // torso lean grows with speed; bob synced to stride
      const lean = 0.14 + speedN * 0.22;
      body.rotation.z = damp(body.rotation.z, 0, 8, dt);
      body.rotation.x = damp(body.rotation.x, lean, 10, dt); // pitch forward into the sprint
      body.position.y = Math.abs(c) * 0.09 + Math.abs(s) * 0.02;
      body.scale.set(sqX, sqY, sqX);
      if (p.head) p.head.rotation.x = damp(p.head.rotation.x, -lean * 0.4, 8, dt); // eyes up toward the read line
      if (p.pack) p.pack.rotation.x = damp(p.pack.rotation.x, -0.1 - speedN * 0.15, 8, dt);
      if (p.wingL) {
        p.wingL.rotation.z = damp(p.wingL.rotation.z, 0.35, 8, dt);
        p.wingR.rotation.z = damp(p.wingR.rotation.z, -0.35, 8, dt);
      }
    } else if (this.state === ST_SLIDE) {
      // low profile: body reclines, legs extended toward the oncoming side
      p.legL.rotation.x = damp(p.legL.rotation.x, -0.9, 14, dt);
      p.legR.rotation.x = damp(p.legR.rotation.x, -1.15, 14, dt);
      if (p.armL) {
        p.armL.rotation.x = damp(p.armL.rotation.x, 0.6, 14, dt); // arms trail behind
        p.armR.rotation.x = damp(p.armR.rotation.x, 0.6, 14, dt);
      }
      body.rotation.x = damp(body.rotation.x, -0.55, 12, dt); // recline, feet-first
      body.position.y = damp(body.position.y, -0.62, 14, dt);
      body.scale.set(sqX, sqY, sqX);
      if (p.head) p.head.rotation.x = damp(p.head.rotation.x, 0.5, 10, dt); // head tips up to still see ahead
    } else if (this.state === ST_AIR) {
      const rising = this.vy > 1;
      const jetting = this.jetT > 0 || this.jetPowerup > 0 && this.vy > -4;
      if (jetting) {
        // transform flourish: body noses forward, legs trail, arms tuck, wings out
        p.legL.rotation.x = damp(p.legL.rotation.x, 0.5, 10, dt);  // trailing
        p.legR.rotation.x = damp(p.legR.rotation.x, 0.62, 10, dt);
        if (p.armL) {
          p.armL.rotation.x = damp(p.armL.rotation.x, 1.1, 10, dt); // tucked back
          p.armR.rotation.x = damp(p.armR.rotation.x, 1.1, 10, dt);
        }
        body.rotation.x = damp(body.rotation.x, 1.15, 8, dt); // near-horizontal flight pose
        body.position.y = damp(body.position.y, 0.35, 10, dt);
        if (p.wingL) {
          p.wingL.rotation.z = damp(p.wingL.rotation.z, 1.1, 10, dt);
          p.wingR.rotation.z = damp(p.wingR.rotation.z, -1.1, 10, dt);
        }
        if (p.head) p.head.rotation.x = damp(p.head.rotation.x, -0.7, 10, dt); // head levels to face ahead
      } else {
        // ballistic arc: rise = legs trail behind, fall = legs reach forward to brace
        const t = clamp(this.vy / PHYS.jumpVel, -1, 1);
        p.legL.rotation.x = damp(p.legL.rotation.x, rising ? 0.55 : -0.5, 10, dt);
        p.legR.rotation.x = damp(p.legR.rotation.x, rising ? 0.25 : -0.2, 10, dt);
        if (p.armL) {
          p.armL.rotation.x = damp(p.armL.rotation.x, rising ? 1.2 : -0.9, 10, dt); // windmill up / brace forward
          p.armR.rotation.x = damp(p.armR.rotation.x, rising ? 1.2 : -0.9, 10, dt);
        }
        body.rotation.x = damp(body.rotation.x, 0.18 + (rising ? 0 : -0.15) + t * -0.1, 8, dt);
        body.position.y = damp(body.position.y, 0.12, 10, dt);
        if (p.wingL) {
          p.wingL.rotation.z = damp(p.wingL.rotation.z, 0.55, 8, dt);
          p.wingR.rotation.z = damp(p.wingR.rotation.z, -0.55, 8, dt);
        }
      }
    }
    this.jetT = Math.max(0, this.jetT - dt);

    // invulnerability blink
    if (this.mecha) this.mecha.visible = this.invuln <= 0 || Math.floor(this.invuln * 18) % 2 === 0;
  }

  die(kind) {
    if (this.state === ST_DEAD) return;
    this.state = ST_DEAD;
    this.dead = true;
    this.deadT = 0;
    this.tumble = 0;
    this.vy = kind === 'wall' || kind === 'hit' ? 9 : 4;
    if (this.mecha) this.mecha.visible = true;
  }
}
