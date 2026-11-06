import * as THREE from 'three';
import { damp, clamp } from './config.js';

// Two play modes from the python setup_camera: 3 = third person orbit behind the
// kicker (arrow keys rotate), 1 = first person from the kicker looking at the marker.
export const CAM_ORBIT = 3;
export const CAM_FIRST_PERSON = 1;

const GOAL_FOCUS = new THREE.Vector3(0, 80, 0);
const _away = new THREE.Vector3();
const _right = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = CAM_ORBIT;
    this.yaw = 0;
    this.pitch = 0;
    this.shakeAmount = 0;
    this.position = new THREE.Vector3(0, 400, 1400);
    this.look = new THREE.Vector3(0, 60, 300);
    this.menuAngle = 0;
  }

  toggleMode() {
    this.mode = this.mode === CAM_ORBIT ? CAM_FIRST_PERSON : CAM_ORBIT;
    return this.mode;
  }

  /** python specialKeyListener: vertical angle clamped to [-20, 70] degrees. */
  rotate(dYaw, dPitch) {
    this.yaw = clamp(this.yaw + dYaw, -1.2, 1.2);
    this.pitch = clamp(this.pitch + dPitch, -0.35, 1.0);
  }

  cut() {
    this.cutNext = true;
  }

  shake(amount) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  snap() {
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.look);
  }

  /**
   * @param {object} ctx
   * @param {'menu'|'aim'|'flight'|'result'} ctx.phase
   * @param {THREE.Vector3} ctx.ball   ball position
   * @param {THREE.Vector3} ctx.spot   free-kick spot
   * @param {THREE.Vector3} ctx.marker aim marker
   * @param {THREE.Vector3} ctx.eye    kicker eye (first person)
   */
  update(dt, ctx) {
    let posK = 4, lookK = 6;

    if (ctx.phase === 'replay') {
      // Cinematic angle from the far back corner of the net, looking out at the ball.
      _desired.set((ctx.replaySide ?? 1) * 260, 150, -230 + Math.min(0, ctx.ball.z) * 0.3);
      _look.copy(ctx.ball);
      posK = 1.2;
      lookK = 7;
    } else if (ctx.phase === 'menu') {
      // Low broadcast angle from the touchline, drifting slowly like a crane camera.
      // The action is framed right of centre to leave room for the menu.
      const m = this.motion === false ? 0 : 1;
      const t = (this.menuAngle += dt * m);
      _desired.set(
        520 + Math.sin(t * 0.06) * 120 * m,
        100 + Math.sin(t * 0.09) * 18 * m,
        1020 + Math.cos(t * 0.06) * 90 * m,
      );
      _look.set(
        -190 + Math.sin(t * 0.045) * 40 * m + Math.sin(t * 0.7) * 1.5 * m,
        96 + Math.sin(t * 0.53) * 1.2 * m,
        300,
      );
      posK = lookK = 1.1;
    } else if (this.mode === CAM_FIRST_PERSON) {
      _desired.copy(ctx.eye);
      if (ctx.phase === 'aim') _look.lerpVectors(ctx.marker, GOAL_FOCUS, 0.45);
      else _look.copy(ctx.ball);
      posK = 10;
      lookK = ctx.phase === 'aim' ? 12 : 8;
    } else {
      // Orbit: behind the spot, on the line from the goal through the ball.
      _away.set(ctx.spot.x, 0, ctx.spot.z).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw);
      const elev = 0.4 + this.pitch;
      const dist = 330;
      if (ctx.phase === 'aim') {
        // Over the kicker's right shoulder (the kicker stands left of the ball).
        _right.set(_away.z, 0, -_away.x);
        _desired.copy(ctx.spot).addScaledVector(_away, Math.cos(elev) * dist).addScaledVector(_right, 40);
        _desired.y = 50 + Math.sin(elev) * dist;
        _look.lerpVectors(ctx.spot, GOAL_FOCUS, 0.5).addScaledVector(_right, 15);
        _look.y -= 10;
      } else {
        // Follow the ball, but stop short of running into the net.
        _desired.copy(ctx.ball);
        _desired.z = Math.max(_desired.z, 140);
        _desired.addScaledVector(_away, Math.cos(elev) * dist * 0.85);
        _desired.y = Math.max(60, ctx.ball.y * 0.5 + 40 + Math.sin(elev) * dist * 0.7);
        _look.copy(ctx.ball).lerp(GOAL_FOCUS, 0.25);
        posK = ctx.phase === 'flight' ? 2.2 : 1.2;
        lookK = 5;
      }
    }

    if (this.cutNext) {
      // Hard cut (e.g. into a replay) instead of a smooth move.
      this.cutNext = false;
      this.position.copy(_desired);
      this.look.copy(_look);
    }
    this.position.lerp(_desired, damp(posK, dt));
    this.look.lerp(_look, damp(lookK, dt));
    this.camera.position.copy(this.position);

    if (this.shakeAmount > 0.01) {
      const s = this.shakeAmount;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.shakeAmount *= Math.exp(-dt * 7);
    }
    this.camera.lookAt(this.look);
  }
}
