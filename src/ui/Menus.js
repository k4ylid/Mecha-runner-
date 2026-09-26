// DOM menus — title, pause, game over, settings, missions. Keyboard/mouse/
// gamepad navigable; menu items get .sel highlight and fire callbacks.
import { QUALITY } from '../core/config.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = $('menu-root');
    this.current = null; // { items, sel, el }
    this.visible = false;
    this._remapTarget = null;
    this._lastMouseT = 0;
    window.addEventListener('mousemove', () => (this._lastMouseT = performance.now()));
    game.input.onRemap = () => this._renderSettings();
  }

  _open(html, items, opts = {}) {
    this.root.innerHTML = html;
    this.visible = true;
    this.current = {
      items,
      sel: 0,
      opts,
      el: this.root.firstElementChild,
    };
    this._bindItems();
    this._select(0);
  }

  close() {
    this.root.innerHTML = '';
    this.visible = false;
    this.current = null;
  }

  _bindItems() {
    const els = this.root.querySelectorAll('.menu-item');
    els.forEach((el, i) => {
      // a parked cursor re-fires mouseenter on every rebuild — only honor hover
      // when the mouse actually moved in the last heartbeat
      el.addEventListener('mouseenter', () => {
        if (performance.now() - this._lastMouseT < 450) this._select(i);
      });
      el.addEventListener('click', () => this._activate(i));
    });
    const remapEls = this.root.querySelectorAll('.remap-row');
    remapEls.forEach((el) => {
      el.addEventListener('click', () => {
        const act = el.dataset.action;
        if (!act) return;
        el.classList.add('listening');
        el.querySelector('.key').textContent = 'press key…';
        this.game.input.startRemap(act);
      });
    });
  }

  _select(i) {
    const c = this.current;
    if (!c) return;
    const items = this.root.querySelectorAll('.menu-item');
    if (!items.length) return;
    const n = items.length;
    c.sel = ((i % n) + n) % n;
    items.forEach((el, j) => el.classList.toggle('sel', j === c.sel));
  }

  _activate(i) {
    const c = this.current;
    if (!c) return;
    const item = c.items[i];
    if (!item || item.disabled) return;
    this.game.audio.ui();
    item.action();
  }

  // called each frame from Game while a menu is visible
  handleInput() {
    const c = this.current;
    if (!c) return;
    const inp = this.game.input;
    const items = this.root.querySelectorAll('.menu-item');
    if (!items.length) return;
    const nav = (k) => inp.padNavPressed?.[k];
    const down = inp.pressed.has('ArrowDown') || inp.pressed.has('KeyS') || nav('down');
    const up = inp.pressed.has('ArrowUp') || inp.pressed.has('KeyW') || nav('up');
    const left = inp.pressed.has('ArrowLeft') || inp.pressed.has('KeyA') || nav('left');
    const right = inp.pressed.has('ArrowRight') || inp.pressed.has('KeyD') || nav('right');
    const confirm = inp.pressed.has('Enter') || inp.pressed.has('Space') || inp.pressed.has('KeyZ') || nav('confirm');
    const back = nav('back');

    if (down) { this._select(c.sel + 1); this.game.audio.ui(); }
    if (up) { this._select(c.sel - 1); this.game.audio.ui(); }
    if (confirm) this._activate(c.sel);
    if (left || right) {
      const item = c.items[c.sel];
      if (item?.adjust) {
        item.adjust(right ? 1 : -1);
        this.game.audio.ui();
      }
    }
    if (back && c.opts.onBack) c.opts.onBack();
  }

  // --------------------------- screens --------------------------------------
  title() {
    const g = this.game;
    const best = g.storage.bestScore;
    this._open(
      `<div class="overlay">
        <div class="panel">
          <div class="title">MECHA RUNNER</div>
          <div class="subtitle">NEON PERIMETER — SECTOR 7</div>
          <div class="menu-list">
            <div class="menu-item" data-i="0">START RUN</div>
            <div class="menu-item" data-i="1">MISSIONS</div>
            <div class="menu-item" data-i="2">SETTINGS</div>
            <div class="menu-item" data-i="3">HOW TO RUN</div>
          </div>
          <div class="foot">
            ${best > 0 ? `BEST ${best.toLocaleString()} — ` : ''}SPACE / CLICK TO CONFIRM<br>
            a transforming mecha sprint through the dusk sector
          </div>
        </div>
      </div>`,
      [
        { action: () => g.startRun() },
        { action: () => this.missions() },
        { action: () => this.settings('title') },
        { action: () => this.help() },
      ]
    );
  }

  help() {
    this._open(
      `<div class="overlay">
        <div class="panel">
          <h2 class="panel-h">HOW TO RUN</h2>
          <div class="stat-grid">
            <div class="k">JUMP</div><div class="v">SPACE / W / ↑</div>
            <div class="k">DOUBLE JUMP</div><div class="v">SPACE again — jet boost</div>
            <div class="k">SLIDE</div><div class="v">S / ↓ / SHIFT</div>
            <div class="k">FAST-FALL</div><div class="v">↓ in the air</div>
            <div class="k">PAUSE</div><div class="v">ESC / P</div>
            <div class="k">TOUCH</div><div class="v">tap right = jump · left = slide</div>
          </div>
          <div class="foot">Read ahead. The cyan line is your path. Hot things kill.<br>Cells raise your combo — combo multiplies everything.</div>
          <div class="menu-list"><div class="menu-item">BACK</div></div>
        </div>
      </div>`,
      [{ action: () => this.title() }],
      { onBack: () => this.title() }
    );
  }

  missions() {
    const g = this.game;
    const rows = g.missionList
      .map(
        (m) => `<div class="mission-row ${m.done ? 'done' : ''}">
          <span class="m-name">${m.done ? '✓ ' : ''}${m.name}</span>
          <span class="m-prog">${m.prog}</span>
        </div>`
      )
      .join('');
    this._open(
      `<div class="overlay">
        <div class="panel">
          <h2 class="panel-h">MISSIONS</h2>
          ${rows}
          <div class="menu-list" style="margin-top:16px"><div class="menu-item">BACK</div></div>
          <div class="foot">missions refresh when all three complete</div>
        </div>
      </div>`,
      [{ action: () => (g.state === 'paused' ? this.pause() : this.title()) }],
      { onBack: () => (g.state === 'paused' ? this.pause() : this.title()) }
    );
  }

  settings(backTo = 'title') {
    const g = this.game;
    const s = g.storage.settings;
    const items = [
      {
        label: 'QUALITY',
        get: () => (s.quality === 'auto' ? 'AUTO' : QUALITY[s.quality].label),
        adjust: (dir) => {
          const opts = ['auto', 'low', 'med', 'high'];
          const i = (opts.indexOf(s.quality) + dir + opts.length) % opts.length;
          s.quality = opts[i];
          g.applyQuality();
          g.storage.save();
          this.settings(backTo);
        },
        action: () => this._cycleQuality(backTo),
      },
      {
        label: 'MUSIC',
        get: () => `${Math.round(s.music * 100)}%`,
        adjust: (dir) => {
          s.music = Math.max(0, Math.min(1, s.music + dir * 0.1));
          g.audio.setVolumes(s.music, s.sfx);
          g.storage.save();
          this._refreshVals();
        },
        action: () => {},
      },
      {
        label: 'SFX',
        get: () => `${Math.round(s.sfx * 100)}%`,
        adjust: (dir) => {
          s.sfx = Math.max(0, Math.min(1, s.sfx + dir * 0.1));
          g.audio.setVolumes(s.music, s.sfx);
          g.storage.save();
          this._refreshVals();
        },
        action: () => {},
      },
      {
        label: 'SCREEN SHAKE',
        get: () => (s.shake ? 'ON' : 'OFF'),
        adjust: () => { s.shake = !s.shake; g.storage.save(); this._refreshVals(); },
        action: () => { s.shake = !s.shake; g.storage.save(); this._refreshVals(); },
      },
      {
        label: 'REDUCE FLASH',
        get: () => (s.reduceFlash ? 'ON' : 'OFF'),
        adjust: () => { s.reduceFlash = !s.reduceFlash; g.storage.save(); this._refreshVals(); },
        action: () => { s.reduceFlash = !s.reduceFlash; g.storage.save(); this._refreshVals(); },
      },
      {
        label: 'REDUCE MOTION',
        get: () => (s.reduceMotion ? 'ON' : 'OFF'),
        adjust: () => { s.reduceMotion = !s.reduceMotion; g.storage.save(); this._refreshVals(); },
        action: () => { s.reduceMotion = !s.reduceMotion; g.storage.save(); this._refreshVals(); },
      },
      {
        label: 'SHOW FPS',
        get: () => (s.showFps ? 'ON' : 'OFF'),
        adjust: () => { s.showFps = !s.showFps; g.storage.save(); this._refreshVals(); },
        action: () => { s.showFps = !s.showFps; g.storage.save(); this._refreshVals(); },
      },
      {
        label: 'CONTROLS',
        get: () => '',
        action: () => this.controls(backTo),
      },
      {
        label: 'BACK',
        get: () => '',
        action: () => (backTo === 'pause' ? this.pause() : this.title()),
      },
    ];
    this._open(this._settingsHtml(items), items, {
      onBack: () => (backTo === 'pause' ? this.pause() : this.title()),
    });
  }

  _settingsHtml(items) {
    return `<div class="overlay"><div class="panel">
      <h2 class="panel-h">SETTINGS</h2>
      <div class="menu-list">
        ${items.map((it, i) => `<div class="menu-item" data-i="${i}">${it.label}<span class="val">${it.get()}</span></div>`).join('')}
      </div>
      <div class="foot">←/→ adjust · quality applies instantly</div>
    </div></div>`;
  }

  _refreshVals() {
    const g = this.game;
    const s = g.storage.settings;
    const vals = this.root.querySelectorAll('.menu-item .val');
    const q = s.quality === 'auto' ? 'AUTO' : QUALITY[s.quality].label;
    const texts = [q, `${Math.round(s.music * 100)}%`, `${Math.round(s.sfx * 100)}%`, s.shake ? 'ON' : 'OFF', s.reduceFlash ? 'ON' : 'OFF', s.reduceMotion ? 'ON' : 'OFF', s.showFps ? 'ON' : 'OFF', '', ''];
    vals.forEach((v, i) => (v.textContent = texts[i] ?? ''));
  }

  _cycleQuality(backTo) {
    const g = this.game;
    const opts = ['auto', 'low', 'med', 'high'];
    const s = g.storage.settings;
    s.quality = opts[(opts.indexOf(s.quality) + 1) % opts.length];
    g.applyQuality();
    g.storage.save();
    this.settings(backTo);
  }

  controls(backTo = 'title') {
    const g = this.game;
    const b = g.input.bindings;
    this._open(
      `<div class="overlay"><div class="panel">
        <h2 class="panel-h">CONTROLS</h2>
        <div class="remap-row" data-action="jump"><span>JUMP / JET BOOST</span><span class="key">${b.jump}</span></div>
        <div class="remap-row" data-action="slide"><span>SLIDE / FAST-FALL</span><span class="key">${b.slide}</span></div>
        <div class="remap-row" data-action="pause"><span>PAUSE</span><span class="key">${b.pause}</span></div>
        <div class="foot">click a row then press a key · alternates always on:<br>W/↑/K jump · ↓/Shift/J slide · P pause</div>
        <div class="menu-list" style="margin-top:14px"><div class="menu-item">BACK</div></div>
      </div></div>`,
      [{ action: () => this.settings(backTo) }],
      { onBack: () => this.settings(backTo) }
    );
  }

  _renderSettings() {
    // re-render current menu view to drop the listening state
    if (this.current) {
      const rows = this.root.querySelectorAll('.remap-row');
      rows.forEach((r) => {
        const act = r.dataset.action;
        r.classList.remove('listening');
        r.querySelector('.key').textContent = this.game.input.bindings[act];
      });
    }
  }

  pause() {
    const g = this.game;
    this._open(
      `<div class="overlay clear"><div class="panel">
        <h2 class="panel-h">PAUSED</h2>
        <div class="stat-grid">
          <div class="k">SCORE</div><div class="v">${Math.floor(g.score).toLocaleString()}</div>
          <div class="k">DISTANCE</div><div class="v">${Math.floor(g.distance)} m</div>
        </div>
        <div class="menu-list">
          <div class="menu-item">RESUME</div>
          <div class="menu-item">RESTART</div>
          <div class="menu-item">MISSIONS</div>
          <div class="menu-item">SETTINGS</div>
          <div class="menu-item">QUIT TO TITLE</div>
        </div>
      </div></div>`,
      [
        { action: () => g.resume() },
        { action: () => g.startRun() },
        { action: () => this.missions() },
        { action: () => this.settings('pause') },
        { action: () => g.quitToTitle() },
      ],
      { onBack: () => g.resume() }
    );
  }

  gameOver(stats, isBest) {
    const g = this.game;
    const missionRows = stats.missions
      .map((m) => `<div class="mission-row ${m.done ? 'done' : ''}"><span class="m-name">${m.name}</span><span class="m-prog">${m.prog}</span></div>`)
      .join('');
    this._open(
      `<div class="overlay clear"><div class="panel">
        <div class="big-announce" style="font-size:38px">RUN TERMINATED</div>
        <div class="subtitle" style="margin-bottom:8px">${stats.cause}</div>
        <div class="stat-grid">
          <div class="k">SCORE</div><div class="v ${isBest ? 'newbest' : ''}">${stats.score.toLocaleString()}</div>
          <div class="k">DISTANCE</div><div class="v">${stats.distance} m</div>
          <div class="k">CELLS</div><div class="v">${stats.cells}</div>
          <div class="k">TOP SPEED</div><div class="v">${stats.topSpeed.toFixed(1)} u/s</div>
          <div class="k">NEAR MISSES</div><div class="v">${stats.nearMisses}</div>
          <div class="k">BEST</div><div class="v">${stats.best.toLocaleString()}</div>
        </div>
        ${isBest ? '<div class="foot newbest" style="font-size:14px">NEW PERSONAL BEST</div>' : ''}
        ${missionRows ? `<h2 class="panel-h" style="margin-top:14px;font-size:14px">MISSIONS</h2>${missionRows}` : ''}
        <div class="menu-list" style="margin-top:16px">
          <div class="menu-item">RUN AGAIN &nbsp;<span style="opacity:0.6">(SPACE)</span></div>
          <div class="menu-item">TITLE SCREEN</div>
        </div>
      </div></div>`,
      [
        { action: () => g.startRun() },
        { action: () => g.quitToTitle() },
      ]
    );
  }
}
