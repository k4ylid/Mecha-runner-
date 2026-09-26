# Playtest & Balance Journal

Continuous notes from the 10-hour polish session. Simulated runs use the
built-in autopilot (`game.autopilot = true` after `startRun()`), which reacts
to obstacles with a fixed-lookahead policy — deaths by the bot are a strong
signal that a pattern is under-telegraphed.

## Fixes driven by playtesting

| Found | Fix |
|---|---|
| Mecha faced the camera (+Z), not the obstacles | Yaw +90° to face +X; all limb animation axes remapped so run/air/slide read in profile — the player reads intent from the silhouette, like a real runner |
| `laserLow` looked slidable but killed on contact (beam bottom 0.55 vs slide capsule 1.05) | Beam raised to 1.22–2.6 — slide clears by 0.2; the visual now honestly telegraphs the slide verb |
| Gap edges invisible until last moment | Hazard chevron on the trailing edge of any pad followed by a gap |
| Wall deaths while scanning ahead | Autopilot wall-probe lookahead widened; steps now scanned as walls |
| Mech read too dark against dusk sky | Camera-side fill light following the player; hero stays lit |
| `laserHigh` vs `laserLow` semantic confusion | laserHigh = low deck beam (jump), laserLow = waist-high curtain (slide); autopilot re-mapped |
| Auto-pause missing | Tab-hide pauses the run |

## Verified invariants

- Every pattern survivable indefinitely at max speed (autopilot sim, 19,000m+ runs)
- `block` (top 2.72) requires a *held* jump (apex 3.07); tap jump (2.64) fails — intentional depth, taught by the "hold for higher" hint
- `beam` and `droneHigh` are slide-only; all others jumpable; `laserLow` is a tight alt-jump for skilled players
- Slide capsule (1.05) clears every slide-verb obstacle with ≥0.17 margin

## Remaining metrics

_ filled after the soak runs _
