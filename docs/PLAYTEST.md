# Playtest & Balance Journal

Notes from the polish marathon. Simulation soak runs use the built-in
autopilot (`startRun()` then `game.autopilot = true`); a dedicated UI test
agent drove the real keyboard/mouse paths end-to-end in the live dev server.

## Soak results (autopilot, sim-fast-forwarded)

| Run | Distance | Top speed | Deaths | Cells |
|---|---|---|---|---|
| Soak 1 (continuous, restarts on death) | 20,367m in one run | 27.0 u/s (max) | 0 | 1,258 |
| Earlier max-speed holds | 12–19km per run | 27 u/s | 0 | — |

Every pattern in the pool is survivable indefinitely at maximum speed —
verified over ~100+km of simulated running. Deaths by the fixed-policy bot
would flag under-telegraphed patterns; none occurred.

Manual/UI playtest (real input path, live server): full loop passed —
boot→title→run→jump/slide/jet→cells/combo→pause→death→gameover→restart→
persistence. See `docs/playtest-notes.md` for the per-assertion list.

## Performance (measured, HIGH tier, 1280×720@0.7px)

- **275–280 draw calls** per frame total across all composer passes
- **~20k triangles** — instancing carries the city
- Scene-only draw calls ≈120 (GTAO adds full depth/normal passes)

## Bugs found & fixed this session

| Finding | Fix |
|---|---|
| Mecha faced the camera, not travel direction | Yaw +90° → faces +X; all limb animation axes remapped to read in profile |
| `laserLow` looked slidable, killed on slide (beam bottom 0.55 < slide capsule 1.05) | Beam raised to 1.22–2.6 — honestly telegraphs "slide under" |
| Gap edges invisible until the last moment | Hazard chevron on the trailing edge of pads followed by gaps |
| Powerup HUD timers never displayed | HUD read `g.shield`; game stores `g.power.*` — fixed |
| JETSTREAM powerup inert | `player.jetPowerup` never set — wired to `power.jet` |
| SHOW FPS setting never applied | HUD never synced the flag; now reads live + shows draw calls |
| Draw calls read 1 (misleading) | `renderer.info.autoReset=false` — counts all composer passes |
| `?q=`/`?px=` URL overrides only applied on resize | Now resolved at boot |
| Early jump release had no effect (`releaseDamp` dead config) | Release-cut implemented — tap=hop, hold=full arc |
| `jumps` lifetime stat never counted | `ctx.onJump` hook |
| Remap could dead-bind (e.g. jump=Escape) | Esc cancels; conflicts swap bindings |
| Parked mouse stole menu selection on every rebuild | Hover only honored if the mouse moved within 450ms |
| No auto-pause on tab switch | `visibilitychange` → pause |

## Player-POV readability pass (this session's focus)

Reasoned from what the eye sees at speed: the mecha reads its intent in
profile (lean/strides point forward); every hazard verb has a distinct visual
language — hot orange/red = deadly, cyan strip at a beam's underside =
"slide under me", deck-edge chevron = "gap next", cyan fascia = safe floor.
Landing squash + scrape sparks + speed-reactive chromatic fringe sell
velocity; near-miss dips time for a split second.

## Master-prompt coverage

Rendering pipeline (EffectComposer: MSAA+GTAO+bloom+grade ✓), AO via GTAO
(high tier) + fascia/contact bands (always) ✓, lighting hierarchy
(key+hemi+rim+fill+bounce practical) ✓, PMREM/IBL env ✓, PBR materials with
canvas-generated albedo/roughness/emissive ✓, selective procedural assets
(0 external downloads — `PROVENANCE.md`) ✓, environment art (clutter, oil
sheens, cranes, gantries, holo signs, gliders, strobes) ✓, VFX (dust, sparks,
exhaust, motes, searchlights) ✓, restrained bloom ✓, deliberate grade
(lift/gain, vignette, edge CA) ✓, camera polish (lookahead, deadzone,
FOV kick, tilt, land dip, trauma shake, death push) ✓, shadows
(PCFSoft tight ortho, per-quality res) ✓, reflections via IBL ✓,
quality tiers low/med/high ✓, measured performance ✓.
