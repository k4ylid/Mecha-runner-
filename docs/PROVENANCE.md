# Asset Provenance

Every rendered asset in Mecha Runner is generated in-repo. There are **zero external downloads**, so there is no licensing surface.

| Asset | Source | Method |
|---|---|---|
| Mecha character (body, limbs, jetpack, wings, visor) | `tools/build_assets.mjs` → `public/assets/mecha-runner.glb` | Procedural boxes/cylinders assembled with named pivot groups, exported via GLTFExporter |
| Drone obstacle | `tools/build_assets.mjs` → `public/assets/drone.glb` | Procedural hull + rotor ring + eye |
| Energy cell pickup | `tools/build_assets.mjs` → `public/assets/cell.glb` | Octahedron core + torus ring |
| Sky gradient + sun | `src/world/Sky.js` | Custom gradient shader + PMREM env scene (`Sky.makeEnvScene`) |
| All textures (deck plates, hazard stripes, facades, holo signs, sprites) | `src/world/Textures.js` | Canvas 2D raster generation at runtime |
| SFX + music | `src/audio/Audio.js` | WebAudio synthesis — oscillators, filtered noise, scheduled sequencer (116 BPM) |
| Font | System stack (`system-ui` fallback chain in CSS) | No webfont fetch |

Approved sources from the brief (Poly Haven, Quaternius, Kenney) were evaluated and deliberately **not** used: procedural geometry fits the low-poly stylized look, keeps the binary footprint ~185 kB gz, and removes every attribution burden.
