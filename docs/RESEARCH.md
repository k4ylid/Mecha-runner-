# Mecha Runner — Genre Research & Quality Criteria

## Why players love endless runners

Research sources: GameFlow/flow literature (Csikszentmihalyi; Sweetser & Wyeth),
SBGames "Procedural Level Balancing in Runner Games", GameDeveloper "Studying
gameplay progression on runners", Subway Surfers post-mortems, Temple Run
interviews, platformer game-feel literature (Pignole, Fasterholdt).

### 1. Flow state is the engine
Challenge must match growing skill in real time. Runners do this almost
for free: **speed IS the difficulty knob** and it turns itself up. The player's
job stays identical — read ahead, react — while the reaction window tightens.
No menus, no levels, no friction between "I'm good" and "prove it".

### 2. Immediacy: seconds to fun
Temple Run was literally designed around "how simple can we make this".
One or two inputs, zero tutorial text, instant comprehension. Death is cheap
and restart is instant — the "one more run" loop only works if a retry costs
~1 second. Every extra second of restart friction bleeds retention.

### 3. The pursuing pressure
Temple Run's demon monkeys existed to answer "why are we running?" — an
imminent threat converts movement into meaning. Even when off-screen, the
fantasy of being chased heightens every near-miss.

### 4. Readability = fairness = trust
Players blame deaths on the game unless the obstacle was visible at least
one full reaction window before arrival (~800ms novice, ~350ms expert).
Rules the greats follow:

- Warm-up: ~7–12s of zero-failure running at run start.
- Calibration: first real obstacle is nearly impossible to fail — it teaches
  "this shape is dangerous" more than it tests reflexes.
- Every spawned pattern is **solvable at current speed** — guaranteed by
  construction, not luck.
- Obstacle language is color/silhouette consistent (hot = deadly).
- Rewards (coins/cells) double as trajectory hints — arcs teach jump timing.

### 5. Reward density and variety
A 50-game study found the two biggest enjoyment drivers were
**reward-gathering count** and **obstacle variety**. Rewards every
1–2 seconds; distinct obstacle "verbs" (jump over, slide under, thread the
gap, time the gate) so the input vocabulary never reduces to one key.

### 6. Game feel: cheat in the player's favor
Strict physics reads as unfair. The genre standard assists:

- **Coyote time** (~0.10s): jump still works just after leaving a ledge.
- **Jump buffer** (~0.12s): a press just before landing fires on touchdown.
- **Variable jump height**: release early = short hop.
- **Forgiving hitboxes**: player capsule smaller than the visual mesh;
  obstacle killboxes slightly smaller than the visuals.
- Landing squash, dust, speed-scaled FOV, micro-shake on big events —
  juice that makes inputs feel physical.

### 7. Positive feedback loop
High-positive textual/audio feedback measurably improves retention in
runner studies: combo callouts, near-miss bonuses, new-best fanfare,
milestone banners. Celebrate skill loudly; never lecture failure.

### 8. Character is the brand
Subway Surfers credits its animators for making the character feel alive.
The runner character must read as *intentional*: a distinctive silhouette,
visible run cycle, personality in the lean/land/slide poses.

---

## Quality criteria for Mecha Runner

| # | Criterion | Concrete bar |
|---|-----------|--------------|
| C1 | Time-to-fun | Input → mecha running in < 1s from title; restart < 1.5s |
| C2 | Input feel | Coyote 0.10s, buffer 0.12s, variable jump, buffered slide |
| C3 | Difficulty | Speed ramp 8→26 u/s over ~75s; warm-up ~8s; first obstacle harmless |
| C4 | Fairness | Every pattern solvable; killbox < visual; ≥ reaction distance always |
| C5 | Reward | Cell every ~1.5s avg; combo multiplier; near-miss bonus; milestones |
| C6 | Variety | ≥7 distinct obstacle verbs; chunks tiered by difficulty |
| C7 | Visuals | Cohesive dusk cyber-industrial palette; bloom on emissives only; AO grounding; readable silhouettes |
| C8 | Camera | Lookahead ∝ speed; FOV 55→64; landing dip; capped shake; slide tilt |
| C9 | Audio | All-diegetic-feeling procedural SFX; speed-scaled wind/engine; layered synth music |
| C10 | Performance | 60fps mid-tier laptop HIGH; pooled/instanced; LOW/MED tiers keep art direction |
| C11 | UX | HUD minimal; settings (quality/volume/reduce-flash); touch + gamepad; persistent bests + missions |
| C12 | Identity | Mecha transform DNA: jet-boost double-jump morphs to aircraft pose |

## Design pillars (from criteria)

1. **"Read fast, react faster"** — the game is a readability test, not a
   reflex lottery. Camera, color language, and pattern spacing all serve it.
2. **"The run is the reward"** — constant forward motion, escalating speed
   euphoria, cells singing their arc, combo ticking upward.
3. **"A mecha, not a marble"** — weight, footfalls, servos, jet flares.
   The character sells the fantasy every frame.

## Game spec (what we're building)

- **View**: side-scrolling 3D presentation, gameplay on XY plane (camera
  at z≈+, slight downward tilt, parallax layers at negative z).
- **Moveset**: run (auto), jump (variable), jet-boost double jump
  (transform flourish), slide, fast-fall (down in air).
- **World**: neon industrial rooftops at dusk — panel floor with gaps,
  gantries, pipes, AC units, antennae, holo-signs; far skyline, clouds,
  sun-low sky; fog for depth.
- **Obstacles**: barrier (jump), block stack (high jump/double), gap,
  overhead beam (slide), laser fence (timed slide), patrol drone
  (slide/jump timing), crusher gate (commit-through timing).
- **Pickups**: energy cells (lines/arcs), shield, magnet, ×2 surge core.
- **Meta**: score = distance + cells + near-miss + milestones; hiscore +
  missions persisted; attract-mode title screen.
- **Tech**: Vite + Three.js, EffectComposer (GTAO on HIGH, bloom, grade,
  vignette, MSAA), PMREM env, instancing + pooling, WebAudio synth.
