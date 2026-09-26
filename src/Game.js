// Game orchestrator — states: title(attract) / running / paused / dead / gameover.
import * as THREE from 'three';
import { PLAYER_X, SPEED, SCORE, POWERUPS, PHYS, QUALITY, KILL_X } from './core/config.js';
import { clamp } from './core/utils.js';
import { Input } from './core/Input.js';
import { Storage } from './core/Storage.js';
import { Player } from './runner/Player.js';
import { Track } from './runner/Track.js';
import { City } from './world/City.js';
import { Sky, PALETTE } from './world/Sky.js';
import { Lighting } from './world/Lighting.js';
import { Particles } from './fx/Particles.js';
import { CameraRig } from './fx/CameraRig.js';
import { Post } from './fx/Post.js';
import { Audio } from './audio/Audio.js';
import { HUD } from './ui/HUD.js';
import { Menus } from './ui/Menus.js';

const _NIGHT_FOG = new THREE.Color(0x0c1524);

const MISSION_POOL = [
  { id: 'd400', name: 'RUN 400m IN ONE RUN', key: 'distance', target: 400 },
  { id: 'd1000', name: 'RUN 1,000m IN ONE RUN', key: 'distance', target: 1000 },
  { id: 'c25', name: 'COLLECT 25 CELLS IN ONE RUN', key: 'cells', target: 25 },
  { id: 'c80', name: 'COLLECT 80 CELLS IN ONE RUN', key: 'cells', target: 80 },
  { id: 'nm3', name: 'NEAR-MISS 3 TIMES IN ONE RUN', key: 'nearMisses', target: 3 },
  { id: 'sl8', name: 'SLIDE 6 OBSTACLES IN ONE RUN', key: 'slides', target: 6 },
  { id: 'sp22', name: 'REACH 22 u/s', key: 'topSpeed', target: 22 },
  { id: 'jb12', name: 'JET-BOOST 12 TIMES IN ONE RUN', key: 'jets', target: 12 },
  { id: 'sc15k', name: 'SCORE 15,000 IN ONE RUN', key: 'score', target: 15000 },
  { id: 'sv60', name: 'SURVIVE 60s IN ONE RUN', key: 'timeAlive', target: 60 },
];

