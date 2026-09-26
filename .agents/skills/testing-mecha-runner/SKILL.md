---
name: testing-mecha-runner
description: How to playtest the Mecha Runner endless runner — dev server, sim fast-forward, autopilot, quality overrides, and known testing traps on software-GL VMs.
---

# Testing Mecha Runner

Endless 2D runner: treadmill world, player pinned at x=-4.5, obstacles scroll in from the right.

## Setup

```bash
npm install && npm run assets   # regenerates public/assets/*.glb (required — GLBs are gitignored)
npm run dev                     # http://localhost:5173
```

## Test hooks (window.__game)

- `game.state` — 'title' | 'running' | 'paused' | 'dead' | 'gameover'
- `game.startRun()` — begin a run (resets track + HUD)
- `game.step(n, dt=1/60)` — fast-forward n simulation frames, then render once. **Essential on software-GL VMs** (~1 fps real-time). Keep n ≤ 8000 per call to avoid the browser "page unresponsive" watchdog; loop across several calls.
- `game.autopilot = true` — self-playing bot. **Order matters**: call `game.startRun()` first, THEN set the flag (startRun resets it to false).
- `game.lastDeath` — populated on death: `{ cause, dist, speed, py, pstate, pads, obs, apLog }`.
- Quality switch: there is **no** `game.setQuality()`. Use `game.storage.settings.quality = 'low'|'med'|'high'|'auto'; game.applyQuality()` (or the Settings menu QUALITY row).
- Remap check without UI: `game.input.bindings.jump = 'KeyF'` then `dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF'}))` — press is consumed on the next `step()` frame.

URL params: only `?px=` is parsed (`Game._resize`) — e.g. `?px=0.4` caps pixel ratio (huge speedup on llvmpipe) but it is **ignored at boot**; it takes effect on the first `resize` event or `applyQuality()` — dispatch `window.dispatchEvent(new Event('resize'))` after load. `?q=` does not exist in code.

## Sim recipe

```js
const g = window.__game;
g.startRun(); g.autopilot = true;
for (let k = 0; k < 6; k++) {
  g.step(8000);
  if (g.lastDeath) { /* record g.lastDeath, then */ g.startRun(); g.autopilot = true; }
}
```

## Inputs

Keyboard Space/W/↑ jump (hold = higher), S/↓/Shift slide, S/↓ in air = fast-fall, Esc/P pause. Touch: right tap = jump, left tap = slide, swipe-down = fast-fall. Gamepad: A jump, B/LT slide, Start pause.

## Traps

- Software GL renders ~1 fps — never judge gameplay by real-time visuals; use `step()`.
- **Never call `step()` inside a JS loop in `browser_console`** — every call renders once, so `for(i…) step(3)` does hundreds of renders and the CDP eval times out. Use a single `step(n)` per console call (n sim frames + 1 render), or land mid-state checks between calls.
- `browser_console` only returns a value for a **single expression** — multi-statement snippets return `undefined`. Wrap sequences in an IIFE `(()=>{ …; return JSON.stringify({…}) })()` so dispatch/step/assert run atomically with no rAF frames interleaving.
- Vite HMR reloads the page on file edits — re-navigate/re-init hooks after edits. Reloads lose live run state but keep localStorage (best/settings/bindings persist — handy for the persistence check).
- Chrome can crash entirely under sustained llvmpipe rendering. Relaunch with the usual flags plus `--remote-debugging-port=29229 --user-data-dir=/home/ubuntu/.browser_data_dir --use-angle=swiftshader-webgl --disable-gpu --no-sandbox` so the automation tooling reconnects.
- `browser_console` evals fail if a JS dialog is open or the eval throws; flaky evals often mean a reload raced you — re-check `typeof __game` before assuming state.
