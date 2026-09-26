# MECHA RUNNER

An endless 2D runner with a 3D presentation — a transforming mecha sprints
across neon industrial rooftops at dusk. Built with Three.js.

- **Gameplay plane**: XY (z = 0), side-scrolling treadmill
- **Moveset**: jump (variable), jet-boost double jump, slide, fast-fall
- **Stack**: Vite + Three.js, EffectComposer post chain, procedural GLB assets,
  fully synthesized WebAudio (no asset downloads, no licensing risk)

## Dev

```bash
npm install
npm run dev      # vite dev server, http://localhost:5173
npm run build    # production build -> dist/
npm run lint     # eslint
npm run assets   # regenerate public/assets/*.glb via tools/build_assets.mjs
```

## Controls

| Action | Keys | Alt | Gamepad |
|--------|------|-----|---------|
| Jump / double jump | Space / W / ↑ | K | A |
| Slide | S / ↓ / Shift | J | B / LT |
| Fast-fall (air) | S / ↓ | | stick down |
| Pause | Esc | P | Start |

Touch: tap right = jump, tap left = slide, swipe down = fast-fall.

See `docs/RESEARCH.md` for the genre research and quality criteria driving
the design, and `docs/PROVENANCE.md` for the asset provenance record
(every asset is generated in-repo — zero licensing surface).

### QA hooks

- `?q=low|med|high` — force a quality tier; `?px=0.4` — cap pixel ratio
  (useful for software-GL testing)
- `window.__game` — the live `Game` instance
- `game.step(n, dt)` — fast-forward n sim frames then render once
  (headless-friendly; keep n ≤ 8000 per call to avoid watchdogs)
- `game.autopilot = true` after `startRun()` — self-playing bot used for
  fairness/balance simulation (`game.lastDeath` records the last death
  context)
- `game.setQuality('low'|'med'|'high')` — live quality switch
