import { DEFAULT_BINDINGS, ALT_BINDINGS, STORAGE_KEYS } from './config.js';

const ACTIONS = ['jump', 'slide', 'pause'];
// standard-layout gamepad: A jump, B/LT slide, start pause
const PAD_MAP = { jump: [0], slide: [1, 6, 7], pause: [9] };

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set(); // codes that went down this frame
    this.bindings = { ...DEFAULT_BINDINGS };
    this._loadBindings();
    this._listenTarget = null;
    // virtual action state written by touch controls
    this.touchHeld = {};
    this.touchPressed = {};

    window.addEventListener('keydown', (e) => {
      if (this._listenTarget) {
        e.preventDefault();
        const t = this._listenTarget;
        this._listenTarget = null;
        if (e.code !== 'Escape') { // Esc cancels the remap
          const other = Object.keys(this.bindings).find((a) => a !== t && this.bindings[a] === e.code);
          if (other) this.bindings[other] = this.bindings[t]; // conflict → swap, never dead-bind
          this.bindings[t] = e.code;
          this._saveBindings();
        }
        this.onRemap && this.onRemap(t, e.code);
        return;
      }
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    // ---- touch: right 62% tap = jump, left 38% tap = slide, swipe-down = fast-fall
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let touchStart = null;
    window.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
    }, { passive: true });
    window.addEventListener('touchend', (e) => {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      const isSwipeDown = dy > 46 && Math.abs(dy) > Math.abs(dx) * 1.4;
      const action = isSwipeDown || touchStart.x < window.innerWidth * 0.38 ? 'slide' : 'jump';
      this.touchHeld[action] = true;
      this.touchPressed[action] = true;
      // slide releases quickly; jump 'held' a touch longer for higher jump
      setTimeout(() => (this.touchHeld[action] = false), action === 'jump' ? 240 : 340);
      touchStart = null;
    }, { passive: true });

    // gamepad state — polled once per frame in endFrame
    this.padHeld = {};
    this.padPressed = {};
    this._padPrev = {};
    this.padNavPressed = {};
    this._padNavPrev = {};
  }

  _loadBindings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.bindings) this.bindings = { ...DEFAULT_BINDINGS, ...s.bindings };
      }
    } catch (_) { /* corrupt storage -> defaults */ }
  }

  _saveBindings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.settings);
      const s = raw ? JSON.parse(raw) : {};
      s.bindings = this.bindings;
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(s));
    } catch (_) { /* storage unavailable */ }
  }

  startRemap(action) {
    if (ACTIONS.includes(action)) this._listenTarget = action;
  }

  held(action) {
    if (this.padHeld[action] || this.touchHeld[action]) return true;
    if (this.down.has(this.bindings[action])) return true;
    return (ALT_BINDINGS[action] || []).some((c) => this.down.has(c));
  }

  justPressed(action) {
    if (this.padPressed[action] || this.touchPressed[action]) return true;
    if (this.pressed.has(this.bindings[action])) return true;
    return (ALT_BINDINGS[action] || []).some((c) => this.pressed.has(c));
  }

  anyConfirm() {
    return this.justPressed('jump') || this.pressed.has('Enter');
  }

  endFrame() {
    this.pressed.clear();
    for (const k of Object.keys(this.touchPressed)) this.touchPressed[k] = false;
    this._pollPad();
  }

  _pollPad() {
    const pad = navigator.getGamepads?.().find((p) => p && p.connected);
    for (const a of ACTIONS) this.padPressed[a] = false;
    if (!pad) {
      for (const a of ACTIONS) this.padHeld[a] = false;
      this._padNavPrev = {};
      return;
    }
    for (const [action, btns] of Object.entries(PAD_MAP)) {
      const now = btns.some((i) => pad.buttons[i]?.pressed);
      this.padPressed[action] = now && !this._padPrev[action];
      this.padHeld[action] = now;
      this._padPrev[action] = now;
    }
    // stick/dpad down also slides; stick up also jumps
    if (pad.axes[1] > 0.6 || pad.buttons[13]?.pressed) this.padHeld.slide = true;
    if (pad.buttons[12]?.pressed) {
      if (!this._padPrev.stickUp) this.padPressed.jump = true;
      this._padPrev.stickUp = true;
    } else this._padPrev.stickUp = false;

    const nav = {
      up: pad.buttons[12]?.pressed || pad.axes[1] < -0.6,
      down: pad.buttons[13]?.pressed || pad.axes[1] > 0.6,
      left: pad.buttons[14]?.pressed || pad.axes[0] < -0.6,
      right: pad.buttons[15]?.pressed || pad.axes[0] > 0.6,
      confirm: !!pad.buttons[0]?.pressed,
      back: !!pad.buttons[1]?.pressed,
    };
    for (const k of Object.keys(nav)) {
      this.padNavPressed[k] = nav[k] && !this._padNavPrev[k];
      this._padNavPrev[k] = nav[k];
    }
  }
}
