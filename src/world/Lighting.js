// Lighting hierarchy: warm dusk key with shadows, cool sky fill, cyan rim
// for silhouette separation, and a small ground-bounce practical that
// follows the runner. Cheap count, designed roles.
import * as THREE from 'three';
import { PLAYER_X } from '../core/config.js';
import { PALETTE } from './Sky.js';
import { damp } from '../core/utils.js';

export class Lighting {
  constructor(scene, quality) {
    this.scene = scene;

    // key: low warm sun from behind-left — long dramatic shadows forward
    this.key = new THREE.DirectionalLight(0xffb070, 2.6);
    this.key.position.set(-14, 16, -10);
    this.key.castShadow = quality.shadow > 0;
    const s = this.key.shadow;
    s.mapSize.set(quality.shadow || 1024, quality.shadow || 1024);
    s.camera.left = -18;
    s.camera.right = 18;
    s.camera.top = 16;
    s.camera.bottom = -12;
    s.camera.near = 1;
    s.camera.far = 70;
    s.bias = -0.0004;
    s.normalBias = 0.025;
    this.keyTarget = new THREE.Object3D();
    scene.add(this.keyTarget);
    this.key.target = this.keyTarget;
    scene.add(this.key);

    // sky/ground fill — keeps shadows alive, cools the palette
    this.hemi = new THREE.HemisphereLight(0x2a4a6a, 0x241a12, 0.6);
    scene.add(this.hemi);

    // rim: cyan from behind-right — separates the mech from dark deck
    this.rim = new THREE.DirectionalLight(PALETTE.neonCyan.getHex(), 1.35);
    this.rim.position.set(8, 9, -14);
    this.rim.castShadow = false;
    this.rimTarget = new THREE.Object3D();
    scene.add(this.rimTarget);
    this.rim.target = this.rimTarget;
    scene.add(this.rim);

    // camera-side fill: soft cool wash from the viewer's direction so the
    // mech's facing flank never dies to black — the "readable hero" light
    this.fill = new THREE.DirectionalLight(0x8fb4d8, 0.5);
    this.fill.position.set(-6, 10, 20);
    this.fill.castShadow = false;
    this.fillTarget = new THREE.Object3D();
    scene.add(this.fillTarget);
    this.fill.target = this.fillTarget;
    scene.add(this.fill);

    // ground bounce: small warm point tracking just ahead of the runner —
    // the streetlight wash rolling past
    this.bounce = new THREE.PointLight(0xff9a5a, 0, 16, 2);
    this.bounce.position.set(PLAYER_X + 3, 1.6, 2.5);
    scene.add(this.bounce);
  }

  setQuality(q) {
    this.key.castShadow = q.shadow > 0;
    if (q.shadow > 0) {
      this.key.shadow.mapSize.set(q.shadow, q.shadow);
      if (this.key.shadow.map) {
        this.key.shadow.map.dispose();
        this.key.shadow.map = null;
      }
    }
  }

  update(dt, playerY) {
    // shadow frustum follows the play area (world scrolls under it)
    this.keyTarget.position.set(PLAYER_X + 4, playerY, 0);
    this.key.position.set(PLAYER_X - 10 + 4, playerY + 16, -10);
    this.rimTarget.position.set(PLAYER_X + 2, playerY + 1, 0);
    this.rim.position.set(PLAYER_X + 10, playerY + 9, -14);
    this.fillTarget.position.set(PLAYER_X + 1, playerY + 1.4, 0);
    this.fill.position.set(PLAYER_X - 5, playerY + 10, 20);
    this.bounce.position.set(PLAYER_X + 3, playerY + 1.6, 2.2);
    this.bounce.intensity = damp(this.bounce.intensity, 1.4, 3, dt);
  }
}
