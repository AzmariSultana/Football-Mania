import * as THREE from 'three';
import { createHumanoid, poseRun, resetPose } from './characters.js';
import { PLAYER_SCALE, lerp, easeOutCubic } from '../config.js';

const RUNUP_TIME = 0.42;
const SWING_TIME = 0.14;

/** The free-kick taker (python draw_player, scaled by player_scale = 1.5). */
export class Kicker {
  constructor(scene) {
    this.human = createHumanoid({ shirt: 0xd32f2f, shorts: 0xffffff, socks: 0xd32f2f, number: 10 });
    this.root = this.human.root;
    this.root.scale.setScalar(PLAYER_SCALE);
    scene.add(this.root);

    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.start = new THREE.Vector3();
    this.strike = new THREE.Vector3();
    this.state = 'idle';
    this.timer = 0;
    this.time = 0;
    this.onContact = null;
  }

  setShirt(color) {
    this.human.setShirt(color);
  }

  /** Stand a few steps behind and to the left of the ball, facing `aim`. */
  place(ball, aim) {
    this.forward.set(aim.x - ball.x, 0, aim.z - ball.z).normalize();
    this.right.set(-this.forward.z, 0, this.forward.x);
    this.start.copy(ball).addScaledVector(this.forward, -62).addScaledVector(this.right, -22);
    this.strike.copy(ball).addScaledVector(this.forward, -17).addScaledVector(this.right, -11);
    this.start.y = this.strike.y = 0;
    this.root.position.copy(this.start);
    this.root.rotation.set(0, Math.atan2(this.forward.x, this.forward.z), 0);
    this.state = 'idle';
    resetPose(this.human);
  }

  /** Eye position used by the first-person camera (python camera_mode 1). */
  eye(out) {
    return out.copy(this.start).addScaledVector(this.forward, -10).setY(62 * PLAYER_SCALE);
  }

  kick(onContact) {
    this.state = 'runup';
    this.timer = 0;
    this.onContact = onContact;
  }

  update(dt) {
    this.time += dt;
    this.timer += dt;
    const h = this.human;

    if (this.state === 'idle') {
      resetPose(h);
      h.body.position.y = Math.sin(this.time * 2.2) * 0.4;
      h.shoulderL.rotation.z = -0.1;
      h.shoulderR.rotation.z = 0.1;
    } else if (this.state === 'runup') {
      const t = Math.min(1, this.timer / RUNUP_TIME);
      this.root.position.lerpVectors(this.start, this.strike, t);
      poseRun(h, t * Math.PI * 3, 1);
      if (t >= 1) {
        this.state = 'swing';
        this.timer = 0;
      }
    } else if (this.state === 'swing') {
      const t = Math.min(1, this.timer / SWING_TIME);
      // Back-lift then strike: positive x is backwards, negative is forwards.
      h.hipR.rotation.x = lerp(0.9, -1.25, easeOutCubic(t));
      h.hipL.rotation.x = 0.15;
      h.shoulderL.rotation.z = -0.9;
      h.shoulderR.rotation.z = 0.5;
      h.shoulderL.rotation.x = -0.4;
      h.body.rotation.x = -0.12;
      if (t >= 0.45 && this.onContact) {
        const cb = this.onContact;
        this.onContact = null;
        cb();
      }
      if (t >= 1) {
        this.state = 'follow';
        this.timer = 0;
      }
    } else if (this.state === 'follow') {
      const t = Math.min(1, this.timer / 0.6);
      h.hipR.rotation.x = lerp(-1.25, 0, easeOutCubic(t));
      h.shoulderL.rotation.z = lerp(-0.9, -0.1, t);
      h.shoulderR.rotation.z = lerp(0.5, 0.1, t);
      h.body.rotation.x = lerp(-0.12, 0, t);
      this.root.position.addScaledVector(this.forward, (1 - t) * 40 * dt);
      if (t >= 1) this.state = 'done';
    }
  }

  celebrate(dt) {
    const h = this.human;
    this.time += dt;
    h.shoulderL.rotation.z = -2.6 + Math.sin(this.time * 12) * 0.25;
    h.shoulderR.rotation.z = 2.6 - Math.sin(this.time * 12) * 0.25;
    h.body.position.y = Math.abs(Math.sin(this.time * 7)) * 6;
  }
}
