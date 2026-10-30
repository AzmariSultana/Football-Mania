import * as THREE from 'three';
import { PHYSICS, SHOT, lerp } from './config.js';

const _ab = new THREE.Vector3();
const _ap = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _n = new THREE.Vector3();

/**
 * Resolve a sphere against a capsule (segment a-b with radius capRadius).
 * Pushes the sphere out, reflects its velocity and returns the impact speed
 * along the normal (0 when there was no contact). The contact normal is
 * written to `outNormal` when provided.
 */
export function sphereVsCapsule(pos, vel, radius, a, b, capRadius, restitution, tangentKeep, outNormal) {
  _ab.subVectors(b, a);
  const len2 = _ab.lengthSq();
  let t = len2 > 1e-6 ? _ap.subVectors(pos, a).dot(_ab) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  _closest.copy(a).addScaledVector(_ab, t);
  _n.subVectors(pos, _closest);
  const d = _n.length();
  const minD = radius + capRadius;
  if (d >= minD) return 0;

  if (d < 1e-5) _n.set(0, 0, 1);
  else _n.divideScalar(d);
  pos.copy(_closest).addScaledVector(_n, minD + 0.01);
  if (outNormal) outNormal.copy(_n);

  const vn = vel.dot(_n);
  if (vn >= 0) return 0;
  vel.addScaledVector(_n, -vn);          // keep the tangential part
  vel.multiplyScalar(tangentKeep);
  vel.addScaledVector(_n, -vn * restitution);
  return -vn;
}

/**
 * Initial velocity that carries the ball from `from` to `target` on the goal
 * plane. Power sets the flight time (low power = a slow, high lob), curve adds
 * a constant sideways acceleration that is pre-compensated so the ball still
 * finishes on the target. Replaces python shoot_ball's straight-line flight.
 */
export function computeLaunch(from, target, power, curve, outVel, outSpin) {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  const dist = Math.max(1, Math.hypot(dx, dz));
  const speed = lerp(SHOT.minSpeed, SHOT.maxSpeed, power);
  const t = Math.max(0.2, dist / speed);

  // Right-hand perpendicular: shooting towards -z, +curve bends to +x (screen right).
  const side = curve * SHOT.maxCurve;
  const ax = (-dz / dist) * side;
  const az = (dx / dist) * side;
  const ay = -power * SHOT.maxDip;

  outVel.set(
    (dx - 0.5 * ax * t * t) / t,
    (target.y - from.y + 0.5 * (PHYSICS.gravity - ay) * t * t) / t,
    (dz - 0.5 * az * t * t) / t,
  );
  outSpin.set(ax, ay, az);
  return t;
}

/** Position along a launched trajectory, ignoring collisions (for the aim preview). */
export function trajectoryPoint(from, vel, spin, t, out) {
  return out.set(
    from.x + vel.x * t + 0.5 * spin.x * t * t,
    from.y + vel.y * t + 0.5 * (spin.y - PHYSICS.gravity) * t * t,
    from.z + vel.z * t + 0.5 * spin.z * t * t,
  );
}
