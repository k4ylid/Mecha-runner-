# Playtest Notes — Mecha Runner: Neon Perimeter

Tester: automated playtest session (Devin testing agent), vite dev server @ localhost:5173.
Environment caveats: software-GL VM (~1–2 fps real-time). Real keyboard/mouse used for menus,
pause, remap; `window.__game.step(n)` used to fast-forward the sim for deterministic checks.
Quality set to LOW via Settings for the run portion. vite HMR reloaded the page several times
mid-session (shared checkout) and Chrome crashed twice under GL load — env issues, not game bugs.

---

## Golden path (title → run → jump/slide/jet → cells → die → game over → run again)

| # | Check | Result |
|---|-------|--------|
| 1 | Boot → title: "MECHA RUNNER / NEON PERIMETER — SECTOR 7", 4 items (START RUN / MISSIONS / SETTINGS / HOW TO RUN), footer hint, attract-mode mecha running behind panel | PASS |
| 2 | HOW TO RUN screen: JUMP / DOUBLE JUMP / SLIDE / FAST-FALL / PAUSE / TOUCH reference, BACK works | PASS |
| 3 | MISSIONS screen: 3 active missions with progress; completed missions persist and the pool rotates to a fresh set next epoch | PASS |
| 4 | START RUN → state=running, HUD corners appear, "RUN" + "the perimeter is collapsing behind you" announce, first-run "SPACE JUMP — hold for higher" hint | PASS |
| 5 | HUD live updates: score, distance, cell count, COMBO ×N + decay bar, VELOCITY fill, BEST (shows live max once beaten) | PASS |
| 6 | Jump: registers next frame (buffered), apex ~2.9 u held / ~2.5 u tapped, airtime ~0.65 s / ~0.58 s — variable height via hold-float | PASS |
| 7 | Jet boost: midair re-press relaunches (vy→~14.5), jets counter +1, jet charge consumed (jumpsLeft 1→0), horizontal flight pose + flare particles | PASS |
| 8 | Slide: hitbox 2.15→1.05 u, 0.62 s window + 0.14 s cooldown, reclined feet-first pose + scrape sparks, chains while held | PASS |
| 9 | Cells: counter increments, combo ×2→×5 observed, "COMBO ×4" announce fires, score multiplier applies | PASS |
| 10 | Pause: Esc → PAUSED panel (SCORE + DISTANCE stats, 5 items); sim fully frozen (distance identical across 120 stepped frames); Esc resumes; distance advances | PASS |
| 11 | Pause → SETTINGS → BACK returns to PAUSE menu (not title); pause → QUIT TO TITLE → title state, HUD hidden | PASS |
| 12 | Death (no input): "IMPACT — STRUCTURE WALL" at 434 m; corpse tumbles with slow-mo → RUN TERMINATED panel: score (amber = new best), distance, cells, top speed, near misses, best, missions progress, RUN AGAIN + TITLE SCREEN | PASS |
| 13 | RUN AGAIN → new run, HUD fully zeroed (0 / 0 m / 0 cells), best retained in corner | PASS |
| 14 | Quit mid-run does NOT record score (543 m / 5,669 quit run didn't overwrite best) — consistent, worth confirming intent | PASS (by design) |
| 15 | Persistence across reload: best score (1,208), quality=LOW, remapped binding (KeyF), seenHints — all survived | PASS |
| 16 | Max-speed readability (27 u/s, 13 km+ autopilot): mecha clearly visible left-third facing +X; obstacles, gaps, cell trails all legible; autopilot survives indefinitely — patterns are fair | PASS |

## Feel / UX notes

- Jump input is crisp: buffered press fires next sim frame; coyote + buffer make edge jumps forgiving.
- Variable jump height exists via hold-float (tap ≈2.5 u vs hold ≈2.9 u apex). The promised
  "early release cuts vy" (releaseDamp) is not actually wired — see B5.
- Slide reads well (low recline + sparks); auto-re-slide while held is a nice touch.
- Obstacles at max speed remain readable but get dark-on-dark against the deck — see suggestion 6.
- Announces (RUN / milestone / COMBO ×4 / powerups) are big and legible; hints teach verbs once.
- Menus respond to arrows+Enter/Space and hover; at <5 fps rapid presses coalesce into one
  nav step per frame (only noticeable on pathologically slow machines).
- Pause is instant and the world truly freezes — clean.
- Mecha consistently faces +X (toward obstacles) in run/jump/slide/jet poses — no wrong-way posing seen.

## Bugs (ranked by severity)

| ID | Sev | Bug | Evidence / where |
|----|-----|-----|------------------|
| B1 | MED | Powerup HUD timers never display. HUD reads `g.shield/g.magnet/g.surge/g.jet` but the game stores them at `g.power.*` — `#powerup` stays empty while powerups are active. Verified live: `power.surge=3.13`, `power.jet=0.97` active with empty element. | src/ui/HUD.js:82-86 vs Game.js power{} |
| B2 | MED | JETSTREAM powerup grants nothing mechanically. `_applyPowerup('jet')` sets `game.power.jet` (used only for flare particles); the player reads `player.jetPowerup` which is **never assigned** — midair presses after spending the single jet charge do nothing. Verified: 3rd midair press during an active 5.7 s window produced no relaunch (jets stayed 2). The "unlimited boost" announce over-promises. | Game.js:577; Player.js:85,143,277 |
| B3 | MED | SHOW FPS toggle never applies. Settings writes `storage.settings.showFps`; `hud.showFps` is never synced — the counter never displays even while running. | Menus.js:236-238; HUD.js:32,99 — no assignment path |
| B4 | LOW | Lifetime `jumps` stat is dead: `this.jumps` initialized and folded into lifetime on game over but never incremented — stored `jumps` stays 0 forever (no UI surface currently). | Game.js:72,229,300 — no `jumps++` exists |
| B5 | LOW | `PHYS.releaseDamp` (0.42, "early release cuts vy") is dead config — never referenced. Tap-vs-hold still differs via gravity mod, but the sharper release-cut feel isn't there. | config.js:23 |
| B6 | LOW | `?px=` URL param is ignored at boot — it's only read inside `_resize()`/applyQuality, so a fresh load renders at pixelRatio 1 until a resize event. `?q=` param mentioned in test tooling doesn't exist in code at all. | Game.js:121-129,103-110 |
| B7 | LOW/UX | Remap has no cancel path and no conflict detection — any keypress while "press key…" binds immediately (including Escape/arrows). Binding jump=Escape makes jump unusable mid-run: the global pause check fires first and player.update is skipped while paused, so Escape only ever toggles pause (code-verified; runtime re-check inconclusive due to reloads). | Input.js:19-26; Game.js:408-420 |
| B8 | LOW/UX | First-run hint text is hardcoded "SPACE JUMP" — after remapping, the hint teaches a dead key. Same for the HOW TO RUN grid. | Game.js:210; Menus.js:136-143 |
| B9 | LOW/UX | Mouse hover "steals" keyboard selection: menu rebuilds under a resting cursor re-fire mouseenter, snapping selection back to the hovered row between keypresses. | Menus.js:39 (_bindItems) |
| B10 | COSMETIC | Attract-mode mecha on title is largely hidden behind the centered menu panel — the attract showcase is easy to miss. | title screenshots |
| B11 | COSMETIC | Once observed a stale "COMBO ×4" announce overlaying a fresh 0 m run — likely an artifact around an HMR reload mid-state; could not reproduce deterministically. | one screenshot |

## Polish suggestions (player POV)

1. Fix the powerup HUD timer (`g.power.*`) and add a small icon per active powerup — right now a pickup announces once then vanishes from awareness.
2. Make JETSTREAM real (set `player.jetPowerup` from the powerup) or change the announce — it currently advertises a mechanic that doesn't exist.
3. Wire SHOW FPS into `hud.showFps` (one line in applyQuality/update).
4. Menu UX: Esc-to-go-back in submenus, a cancel for remap listening, and a conflict warning when two actions share a key (or when binding Escape/P).
5. Make hint/help text read live bindings instead of hardcoding SPACE/S/ESC.
6. Slightly brighten obstacle silhouettes or add a rim light at high speed — dark blocks against dark deck blur at 27 u/s.
7. Nudge the attract-mode camera or player x-offset so the mecha isn't hidden behind the title panel.

## Environment notes for the lead

- `?q=low` does not exist in code — only `?px=` is parsed, and it only applies after resize/quality change (B6). Recommend quality via Settings or localStorage for low-end testing.
- Chrome crashed twice under software GL (tab→new-tab once, full exit once); vite HMR reloaded mid-run several times on the shared checkout.
- Audio could not be verified by ear in the VM (no sound path) — code paths (init/resume/setIntensity/setSpeed) fire without errors.
