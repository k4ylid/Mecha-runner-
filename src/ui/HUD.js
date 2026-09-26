// DOM HUD — score, distance, combo, cells, powerup timers, hints, announces.
import { clamp } from '../core/utils.js';
import { SPEED, SCORE } from '../core/config.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.root = $('hud');
    this.el = {
      score: $('score'),
      dist: $('dist'),
      combo: $('combo'),
      comboFill: $('combo-fill'),
      cells: $('cells'),
      powerup: $('powerup'),
      speedFill: $('speed-fill'),
      hiscore: $('hiscore'),
      announce: $('announce'),
      hint: $('hint'),
      fps: $('fps'),
      vignette: $('vignette'),
      hurtflash: $('hurtflash'),
      touchUi: $('touch-ui'),
    };
    this._announceT = 0;
    this._hintT = 0;
    this._lastCombo = 0;
    this._fpsAcc = 0;
    this._fpsN = 0;
    this._fpsVal = 0;
    this.showFps = false;
  }

  show(on) {
    this.root.style.display = on ? 'block' : 'none';
  }

  setTouch(on) {
    this.el.touchUi.style.display = on ? 'block' : 'none';
  }

  announce(main, sub = '', dur = 1.6) {
    this.el.announce.innerHTML = `${main}${sub ? `<div class="sub">${sub}</div>` : ''}`;
    this.el.announce.style.opacity = '1';
    this._announceT = dur;
  }

  hint(html, dur = 2.6) {
    this.el.hint.innerHTML = html;
    this.el.hint.style.opacity = '1';
    this._hintT = dur;
  }

  hurt() {
    this.el.hurtflash.classList.add('on');
    setTimeout(() => this.el.hurtflash.classList.remove('on'), 60);
  }

  setDanger(on) {
    this.el.vignette.classList.toggle('danger', on);
  }

  update(dt, g) {
    // g: game refs { score, distance, cells, combo, comboT, speed, best, powerups }
    this.el.score.textContent = Math.floor(g.score).toLocaleString();
    this.el.dist.textContent = `${Math.floor(g.distance)} m`;
    this.el.cells.textContent = g.cells;
    this.el.hiscore.textContent = `BEST ${Math.floor(Math.max(g.storage?.bestScore || 0, g.score)).toLocaleString()}`;

    const comboTxt = g.combo > 1 ? `COMBO ×${g.combo}` : '';
    if (comboTxt !== this._lastCombo) {
      this.el.combo.textContent = comboTxt;
      this._lastCombo = g.combo;
    }
    this.el.comboFill.style.width = `${(g.comboT / SCORE.comboWindow) * 100}%`;

    const speedN = clamp((g.speed - SPEED.start) / (SPEED.max - SPEED.start), 0, 1);
    this.el.speedFill.style.width = `${speedN * 100}%`;

    const pw = [];
    if (g.shield > 0) pw.push(`SHIELD ${g.shield.toFixed(0)}s`);
    if (g.magnet > 0) pw.push(`MAGNET ${g.magnet.toFixed(0)}s`);
    if (g.surge > 0) pw.push(`SURGE ×2 ${g.surge.toFixed(0)}s`);
    if (g.jet > 0) pw.push(`JETSTREAM ${g.jet.toFixed(0)}s`);
    this.el.powerup.textContent = pw.join('  ');

    // announce/hint decay
    if (this._announceT > 0) {
      this._announceT -= dt;
      if (this._announceT <= 0) this.el.announce.style.opacity = '0';
    }
    if (this._hintT > 0) {
      this._hintT -= dt;
      if (this._hintT <= 0) this.el.hint.style.opacity = '0';
    }

    // fps
    if (this.showFps) {
      this._fpsAcc += dt;
      this._fpsN++;
      if (this._fpsAcc > 0.5) {
        this._fpsVal = Math.round(this._fpsN / this._fpsAcc);
        this._fpsAcc = 0;
        this._fpsN = 0;
        this.el.fps.textContent = `${this._fpsVal} fps`;
      }
    } else if (this.el.fps.textContent) {
      this.el.fps.textContent = '';
    }
  }
}
