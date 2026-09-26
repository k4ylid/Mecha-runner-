// Camera rig — side-on follow with speed lookahead, dead-zone vertical
// tracking, FOV widening, landing dip, trauma shake, slide tilt, death push.
import * as THREE from 'three';
import { PLAYER_X, SPEED } from '../core/config.js';
import { clamp, damp, lerp } from '../core/utils.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.baseFov = 55;
    this.pos = new THREE.Vector3(PLAYER_X + 2.2, 3.6, 16.5);
    this.look = new THREE.Vector3(PLAYER_X + 2.0, 2.1, 0);
    this.lookAhead = 1.4;
    this.trauma = 0;
    this.dip = 0;
    this.dipV = 0;
    this.tilt = 0;
    this.deathZoom = 0;
    this.introT = 0;
    this.shakeT = 0;
    this.enabled = { shake: true, motion: true };
    camera.position.copy(this.pos);
    camera.lookAt(this.look);
  }

  addShake(amount) {
    if (!this.enabled.shake || !this.enabled.motion) return;
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  landDip(vy) {
    const k = clamp(Math.abs(vy) / 30, 0, 1);
    this.dipV -= 3.2 * k;
  }

  startIntro() {
    this.introT = 0;
  }

  update(dt, player, speed, state, reduceMotion) {
    const speedN = clamp((speed - SPEED.start) / (SPEED.max - SPEED.start), 0, 1);

    // lookahead grows with speed — see further ahead when it matters
    const targetAhead = lerp(1.4, 4.6, Math.pow(speedN, 0.8));
    this.lookAhead = damp(this.lookAhead, targetAhead, 3.5, dt);

    // dead-zone vertical follow: camera commits only on real height change
    const targetY = clamp(3.6 + player.y * 0.34, 3.2, 7.4);
    this.pos.y = damp(this.pos.y, targetY, 5, dt);
    this.pos.x = damp(this.pos.x, PLAYER_X + this.lookAhead, 6, dt);
    this.pos.z = damp(this.pos.z, 16.5 - speedN * 1.6, 2.5, dt); // creep closer as speed rises

    // landing dip: critically-damped-ish spring
    this.dipV += (-this.dip * 90 - this.dipV * 12) * dt;
    this.dip += this.dipV * dt;

    // slide tilt
    const targetTilt = player.state === 'slide' ? -0.055 : player.jetT > 0 ? 0.05 : 0;
    this.tilt = damp(this.tilt, targetTilt, 8, dt);

    // death: push in on the wreck
    if (state === 'dead') {
      this.deathZoom = damp(this.deathZoom, 1, 2.2, dt);
    } else {
      this.deathZoom = damp(this.deathZoom, 0, 6, dt);
    }

    // trauma shake — squared falloff, tiny rotation+pos noise
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.shakeT += dt * 34;
    const sh = this.enabled.motion ? this.trauma * this.trauma : 0;
    const sx = sh * 0.35 * Math.sin(this.shakeT * 1.3 + 4.4);
    const sy = sh * 0.3 * Math.sin(this.shakeT * 1.7);
    const sr = sh * 0.03 * Math.sin(this.shakeT * 2.1 + 1.7);

    const zoom = this.deathZoom;
    this.camera.position.set(
      this.pos.x + sx - zoom * 2.2,
      this.pos.y + sy + this.dip - zoom * 0.9,
      this.pos.z - zoom * 6.5
    );
    this.look.set(
      this.pos.x + this.lookAhead * 0.55 + sx * 0.4,
      2.15 + this.dip * 0.6 + player.y * 0.22,
      0
    );
    if (state === 'dead') {
      this.look.x = player.group.position.x;
      this.look.y = Math.max(0.6, player.y + 1.2);
    }
    this.camera.lookAt(this.look);
    this.camera.rotation.z += this.tilt + sr;

    // FOV: wide-open speed euphoria
    const targetFov = reduceMotion ? this.baseFov : this.baseFov + speedN * 9 + zoom * -6;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, targetFov, 4, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
