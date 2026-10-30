import * as THREE from 'three';
import { createHumanoid, updateColliders, resetPose } from './characters.js';
import { KEEPER, HUMAN_HEIGHT, MODE, clamp, rand, lerp, easeOutCubic } from '../config.js';

const BASE_SCALE = KEEPER.height / HUMAN_HEIGHT;
const ARMS_UP = Math.PI - 0.2;
const REACH = 67.5; // feet to glove centre with arms up (shoulder 43.5 + arm 24), humanoid units

/**
 * Goalkeeper. Ports python update_keeper/shoot_ball:
 *  - Goalkeeper Power: stays planted and rotates up to 65 degrees towards a side.
 *  - Other modes: jumps towards a point in the goal over 0.4 s.
 * Collision now follows the rotated body (the python box never rotated).
 */
export class Keeper {
  constructor(scene) {
    this.human = createHumanoid({ shirt: 0x2e9d4a, shorts: 0x111111, socks: 0x2e9d4a, gloves: 0xf5f5f5, number: 1 });
    this.root = this.human.root;
    scene.add(this.root);

    this.home = new THREE.Vector3(0, 0, KEEPER.lineOffset);
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.fromRoll = 0;
    this.toRoll = 0;
    this.state = 'ready';
    this.timer = 0;
    this.reaction = 0;
    this.duration = KEEPER.jumpDuration;
    this.time = 0;
    this.setSize(KEEPER.width, KEEPER.height);
  }

  get colliders() {
    return this.human.colliders;
  }

  setShirt(color) {
    this.human.setShirt(color);
  }

  /** python keeper_width/keeper_height; both grow by the same factor so scale stays uniform. */
  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.root.scale.setScalar(BASE_SCALE * (height / KEEPER.height));
  }

  reset(ballX, goalWidth) {
    const limit = Math.max(0, goalWidth / 2 - 50);
    this.home.set(clamp(ballX * 0.12, -limit, limit), 0, KEEPER.lineOffset);
    this.root.position.copy(this.home);
    this.root.rotation.set(0, 0, 0);
    this.state = 'ready';
    resetPose(this.human);
  }

  /**
   * React to a shot. `guess` is where the keeper thinks the ball is going
   * (already randomised by the game); the dive starts after a reaction delay.
   */
  /**
   * @param {THREE.Vector3} guess  where the keeper expects the ball at his plane
   * @param {number} flightTime    seconds until the ball reaches that plane
   * @param {number} planeZ        depth the keeper dives at (backs off for lobs)
   */
  react(guess, mode, flightTime, planeZ = KEEPER.lineOffset, { reactionAdd = 0, early = false } = {}) {
    this.mode = mode;
    this.reaction = early ? 0.02 : rand(0.12, 0.22) + reactionAdd;
    this.timer = 0;
    this.state = 'waiting';
    this.from.copy(this.root.position);
    this.fromRoll = 0;

    const s = this.root.scale.x;
    const dx = guess.x - this.home.x;
    // Slow shots give the keeper time to shuffle across before diving.
    const spare = early ? 0 : clamp(flightTime - this.reaction - KEEPER.jumpDuration, 0, 1);
    const maxStep = 60 + spare * 150;
    const maxLift = 55 + spare * 35;
    // Python Goalkeeper Power only rotated (max 65 degrees); keep that limit for the mode.
    const maxRoll = mode === MODE.KEEPER_POWER ? THREE.MathUtils.degToRad(KEEPER.maxRotation) : 1.4;

    // Step as far as allowed, then roll and jump so the gloves land on the guess:
    // glove = feet + L * (-sin(roll), cos(roll)).
    const L = REACH * s;
    const step = clamp(dx, -maxStep, maxStep);
    const roll = -Math.asin(clamp((dx - step) / L, -1, 1));
    const clampedRoll = clamp(roll, -maxRoll, maxRoll);
    const lift = clamp(guess.y - L * Math.cos(clampedRoll), 0, maxLift);
    this.to.set(this.home.x + step, lift, planeZ);
    this.toRoll = clampedRoll;
    const minDuration = mode === MODE.KEEPER_POWER ? KEEPER.rotationDuration : KEEPER.jumpDuration;
    this.duration = early ? minDuration : clamp(flightTime - this.reaction, minDuration, 0.9);
  }

  update(dt) {
    this.time += dt;
    const h = this.human;

    if (this.state === 'ready' || this.state === 'waiting') {
      if (this.state === 'waiting') {
        this.timer += dt;
        if (this.timer >= this.reaction) {
          this.state = 'diving';
          this.timer = 0;
        }
      }
      // Bounce on the toes, arms out wide.
      const bob = Math.abs(Math.sin(this.time * 5.5));
      h.body.position.y = -2 + bob * 1.5;
      h.hipL.rotation.x = h.hipR.rotation.x = 0.15;
      h.hipL.rotation.z = -0.12;
      h.hipR.rotation.z = 0.12;
      h.shoulderL.rotation.z = -0.85;
      h.shoulderR.rotation.z = 0.85;
      h.shoulderL.rotation.x = h.shoulderR.rotation.x = -0.35;
      if (this.state === 'ready') {
        this.root.position.x = lerp(this.root.position.x, this.home.x + Math.sin(this.time * 1.3) * 6, Math.min(1, dt * 4));
      }
    } else if (this.state === 'diving' || this.state === 'landing') {
      this.timer += dt;
      if (this.state === 'diving') {
        const t = Math.min(1, this.timer / this.duration);
        const e = easeOutCubic(t);
        this.root.position.lerpVectors(this.from, this.to, e);
        // A little arc on top of the straight python lerp.
        this.root.position.y += Math.sin(t * Math.PI) * 10;
        this.root.rotation.z = lerp(this.fromRoll, this.toRoll, e);
        const arms = lerp(0.85, ARMS_UP, e);
        h.shoulderL.rotation.z = -arms;
        h.shoulderR.rotation.z = arms;
        h.shoulderL.rotation.x = h.shoulderR.rotation.x = lerp(-0.35, 0, e);
        h.hipL.rotation.z = -0.25 * e;
        h.hipR.rotation.z = 0.25 * e;
        if (t >= 1) {
          this.state = 'landing';
          this.timer = 0;
        }
      } else {
        // Fall back to the grass after the dive.
        const t = Math.min(1, Math.max(0, this.timer - 0.08) / 0.45);
        this.root.position.y = Math.max(0, this.to.y * (1 - t * t));
      }
    }

    updateColliders(h);
  }
}
