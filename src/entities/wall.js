import * as THREE from 'three';
import { createHumanoid, updateColliders } from './characters.js';
import { WALL, rand, clamp } from '../config.js';

const MAX_PLAYERS = 6; // The Fortress boss uses a six-man wall

/** The defensive wall (python spawn_player_and_ball / draw_wall). */
export class DefensiveWall {
  constructor(scene) {
    this.players = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      // python wall colour (0.7, 0.1, 0.1) was red; we use the defending team kit.
      const h = createHumanoid({ shirt: 0x1f4fbf, shorts: 0x0d1b3d, socks: 0x1f4fbf, number: [4, 5, 6, 8, 3, 2][i] });
      h.root.scale.setScalar(WALL.scale);
      // Hands protecting the body.
      h.shoulderL.rotation.set(-0.5, 0, 0.35);
      h.shoulderR.rotation.set(-0.5, 0, -0.35);
      scene.add(h.root);
      this.players.push({ h, base: new THREE.Vector3(), delay: 0, jumpT: -1, phase: Math.random() * 6 });
    }
    this.time = 0;
    this.count = WALL.count;
    this.activePlayers = this.players.slice(0, this.count);
    this.sizeScale = 1;
    this.colliders = [];
  }

  get humans() {
    return this.players.map((p) => p.h);
  }

  get active() {
    return this.activePlayers;
  }

  /** Line the wall up between the ball and the near half of the goal. */
  place(ball, goalWidth, count = WALL.count) {
    this.count = count;
    this.activePlayers = this.players.slice(0, count);
    const nearSide = Math.abs(ball.x) < 40 ? 0 : Math.sign(ball.x);
    const aim = new THREE.Vector3(nearSide * goalWidth * 0.2, 0, 0);
    const dir = new THREE.Vector3(aim.x - ball.x, 0, aim.z - ball.z).normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const toGoal = Math.hypot(aim.x - ball.x, ball.z);
    const distance = clamp(toGoal * WALL.distanceRatio, WALL.minDistance, WALL.maxDistance);
    const centre = new THREE.Vector3(ball.x, 0, ball.z).addScaledVector(dir, distance);
    const facing = Math.atan2(-dir.x, -dir.z);

    this.players.forEach((p, i) => {
      p.h.root.visible = i < count;
      p.base.copy(centre).addScaledVector(right, (i - (count - 1) / 2) * WALL.spacing);
      p.h.root.position.copy(p.base);
      p.h.root.rotation.y = facing;
      p.jumpT = -1;
    });
    this.setSize(1);
    this.colliders = this.active.flatMap((p) => p.h.colliders);
    this.update(0);
  }

  /** Mini Wall power-up shrinks the players (colliders scale with them). */
  setSize(scale) {
    this.sizeScale = scale;
    for (const p of this.players) p.h.root.scale.setScalar(WALL.scale * scale);
  }

  jump() {
    for (const p of this.active) {
      p.delay = rand(0.05, 0.16);
      p.jumpT = 0;
    }
  }

  update(dt) {
    this.time += dt;
    for (const p of this.active) {
      let y = 0;
      if (p.jumpT >= 0) {
        p.jumpT += dt;
        const t = (p.jumpT - p.delay) / 0.55;
        if (t > 0 && t < 1) y = Math.sin(t * Math.PI) * WALL.jumpHeight * this.sizeScale;
      }
      p.h.root.position.y = y;
      p.h.body.position.y = y > 0 ? 0 : Math.sin(this.time * 3 + p.phase) * 0.4;
      p.h.hipL.rotation.x = p.h.hipR.rotation.x = y > 0 ? -0.25 : 0;
      updateColliders(p.h);
    }
  }
}
