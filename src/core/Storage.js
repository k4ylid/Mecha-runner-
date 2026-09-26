import { STORAGE_KEYS } from './config.js';

const DEFAULTS = {
  quality: 'auto', // auto | low | med | high
  music: 0.75,
  sfx: 0.9,
  shake: true,
  reduceFlash: false, // dampens hurt flash / bloom pops
  reduceMotion: false, // kills camera shake & FOV kick
  showFps: false,
};

export class Storage {
  constructor() {
    this.settings = { ...DEFAULTS };
    // persisted bests + lifetime stats + mission state
    this.bestScore = 0;
    this.bestDistance = 0;
    this.lifetime = { runs: 0, cells: 0, distance: 0, nearMisses: 0, slides: 0, jumps: 0 };
    this.missionState = {}; // id -> { progress, done }
    this.missionEpoch = 0;
    this.seenHints = {};
    this.load();
  }

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
      Object.assign(this.settings, s);
      const b = JSON.parse(localStorage.getItem(STORAGE_KEYS.bests) || '{}');
      this.bestScore = b.bestScore || 0;
      this.bestDistance = b.bestDistance || 0;
      this.seenHints = b.seenHints || {};
      const lt = JSON.parse(localStorage.getItem(STORAGE_KEYS.lifetime) || '{}');
      Object.assign(this.lifetime, lt);
      const m = JSON.parse(localStorage.getItem(STORAGE_KEYS.missions) || '{}');
      this.missionState = m.missionState || {};
      this.missionEpoch = m.missionEpoch || 0;
    } catch (_) { /* defaults */ }
  }

  save() {
    try {
      const prev = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
      localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify({ ...prev, ...this.settings })
      );
      localStorage.setItem(
        STORAGE_KEYS.bests,
        JSON.stringify({
          bestScore: this.bestScore,
          bestDistance: this.bestDistance,
          seenHints: this.seenHints,
        })
      );
      localStorage.setItem(STORAGE_KEYS.lifetime, JSON.stringify(this.lifetime));
      localStorage.setItem(
        STORAGE_KEYS.missions,
        JSON.stringify({ missionState: this.missionState, missionEpoch: this.missionEpoch })
      );
    } catch (_) { /* storage unavailable */ }
  }
}
