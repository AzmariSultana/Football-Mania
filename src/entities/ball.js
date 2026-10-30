import * as THREE from 'three';
import { BALL, PHYSICS } from '../config.js';

// Classic black-and-white ball: faces of a subdivided icosahedron near one of the
// 12 original vertices are painted black, which reproduces the 12 pentagons.
function createBallGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 10);
  const pos = geometry.attributes.position;

  const ico = new THREE.IcosahedronGeometry(1, 0).attributes.position;
  const corners = [];
  for (let i = 0; i < ico.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(ico, i).normalize();
    if (!corners.some((c) => c.distanceToSquared(v) < 1e-6)) corners.push(v);
  }

  const colors = new Float32Array(pos.count * 3);
  const normals = new Float32Array(pos.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const threshold = Math.cos(0.34);
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    const centre = a.add(b).add(c).normalize();
    let best = -1;
    for (const corner of corners) best = Math.max(best, centre.dot(corner));
    const shade = best > threshold ? 0.05 : 0.92;
    for (let k = 0; k < 3; k++) colors.set([shade, shade, shade], (i + k) * 3);
  }
  for (let i = 0; i < pos.count; i++) {
    a.fromBufferAttribute(pos, i).normalize();
    normals.set([a.x, a.y, a.z], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}

const _axis = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Ball {
  constructor(scene) {
    this.radius = BALL.radius;
    this.normalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.0 });
    this.goldenMat = new THREE.MeshStandardMaterial({
      vertexColors: true, color: 0xffcf40, emissive: 0x4a3200, roughness: 0.22, metalness: 0.85,
    });
    this.mesh = new THREE.Mesh(createBallGeometry(), this.normalMat);
    this.mesh.scale.setScalar(this.radius);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.position = this.mesh.position;
    this.prev = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.spin = new THREE.Vector3();   // curve (x/z) and topspin dip (y) acceleration
    this.spinActive = false;
    this.moving = false;
    this.wind = new THREE.Vector3();   // applied while airborne
  }

  setGolden(golden) {
    this.mesh.material = golden ? this.goldenMat : this.normalMat;
  }

  place(x, z) {
    this.position.set(x, this.radius, z);
    this.prev.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.spin.set(0, 0, 0);
    this.spinActive = false;
    this.moving = false;
    this.mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
  }

  launch(velocity, spin) {
    this.velocity.copy(velocity);
    this.spin.copy(spin);
    this.spinActive = true;
    this.moving = true;
  }

  /** Integrate one fixed substep. Returns the downward impact speed if it bounced. */
  step(dt) {
    this.prev.copy(this.position);
    this.velocity.y -= PHYSICS.gravity * dt;
    if (this.spinActive) {
      this.velocity.x += this.spin.x * dt;
      this.velocity.y += this.spin.y * dt;
      this.velocity.z += this.spin.z * dt;
    }
    if (this.position.y > this.radius + 0.5) this.velocity.addScaledVector(this.wind, dt);
    this.position.addScaledVector(this.velocity, dt);

    let impact = 0;
    if (this.position.y < this.radius) {
      this.position.y = this.radius;
      if (this.velocity.y < -60) {
        impact = -this.velocity.y;
        this.velocity.y = impact * PHYSICS.groundRestitution;
        this.velocity.x *= PHYSICS.groundFriction;
        this.velocity.z *= PHYSICS.groundFriction;
        this.spinActive = false;
      } else {
        this.velocity.y = 0;
        const f = Math.max(0, 1 - PHYSICS.rollFriction * dt);
        this.velocity.x *= f;
        this.velocity.z *= f;
      }
    }
    return impact;
  }

  /** Visual roll: rotate around the axis perpendicular to travel. */
  spinVisual(dt) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed < 1) return;
    _axis.set(this.velocity.x, 0, this.velocity.z).normalize().cross(UP).negate();
    this.mesh.rotateOnWorldAxis(_axis, (speed / this.radius) * dt);
  }

  get speed() {
    return this.velocity.length();
  }
}
