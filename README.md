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
the design.