export class Game {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(PALETTE.fog.getHex(), 55, 250);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);

    this.storage = new Storage();
    this.input = new Input();
    this.audio = new Audio();
    this.hud = new HUD();
    this.menus = new Menus(this);

    this.quality = this._resolveQuality();
    this.sky = new Sky(this.scene);
    this.city = new City(this.scene, this.quality);
    this.lighting = new Lighting(this.scene, this.quality);
    this.track = new Track(this.scene);
    this.player = new Player(this.scene);
    this.particles = new Particles(this.scene, this.quality.particles);
    this.camRig = new CameraRig(this.camera);
    this.post = new Post(renderer, this.scene, this.camera, this.quality);

    // PMREM environment for metals/glass
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(Sky.makeEnvScene(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.state = 'loading';
    this.speed = SPEED.start;
    this.score = 0;
    this.distance = 0;
    this.cells = 0;
    this.combo = 1;
    this.comboCount = 0;
    this.comboT = 0;
    this.nearMisses = 0;
    this.slides = 0;
    this.jets = 0;
    this.jumps = 0;
    this.topSpeed = SPEED.start;
    this.timeAlive = 0;
    this.nextMilestone = SCORE.milestoneEvery;
    this.deathCause = '';
    this.autopilot = false;
    this._auto = {};
    this._pauseT = 0;
    this._deathSlowmo = 1;
    this.power = { shield: 0, magnet: 0, surge: 0, jet: 0 };

    this.missionList = this._buildMissions();

    window.addEventListener('resize', () => this._resize());
    // first gesture unlocks audio
    const unlock = () => {
      this.audio.init();
      this.audio.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  async load() {
    await Promise.all([this.player.load(), this.track.loadAssets()]);
    document.getElementById('loading').style.display = 'none';
    this.toTitle();
  }

  _resolveQuality() {
    const q = this.storage?.settings?.quality || 'auto';
    if (q !== 'auto') return QUALITY[q];
    // auto: heuristics — mobile/small screen or weak hint → med, else high
    const small = Math.min(innerWidth, innerHeight) < 700;
    const mobile = /Mobi|Android/i.test(navigator.userAgent);
    return mobile || small ? QUALITY.med : QUALITY.high;
  }

  applyQuality() {
    this.quality = this._resolveQuality();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pixelRatio));
    this.post.setQuality(this.quality);
    this.lighting.setQuality(this.quality);
    this.particles.setBudget(this.quality.particles);
    this._resize();
  }

  _resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    const urlPx = parseFloat(new URLSearchParams(location.search).get('px') || '');
    const px = Number.isFinite(urlPx) ? urlPx : Math.min(devicePixelRatio, this.quality.pixelRatio);
    this.renderer.setPixelRatio(px);
    this.post.setSize(innerWidth, innerHeight);
  }

  // ------------------------- missions --------------------------------------
  _buildMissions() {
    const st = this.storage;
    // 3 active missions drawn deterministically per epoch
    const done = MISSION_POOL.filter((m) => st.missionState[m.id]?.done).map((m) => m.id);
    const open = MISSION_POOL.filter((m) => !done.includes(m.id));
    if (open.length < 3) {
      // epoch rollover — clear done flags, restart pool
      for (const m of MISSION_POOL) delete st.missionState[m.id];
      st.missionEpoch++;
      open.push(...MISSION_POOL);
      st.save();
    }
    const start = (st.missionEpoch * 3) % Math.max(1, open.length);
    const pick3 = [];
    for (let i = 0; i < open.length && pick3.length < 3; i++) {
      pick3.push(open[(start + i) % open.length]);
    }
    return pick3.map((m) => ({
      ...m,
      prog: '0',
      done: false,
      _v: 0,
    }));
  }

  _updateMissions() {
    const vals = {
      distance: Math.floor(this.distance),
      cells: this.cells,
      nearMisses: this.nearMisses,
      slides: this.slides,
      topSpeed: this.topSpeed,
      jets: this.jets,
      score: Math.floor(this.score),
      timeAlive: Math.floor(this.timeAlive),
    };
    for (const m of this.missionList) {
      if (m.done) continue;
      m._v = vals[m.key] || 0;
      m.prog = `${Math.min(m._v, m.target).toLocaleString()}/${m.target.toLocaleString()}`;
      if (m._v >= m.target) {
        m.done = true;
        m.prog = 'DONE';
        this.hud.announce('MISSION COMPLETE', m.name, 2.2);
        this.audio.milestone();
        this.storage.missionState[m.id] = { done: true };
        this.storage.save();
      }
    }
  }

  // ------------------------- state transitions ------------------------------
  toTitle() {
    this.state = 'title';
    this.autopilot = true;
    this._resetRun();
    this.speed = SPEED.start * 0.75;
    this.hud.show(false);
    this.hud.setTouch(false);
    this.menus.title();
    this.audio.setMusicOn(true);
    this.audio.setIntensity(0.15);
  }

  startRun() {
    this.menus.close();
    this._resetRun();
    this.state = 'running';
    this.autopilot = false;
    this.hud.show(true);
    this.hud.setTouch(this.input.isTouch);
    this.hud.announce('RUN', 'the perimeter is collapsing behind you', 1.4);
    this.audio.init();
    this.audio.resume();
    this.audio.setMusicOn(true);
    this.audio.go();
    this.camRig.startIntro();
    if (!this.storage.seenHints.jump) {
      this.hud.hint('<span class="key">SPACE</span> JUMP — hold for higher', 3.4);
      this.storage.seenHints.jump = true;
      this.storage.save();
    }
  }

  _resetRun() {
    this.track.reset();
    this.player.reset();
    this.speed = SPEED.start;
    this.score = 0;
    this.distance = 0;
    this.cells = 0;
    this.combo = 1;
    this.comboCount = 0;
    this.comboT = 0;
    this.nearMisses = 0;
    this.slides = 0;
    this.jets = 0;
    this.jumps = 0;
    this.topSpeed = SPEED.start;
    this.timeAlive = 0;
    this.nextMilestone = SCORE.milestoneEvery;
    this._deathSlowmo = 1;
    this._pulse = 1; // near-miss time dip
    this.power = { shield: 0, magnet: 0, surge: 0, jet: 0 };
    this.hud.setDanger(false);
    this.missionList = this._buildMissions();
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.menus.pause();
    this.audio.setSpeed(0, false);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.menus.close();
    this.state = 'running';
  }

  quitToTitle() {
    this.toTitle();
  }

  _die(cause) {
    if (this.state !== 'running') return;
    // playtest instrumentation — what killed us and what was around
    this.lastDeath = {
      cause,
      dist: Math.round(this.distance),
      speed: +this.speed.toFixed(1),
      py: +this.player.y.toFixed(2),
      pstate: this.player.state,
      pads: this.track.pads
        .filter((p) => p.x < PLAYER_X + 10 && p.x + p.len > PLAYER_X - 15)
        .map((p) => ({ x: +p.x.toFixed(1), len: +p.len.toFixed(1), y: +p.y.toFixed(1) })),
      obs: this.track.obstacles
        .filter((o) => o.x > PLAYER_X - 25 && o.x < PLAYER_X + 15)
        .map((o) => `${o.type}@${o.x.toFixed(0)}`),
      apLog: (this._apLog || []).slice(-30),
    };
    this.state = 'dead';
    this.deathCause = cause;
    this.player.die(cause);
    this.audio.death();
    this.camRig.addShake(0.9);
    this.post.flash(this.storage.settings.reduceFlash ? 0.12 : 0.3);
    this.hud.hurt();
    this.hud.setDanger(false);
    this.particles.hitBurst(PLAYER_X, this.player.y);
    this._deathSlowmo = 0.25;
    this.audio.setSpeed(0, false);
  }

  _gameOver() {
    this.state = 'gameover';
    const isBest = this.score > this.storage.bestScore;
    if (isBest) {
      this.storage.bestScore = Math.floor(this.score);
      this.storage.bestDistance = Math.max(this.storage.bestDistance, Math.floor(this.distance));
      this.audio.newBest();
    }
    const lt = this.storage.lifetime;
    lt.runs += 1;
    lt.cells += this.cells;
    lt.distance += Math.floor(this.distance);
    lt.nearMisses += this.nearMisses;
    lt.slides += this.slides;
    lt.jumps += this.jumps;
    this.storage.save();
    this.menus.gameOver(
      {
        score: Math.floor(this.score),
        distance: Math.floor(this.distance),
        cells: this.cells,
        topSpeed: this.topSpeed,
        nearMisses: this.nearMisses,
        best: this.storage.bestScore,
        cause: this.deathCause,
        missions: this.missionList,
      },
      isBest
    );
    this.audio.setIntensity(0.15);
  }

  // ------------------------- combo / score ---------------------------------
  _addScore(points) {
    const mult = Math.min(SCORE.comboMax, this.combo) * (this.power.surge > 0 ? 2 : 1);
    this.score += points * mult;
  }

  _bumpCombo() {
    this.comboCount++;
    this.comboT = SCORE.comboWindow;
    const level = Math.min(SCORE.comboMax, 1 + Math.floor(this.comboCount / 4));
    if (level > this.combo) {
      this.combo = level;
      if (level === 4 || level === 8) {
        this.hud.announce(`COMBO ×${level}`, '', 1.1);
        this.audio.milestone();
      }
    }
  }

  // ------------------------- autopilot --------------------------------------
  _autopilotThink() {
    const a = this._auto;
    a.autoJump = false;
    a.autoSlide = false;
    a.autoJumpHeld = false;
    const speed = this.speed;
    // gap check: floor disappears ahead and we're grounded → jump
    // later trigger at speed so the arc clears the far edge instead of landing on it
    const aheadGap = this.track.floorYAt(PLAYER_X + speed * 0.30 + 0.6) === null && this.player.grounded;
    const floorNow = this.track.floorYAt(PLAYER_X);
    // rising wall check: scan the next reaction window — a gap between probes
    // must not hide a higher pad's leading face
    let wallAhead = false;
    // near probes catch a lip right at the player's feet; far probes give lead time
    for (let i = 0; i <= 8; i++) {
      const fy = this.track.floorYAt(PLAYER_X + i * (speed * 0.09 + 0.55));
      if (fy !== null && fy - this.player.y > 0.55) {
        wallAhead = true;
        break;
      }
    }

    let nearest = null;
    let nearestD = 1e9;
    for (const o of this.track.obstacles) {
      const d = o.x - PLAYER_X;
      if (d > 0.5 && d < nearestD) {
        nearest = o;
        nearestD = d;
      }
    }
    if (!this._apLog) this._apLog = [];
    this._apLog.push({ py: +this.player.y.toFixed(2), gs: this.player.grounded, pstate: this.player.state, j: a.autoJump ? 1 : 0, wall: wallAhead, gap: aheadGap });
    if (this._apLog.length > 80) this._apLog.shift();
    if (nearest) {
      const jumpDist = speed * 0.58 + 1.2;
      const t = nearest.type;
      // laserLow beam now spans 1.22–2.6 — slidable. laserHigh hugs the deck — jump it.
      const slideTypes = ['beam', 'laserLow', 'droneHigh'];
      const jumpTypes = ['barrier', 'laserHigh', 'droneLow', 'block'];
      if (slideTypes.includes(t) && nearestD < speed * 0.5 + 1.5) a.autoSlide = true;
      if (jumpTypes.includes(t) && nearestD < jumpDist) {
        a.autoJump = true;
        a.autoJumpHeld = t === 'block';
      }
    }
    if ((aheadGap || wallAhead) && this.player.grounded) {
      a.autoJump = true;
      a.autoJumpHeld = true;
    }
    // falling in a gap → jet boost back
    if (floorNow === null && !this.player.grounded && this.player.vy < -6 && this.player.jumpsLeft > 0) {
      a.autoJump = true;
    }
    // airborne and the next pad's lip is ahead-above us → burn the jet to clear it
    if (!this.player.grounded && this.player.jumpsLeft > 0) {
      const lipY = this.track.floorYAt(PLAYER_X + speed * 0.16 + 0.5);
      if (lipY !== null && lipY - this.player.y > 0.35 && this.player.vy < 4) {
        a.autoJump = true;
        a.autoJumpHeld = true;
      }
    }
    return a;
  }

  // ------------------------- per-frame -------------------------------------
  update(dt, time) {
    const st = this.state;
    this.post.update(dt, this.speed / SPEED.max);

    // global input
    if (this.input.justPressed('pause')) {
      if (st === 'running') this.pause();
      else if (st === 'paused') this.resume();
    }
    if (this.menus.visible) this.menus.handleInput();
    if (st === 'title' && (this.input.justPressed('jump') || this.input.pressed.has('Enter'))) {
      // handled by menu confirm — nothing extra
    }
    if (st === 'gameover' && this.input.justPressed('jump')) {
      // menu item "RUN AGAIN" is selected by default; menu handles it
    }

    if (st === 'running' || st === 'dead' || st === 'title') {
      // ---------- speed ramp ----------
      if (st === 'running') {
        const target = SPEED.max - (SPEED.max - SPEED.start) * Math.exp(-this.timeAlive / SPEED.rampT);
        this.speed += (target - this.speed) * (1 - Math.exp(-dt * 2));
        this.topSpeed = Math.max(this.topSpeed, this.speed);
        this.timeAlive += dt;
        this.distance += this.speed * dt;
        this.score += this.speed * dt * SCORE.perMeter * 0.1;
        this.comboT = Math.max(0, this.comboT - dt);
        if (this.comboT <= 0 && this.comboCount > 0) {
          this.comboCount = 0;
          this.combo = 1;
        }
        for (const k of Object.keys(this.power)) this.power[k] = Math.max(0, this.power[k] - dt);
        if (this.distance >= this.nextMilestone) {
          this.hud.announce(`${this.nextMilestone}m`, `+${SCORE.milestone} BONUS`, 1.4);
          this._addScore(SCORE.milestone);
          this.audio.milestone();
          this.nextMilestone += SCORE.milestoneEvery;
        }
        this._updateMissions();
        this.audio.setIntensity(clamp(0.15 + (this.speed / SPEED.max) * 0.55 + this.combo * 0.04, 0, 1));
        this.audio.setSpeed((this.speed - SPEED.start) / (SPEED.max - SPEED.start), true);
      }
      if (st === 'title') {
        this.speed = SPEED.start * 0.75;
      }
      // death slow-mo then gameover
      if (st === 'dead') {
        this._deathSlowmo = Math.min(1, this._deathSlowmo + dt * 0.9);
        if (this.player.deadT > 1.35) this._gameOver();
      }
      this._pulse = Math.min(1, this._pulse + dt * 3.2);
      const simDt = dt * (st === 'dead' ? this._deathSlowmo : 1) * this._pulse;
      const runSpeed = st === 'dead' ? this.speed * this._deathSlowmo : this.speed * this._pulse;

      // ---------- autopilot context ----------
      const ctx = {
        speed: runSpeed,
        floorY: this.track.floorYAt(PLAYER_X),
        autopilot: this.autopilot,
        ...(this.autopilot ? this._autopilotThink() : {}),
        onLand: (vy) => {
          const hard = vy < PHYS.landHardVy;
          this.particles.landBurst(PLAYER_X, this.player.y, hard);
          this.audio.land(hard);
          this.camRig.landDip(vy);
          if (hard) this.camRig.addShake(0.25);
        },
        onJet: () => {
          this.jets++;
          this.audio.jet();
        },
        onSlide: () => this.audio.slide(),
        onFall: () => this._die('LOST TO THE VOID'),
      };

      // slide-contextual hint once
      if (st === 'running' && !this.storage.seenHints.slide) {
        const b = this.track.obstacles.find((o) => (o.type === 'beam' || o.type === 'laserLow') && o.x - PLAYER_X > 4 && o.x - PLAYER_X < 22);
        if (b) {
          this.hud.hint('<span class="key">S</span> / <span class="key">↓</span> SLIDE under the beam', 3);
          this.storage.seenHints.slide = true;
          this.storage.save();
        }
      }

      this.player.update(simDt, this.input, ctx);

      // ---------- collisions ----------
      if (st === 'running') {
        const evs = this.track.collide(this.player.y, this.player.hitH, this.player.state === 'slide', {
          magnet: this.power.magnet > 0,
          dt: simDt,
        });
        for (const ev of evs) {
          if (ev.kind === 'cell') {
            this.cells++;
            this._bumpCombo();
            this._addScore(SCORE.cell);
            this.particles.cellPop(ev.cell.x, ev.cell.y);
            this.audio.cell(this.comboCount);
          } else if (ev.kind === 'nearmiss') {
            this.nearMisses++;
            this._bumpCombo();
            this._addScore(SCORE.nearMiss);
            this.particles.nearMissFx(PLAYER_X + 0.5, this.player.y + 1);
            this.audio.nearMiss();
            this.hud.announce('NEAR MISS', `+${SCORE.nearMiss * Math.min(this.combo, SCORE.comboMax)}`, 0.7);
            if (!this.storage.settings.reduceMotion) this._pulse = 0.55; // split-second time dip sells the graze
          } else if (ev.kind === 'powerup') {
            this._applyPowerup(ev.powerup.type);
          } else if (ev.kind === 'hit' || ev.kind === 'wall') {
            if (this.player.invuln > 0) continue;
            if (this.power.shield > 0) {
              // shield eats the hit — obstacle shatters, brief stumble
              this.power.shield = 0;
              this.player.invuln = 1.4;
              this.speed *= SPEED.stumblePenalty;
              this.camRig.addShake(0.55);
              this.post.flash(this.storage.settings.reduceFlash ? 0.08 : 0.2);
              this.particles.hitBurst(ev.obstacle ? ev.obstacle.x : PLAYER_X + 1, this.player.y + 1);
              if (ev.obstacle) {
                ev.obstacle.mesh.visible = false;
                ev.obstacle.x = KILL_X - 1;
              }
              this.audio.hit();
              this.hud.announce('SHIELD DOWN', '', 1);
            } else {
              this._die(ev.kind === 'wall' ? 'IMPACT — STRUCTURE WALL' : 'OBSTACLE IMPACT');
            }
          }
        }
      }

      // ---------- world update ----------
      this.track.update(simDt, runSpeed, time, st === 'running');
      this.city.update(dt, runSpeed, time);
      this.sky.update(dt, st === 'running' ? clamp(this.timeAlive / 240, 0, 1) : 0);
      this.sky.followCamera(this.camera.position.x);
      this.lighting.update(dt, this.player.y);
      this.camRig.enabled.shake = this.storage.settings.shake;
      this.camRig.enabled.motion = !this.storage.settings.reduceMotion;
      this.camRig.update(dt, this.player, this.speed, st, this.storage.settings.reduceMotion);
      this.particles.update(simDt, runSpeed, this.camera.position.x);

      // run-feel particles + engine
      if (st === 'running' && this.player.grounded && this.player.state !== 'slide') {
        this.particles.runDust(PLAYER_X - 0.3, this.player.y, this.speed);
      }
      if (this.player.state === 'slide' && this.player.grounded) {
        this.particles.slideScrape(PLAYER_X, this.player.y);
      }
      if (this.player.jetT > 0 || (this.power.jet > 0 && !this.player.grounded)) {
        const t = this.combo >= 8 ? [0.85, 0.5, 1] : this.combo >= 4 ? [1, 0.75, 0.2] : null;
        this.particles.jetFlare(PLAYER_X - 0.4, this.player.y + 0.9, t); // exhaust shifts gold→violet with combo
      }
      const inDanger = this.player.y < -2;
      this.hud.setDanger(inDanger);
      if (inDanger) {
        this._alarmT = (this._alarmT || 0) - dt;
        if (this._alarmT <= 0) { this.audio.fallAlarm(); this._alarmT = 0.55; }
        this.post.dangerPulse(0.4);
      } else this._alarmT = 0;
    }

    if (st === 'running') this.hud.update(dt, this);

    this.input.endFrame();
  }

  _applyPowerup(type) {
    this.audio.powerup();
    this.particles.cellPop(PLAYER_X, this.player.y + 1.4);
    const P = POWERUPS;
    if (type === 'shield') {
      this.power.shield = P.shieldTime;
      this.hud.announce('SHIELD ONLINE', 'one hit absorbed', 1.4);
    } else if (type === 'magnet') {
      this.power.magnet = P.magnetTime;
      this.hud.announce('CELL MAGNET', 'cells drift to you', 1.4);
    } else if (type === 'surge') {
      this.power.surge = P.surgeTime;
      this.hud.announce('SURGE ×2', 'double score', 1.4);
    } else if (type === 'jet') {
      this.power.jet = P.jetTime;
      this.hud.announce('JETSTREAM', 'unlimited boost', 1.4);
    }
  }

  render() {
    this.post.render();
  }

  // testing hook: fast-forward n sim frames (no render) — software-GL VMs run ~1fps
  step(n = 1, dt = 1 / 60) {
    for (let i = 0; i < n; i++) {
      this.time = (this.time || 0) + dt;
      this.update(dt, this.time);
    }
    this.render();
    return { state: this.state, dist: Math.round(this.distance), score: Math.round(this.score), speed: +this.speed.toFixed(1) };
  }
}
