// Dusk sky dome, low sun, drifting cloud bands, and the PMREM environment
// scene that feeds image-based lighting on metals/glass.
import * as THREE from 'three';
import { cloudSprite } from './Textures.js';
import { rand } from '../core/utils.js';

// Palette — single source of truth for the dusk grade
export const PALETTE = {
  skyTop: new THREE.Color(0x0a1626),
  skyMid: new THREE.Color(0x27435f),
  horizon: new THREE.Color(0xd4713a), // burnt amber band
  sunCore: new THREE.Color(0xffd9a8),
  sunGlow: new THREE.Color(0xff9a4d),
  fog: new THREE.Color(0x18263a),
  neonCyan: new THREE.Color(0x35e0ff),
  neonMagenta: new THREE.Color(0xff4d9a),
  danger: new THREE.Color(0xff4d6a),
};

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    // night-shift targets (dusk → night over a long run)
    this._nightHorizon = new THREE.Color(0x5a2e5e); // bruised violet
    this._nightMid = new THREE.Color(0x141f38);
    this._nightTop = new THREE.Color(0x050b16);

    // Gradient dome — custom shader: 3-stop vertical gradient + sun disc + glow
    const geo = new THREE.SphereGeometry(420, 32, 24);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: PALETTE.skyTop },
        mid: { value: PALETTE.skyMid },
        horizon: { value: PALETTE.horizon },
        sunDir: { value: new THREE.Vector3(0.5, 0.24, -0.83).normalize() },
        sunCore: { value: PALETTE.sunCore },
        sunGlow: { value: PALETTE.sunGlow },
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 top, mid, horizon, sunDir, sunCore, sunGlow;
        uniform float time;
        void main() {
          float y = clamp(vDir.y, -0.12, 1.0);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.24, y));
          col = mix(col, top, smoothstep(0.22, 0.7, y));
          float sunD = distance(vDir, sunDir);
          float disc = smoothstep(0.06, 0.038, sunD);
          float halo = exp(-sunD * 4.2) * 0.75;
          col += sunCore * disc * 1.3 + sunGlow * halo;
          col += horizon * 0.06 * (1.0 - smoothstep(0.0, 0.3, y)) * (0.5 + 0.5 * sin(vDir.x * 40.0 + time * 0.05));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(geo, this.skyMat);
    dome.name = 'skydome';
    this.group.add(dome);

    // Drifting cloud bands — translucent sprite planes at varied depths
    const cloudTex = cloudSprite();
    this.clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      depthWrite: false,
      fog: false,
      color: 0x8a97ad,
      opacity: 0.7,
    });
    for (let i = 0; i < 9; i++) {
      const w = rand(60, 150);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.32), cloudMat);
      m.position.set(rand(-200, 260), rand(26, 90), rand(-260, -140));
      m.userData.drift = rand(0.4, 1.1);
      this.clouds.push(m);
      this.group.add(m);
    }

    scene.add(this.group);
  }

  // PMREM source: tiny standalone scene reproducing the gradient + sun,
  // so reflective materials pick up believable dusk reflections.
  static makeEnvScene() {
    const s = new THREE.Scene();
    const geo = new THREE.SphereGeometry(60, 24, 16);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cTop = PALETTE.skyTop;
    const cHor = PALETTE.horizon;
    const cGnd = new THREE.Color(0x0c0f14);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 60;
      if (y >= 0) tmp.lerpColors(cHor, cTop, Math.min(1, y * 1.4));
      else tmp.lerpColors(cHor, cGnd, Math.min(1, -y * 2.2));
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    s.add(new THREE.Mesh(geo, mat));
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(5, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe0b0 })
    );
    sun.position.set(28, 9, -42);
    s.add(sun);
    return s;
  }

  update(dt, nightT = 0) {
    this.skyMat.uniforms.time.value += dt;
    // long-run progression: dusk slowly deepens toward night over ~4 min
    const u = this.skyMat.uniforms;
    u.horizon.value.copy(PALETTE.horizon).lerp(this._nightHorizon, nightT * 0.6);
    u.mid.value.copy(PALETTE.skyMid).lerp(this._nightMid, nightT * 0.45);
    u.top.value.copy(PALETTE.skyTop).lerp(this._nightTop, nightT * 0.5);
    u.sunGlow.value.copy(PALETTE.sunGlow).multiplyScalar(1 - nightT * 0.55);
    for (const c of this.clouds) {
      c.position.x -= c.userData.drift * dt * 0.35;
      if (c.position.x < -240) c.position.x += 480;
    }
  }

  // dome follows camera x so the horizon never slides
  followCamera(camX) {
    this.group.position.x = camX;
  }
}
