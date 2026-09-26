// Fully synthesized WebAudio — zero audio assets.
// SFX are one-shot synth voices; music is a lookahead-scheduled generative
// loop whose layers unlock as intensity (speed/combo) rises.
import { clamp } from '../core/utils.js';

const SCALE = [0, 3, 5, 7, 10, 12, 15, 12, 10, 7]; // minor pentatonic-ish climb
const BPM = 116;
const STEPB = 60 / BPM / 4; // 16th note

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicVol = 0.75;
    this.sfxVol = 0.9;
    this.intensity = 0; // 0..1 — drives music layers
    this._step = 0;
    this._nextT = 0;
    this._musicOn = false;
    this._engineNodes = null;
  }

  // must be called from a user gesture
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const c = this.ctx;
      this.master = c.createGain();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(this.master);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = this.musicVol * 0.5;
      this.musicBus.connect(this.master);
      this.master.gain.value = 0.9;
      this._noiseBuf = this._makeNoise();
      this._startEngine();
      this._startScheduler();
    } catch (e) {
      console.warn('audio unavailable', e);
      this.enabled = false;
    }
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.value = music * 0.5;
    this.sfxBus.gain.value = sfx;
  }

  resume() {
    this.ctx?.resume?.();
  }

  _makeNoise() {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _env(node, t0, a, peak, d, end = 0.0001) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(end, t0 + a + d);
  }

  _osc(type, freq, t0, dur, gain = 0.2, dest = null) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    this._env(g, t0, 0.005, gain, dur);
    o.connect(g);
    g.connect(dest || this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  _noise(t0, dur, gain = 0.2, { type = 'lowpass', freq = 1200, q = 1, sweepTo = null } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    this._env(g, t0, 0.004, gain, dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ----------------------------- SFX ---------------------------------------
  jump() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.18, 0.1, { type: 'bandpass', freq: 800, sweepTo: 2400, q: 2 });
    const o = this._osc('sine', 240, t, 0.16, 0.14);
    o.frequency.exponentialRampToValueAtTime(560, t + 0.14);
  }

  jet() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.4, 0.22, { type: 'bandpass', freq: 900, sweepTo: 3400, q: 1.4 });
    const o = this._osc('sawtooth', 180, t, 0.4, 0.12);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.35);
  }

  slide() {
    if (!this.ctx) return;
    this._noise(this.ctx.currentTime, 0.3, 0.12, { type: 'highpass', freq: 2200, q: 0.6 });
  }

  land(hard) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this._osc('sine', hard ? 130 : 100, t, 0.16, hard ? 0.3 : 0.16);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    this._noise(t, 0.1, hard ? 0.18 : 0.08, { type: 'lowpass', freq: 500 });
  }

  cell(comboStep = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const note = SCALE[clamp(comboStep, 0, SCALE.length - 1)];
    const f = 440 * Math.pow(2, note / 12);
    const o = this._osc('sine', f, t, 0.3, 0.16);
    o.frequency.setValueAtTime(f, t);
    this._osc('sine', f * 2, t, 0.18, 0.05);
  }

  // falling alarm: urgent low pulse — played while the player is below deck
  fallAlarm() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('sine', 190, t, 0.3, 0.12).frequency.exponentialRampToValueAtTime(95, t + 0.28);
    this._noise(t, 0.25, 0.06, { type: 'lowpass', freq: 500 });
  }

  nearMiss() {
    if (!this.ctx) return;
    this._noise(this.ctx.currentTime, 0.22, 0.1, { type: 'bandpass', freq: 3000, sweepTo: 1200, q: 2.5 });
  }

  powerup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 5, 12].forEach((n, i) => {
      this._osc('triangle', 440 * Math.pow(2, n / 12), t + i * 0.07, 0.24, 0.14);
    });
  }

  milestone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('square', 523, t, 0.1, 0.1);
    this._osc('square', 784, t + 0.11, 0.22, 0.12);
  }

  hit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 0.3, 0.4, { type: 'lowpass', freq: 1400, sweepTo: 200 });
    const o = this._osc('sawtooth', 140, t, 0.35, 0.25);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  }

  death() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, 1.1, 0.5, { type: 'lowpass', freq: 2000, sweepTo: 90 });
    const o = this._osc('sine', 200, t, 0.9, 0.4);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.85);
    this._osc('square', 220, t + 0.35, 0.5, 0.06);
    this._osc('square', 165, t + 0.5, 0.6, 0.06);
  }

  ui() {
    if (!this.ctx) return;
    this._osc('square', 880, this.ctx.currentTime, 0.05, 0.05);
  }

  count() {
    if (!this.ctx) return;
    this._osc('square', 660, this.ctx.currentTime, 0.07, 0.08);
  }

  go() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('square', 660, t, 0.09, 0.1);
    this._osc('square', 990, t + 0.09, 0.24, 0.12);
  }

  newBest() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 7, 12, 19].forEach((n, i) => {
      this._osc('triangle', 440 * Math.pow(2, n / 12), t + i * 0.09, 0.4, 0.13);
    });
  }

  // ----------------------------- engine loop --------------------------------
  _startEngine() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 300;
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    const hum = c.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 55;
    const humG = c.createGain();
    humG.gain.value = 0;
    hum.connect(humG);
    humG.connect(this.master);
    hum.start();
    this._engineNodes = { f, g, hum, humG };
  }

  // speed 0..1, called per frame — wind rush + servo hum
  setSpeed(n, running) {
    if (!this._engineNodes) return;
    const { f, g, hum, humG } = this._engineNodes;
    const target = running ? 0.028 + n * 0.1 : 0;
    g.gain.value += (target - g.gain.value) * 0.06;
    f.frequency.value = 240 + n * 1900;
    humG.gain.value += ((running ? 0.017 + n * 0.03 : 0) - humG.gain.value) * 0.06;
    hum.frequency.value = 50 + n * 46;
  }

  // ----------------------------- music --------------------------------------
  setMusicOn(on) {
    this._musicOn = on;
  }

  setIntensity(v) {
    this.intensity = clamp(v, 0, 1);
  }

  _startScheduler() {
    this._nextT = this.ctx.currentTime + 0.1;
    setInterval(() => this._schedule(), 40);
  }

  _schedule() {
    if (!this.ctx || !this._musicOn) return;
    const c = this.ctx;
    while (this._nextT < c.currentTime + 0.18) {
      this._playStep(this._step, this._nextT);
      this._nextT += STEPB;
      this._step = (this._step + 1) % 64;
    }
  }

  _playStep(s, t) {
    const c = this.ctx;
    const I = this.intensity;
    const bar = (s / 16) | 0; // 4 bars of 16 steps
    const st = s % 16;
    const bassNotes = [0, 0, -2, 0, -4, -4, -2, 0]; // A A G A  F F G A (A minor-ish)
    const bassN = bassNotes[(bar * 2 + (st >> 3)) % bassNotes.length];
    const bassF = 55 * Math.pow(2, bassN / 12);

    // kick on quarters once intensity > .15
    if (st % 4 === 0 && I > 0.15) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
      this._env(g, t, 0.004, 0.5, 0.18);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.25);
    }
    // bass on 8ths
    if (st % 2 === 0 && I > 0.05) {
      const o = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = bassF;
      f.type = 'lowpass';
      f.frequency.value = 300 + I * 900;
      this._env(g, t, 0.008, 0.16, STEPB * 1.6);
      o.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + STEPB * 2);
    }
    // arp 16ths — opens up with intensity
    if (I > 0.35) {
      const arpN = [0, 3, 7, 12, 15, 12, 7, 3][s % 8] + (bar === 3 ? -2 : 0);
      const o = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      o.type = 'square';
      o.frequency.value = 220 * Math.pow(2, arpN / 12);
      f.type = 'lowpass';
      f.frequency.value = 700 + I * 2600;
      this._env(g, t, 0.004, 0.045 + I * 0.04, STEPB * 0.9);
      o.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + STEPB);
    }
    // hats offbeat
    if (st % 4 === 2 && I > 0.5) {
      const src = c.createBufferSource();
      src.buffer = this._noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 8000;
      const g = c.createGain();
      this._env(g, t, 0.002, 0.05, 0.04);
      src.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      src.start(t, Math.random());
      src.stop(t + 0.06);
    }
    // pad swell at bar starts when calm
    if (st === 0 && I <= 0.35) {
      const chord = [220, 261.6, 329.6];
      for (const fr of chord) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = fr;
        this._env(g, t, 0.6, 0.03, 3.2, 0.001);
        o.connect(g);
        g.connect(this.musicBus);
        o.start(t);
        o.stop(t + 4);
      }
    }
  }
}
