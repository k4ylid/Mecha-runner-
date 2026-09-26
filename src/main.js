import * as THREE from 'three';
import { Game } from './Game.js';

const renderer = new THREE.WebGLRenderer({
  antialias: false, // composer MSAA handles edges
  powerPreference: 'high-performance',
});
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const game = new Game(renderer);
window.__game = game; // testing hook — see .agents/skills
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

const clock = new THREE.Clock();
let time = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 1 / 20); // clamp spiral-of-death
  time += dt;
  game.update(dt, time);
  game.render();
}

game.load().then(() => loop());
