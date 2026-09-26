// Post chain: Render -> [GTAO (HIGH)] -> Bloom -> Grade/Vignette -> Output.
// MSAA via the composer's render target samples (WebGL2).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

// restrained final grade: cool shadows / warm mids, soft vignette,
// barely-there chromatic fringe at frame edges
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.32 },
    saturation: { value: 1.07 },
    lift: { value: new THREE.Vector3(0.012, 0.02, 0.045) },
    gain: { value: new THREE.Vector3(1.03, 1.0, 0.96) },
    caAmount: { value: 0.0016 },
    time: { value: 0 },
    flash: { value: 0 }, // impact flash (white) — brief hits
    danger: { value: 0 }, // red edge pulse while near-death
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float vignette, saturation, caAmount, time, flash, danger;
    uniform vec3 lift, gain;
    void main() {
      vec2 uv = vUv;
      vec2 fromC = uv - 0.5;
      float edge = dot(fromC, fromC);
      // chromatic aberration only at the fringes
      vec2 caOff = fromC * caAmount * (1.0 + edge * 6.0) * 60.0 * 0.016;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + caOff).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - caOff).b;
      // grade: lift shadows cool, gain highlights warm
      col = col * gain + lift;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, saturation);
      // vignette
      float vig = 1.0 - edge * vignette * 2.2;
      col *= clamp(vig, 0.0, 1.0);
      // hit flash & danger pulse
      col = mix(col, vec3(1.0, 0.95, 0.9), flash);
      col = mix(col, vec3(0.9, 0.08, 0.15), danger * edge * 2.6);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Post {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = quality;
    this._build();
  }

  _build() {
    const q = this.quality;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: q.msaa || 0,
    });
    this.composer?.dispose?.();
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.gtao = null;
    if (q.gtao) {
      this.gtao = new GTAOPass(this.scene, this.camera, w, h);
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.composer.addPass(this.gtao);
    }

    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.42, 0.88);
    this.bloom.enabled = q.bloom !== false;
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this._caBase = 0.0016;
    this._vigBase = 0.32;
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
  }

  setQuality(q) {
    this.quality = q;
    this._build();
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.gtao?.setSize(w, h);
  }

  update(dt) {
    this.grade.uniforms.time.value += dt;
    // hit flash decays fast
    const f = this.grade.uniforms.flash;
    f.value = Math.max(0, f.value - dt * 5);
    const d = this.grade.uniforms.danger;
    d.value = Math.max(0, d.value - dt * 2.2);
  }

  flash(v = 0.35) {
    this.grade.uniforms.flash.value = v;
  }

  dangerPulse(v = 0.5) {
    this.grade.uniforms.danger.value = v;
  }

  render() {
    this.composer.render();
  }
}
