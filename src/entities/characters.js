import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Humanoid built from the same proportions as python draw_player / draw_wall:
// legs block 16x20x8, body 18x28x9 centred at 32, head radius 9 at 55.
// Legs and arms are split and pivoted so they can be animated.

const SKIN = 0xffccb3;
const geometries = {};
const materials = new Map();

function geo(key, make) {
  if (!geometries[key]) geometries[key] = make();
  return geometries[key];
}

export function material(color, opts = {}) {
  const key = `${color}|${opts.roughness ?? 0.7}|${opts.metalness ?? 0}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.7,
      metalness: opts.metalness ?? 0,
    }));
  }
  return materials.get(key);
}

function mesh(geometry, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function numberTexture(num, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = 'bold 92px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function luminance(color) {
  const c = new THREE.Color(color);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * @returns {{root, body, hips, hipL, hipR, shoulderL, shoulderR, head, torso, colliders, setShirt}}
 */
export function createHumanoid({
  shirt = 0x2e7d32,
  shorts = 0x1a1a1a,
  socks = 0xf2f2f2,
  skin = SKIN,
  hair = 0x33190f,
  gloves = null,
  number = null,
} = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bob / lean without moving the root
  root.add(body);

  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.65 });
  const skinMat = material(skin, { roughness: 0.6 });

  // Legs (python: single 16x20x8 block; split in two so they can swing)
  const hips = new THREE.Group();
  body.add(hips);
  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 4.3, 20, 0);
    hip.add(mesh(geo('thigh', () => new RoundedBoxGeometry(7.4, 10, 8, 2, 2)), material(shorts), 0, -4.5, 0));
    hip.add(mesh(geo('shin', () => new THREE.CylinderGeometry(3, 2.6, 10, 10)), material(socks), 0, -13.5, 0));
    hip.add(mesh(geo('boot', () => new RoundedBoxGeometry(6, 3.4, 10, 2, 1.2)), material(0x111111, { roughness: 0.4 }), 0, -18.3, 1.6));
    hips.add(hip);
    return hip;
  };
  const hipL = makeLeg(-1);
  const hipR = makeLeg(1);

  // Torso (python: 18 x 28 x 9 at y=32)
  const torso = mesh(geo('torso', () => new RoundedBoxGeometry(18, 28, 9, 3, 3)), shirtMat, 0, 32, 0);
  body.add(torso);

  if (number !== null) {
    const textColor = luminance(shirt) > 0.45 ? '#111' : '#fff';
    const plate = new THREE.Mesh(
      geo('numberPlate', () => new THREE.PlaneGeometry(11, 11)),
      new THREE.MeshStandardMaterial({ map: numberTexture(number, textColor), transparent: true, roughness: 0.7 }),
    );
    plate.position.set(0, 34, -4.65);
    plate.rotation.y = Math.PI;
    body.add(plate);
  }

  // Head (python: radius 9 at y=55)
  const head = new THREE.Group();
  head.position.set(0, 55, 0);
  head.add(mesh(geo('neck', () => new THREE.CylinderGeometry(3, 3.4, 6, 10)), skinMat, 0, -8, 0));
  head.add(mesh(geo('head', () => new THREE.SphereGeometry(8.5, 20, 16)), skinMat));
  head.add(mesh(
    geo('hair', () => new THREE.SphereGeometry(8.9, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42)),
    material(hair, { roughness: 0.9 }), 0, 0.6, -0.6,
  ));
  body.add(head);

  // Arms: pivot at the shoulder, hang along -y
  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 11.6, 43.5, 0);
    shoulder.add(mesh(geo('sleeve', () => new THREE.CylinderGeometry(3.5, 3.2, 9, 10)), shirtMat, 0, -3.5, 0));
    shoulder.add(mesh(geo('arm', () => new THREE.CylinderGeometry(2.7, 2.2, 17, 10)), skinMat, 0, -14, 0));
    const hand = gloves
      ? mesh(geo('glove', () => new THREE.SphereGeometry(4.2, 12, 10)), material(gloves, { roughness: 0.5 }), 0, -24.5, 0)
      : mesh(geo('hand', () => new THREE.SphereGeometry(2.7, 10, 8)), skinMat, 0, -23.5, 0);
    shoulder.add(hand);
    body.add(shoulder);
    return shoulder;
  };
  const shoulderL = makeArm(-1);
  const shoulderR = makeArm(1);

  // Capsule colliders in local space of the part they follow.
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const handR = gloves ? 5 : 3;
  const colliders = [
    { obj: body, a: V(0, 22), b: V(0, 42), r: 9.5 },
    { obj: head, a: V(0, 0), b: V(0, 0), r: 9 },
    { obj: hipL, a: V(0, 0), b: V(0, -18), r: 4.4 },
    { obj: hipR, a: V(0, 0), b: V(0, -18), r: 4.4 },
    { obj: shoulderL, a: V(0, 0), b: V(0, -24), r: handR },
    { obj: shoulderR, a: V(0, 0), b: V(0, -24), r: handR },
  ].map((c) => ({ ...c, wa: new THREE.Vector3(), wb: new THREE.Vector3(), wr: c.r }));

  return {
    root, body, hips, hipL, hipR, shoulderL, shoulderR, head, torso, colliders,
    setShirt(color) { shirtMat.color.set(color); },
  };
}

/** Refresh world-space collider endpoints. Call after animating, once per frame. */
export function updateColliders(h) {
  h.root.updateMatrixWorld(true);
  const s = h.root.scale.x;
  for (const c of h.colliders) {
    c.wa.copy(c.a);
    c.obj.localToWorld(c.wa);
    c.wb.copy(c.b);
    c.obj.localToWorld(c.wb);
    c.wr = c.r * s;
  }
}

/** Secret big-head mode. */
export function setBigHead(h, on) {
  h.head.scale.setScalar(on ? 1.8 : 1);
  h.head.position.y = on ? 62 : 55;
}

export function resetPose(h) {
  for (const part of [h.body, h.hips, h.hipL, h.hipR, h.shoulderL, h.shoulderR, h.head]) {
    part.rotation.set(0, 0, 0);
  }
  h.body.position.set(0, 0, 0);
}

/** Running cycle; `phase` in radians. */
export function poseRun(h, phase, amount = 1) {
  const s = Math.sin(phase) * amount;
  h.hipL.rotation.x = s * 0.9;
  h.hipR.rotation.x = -s * 0.9;
  h.shoulderL.rotation.x = -s * 0.8;
  h.shoulderR.rotation.x = s * 0.8;
  h.shoulderL.rotation.z = -0.12;
  h.shoulderR.rotation.z = 0.12;
  h.body.position.y = Math.abs(Math.cos(phase)) * 2.2 * amount;
  h.body.rotation.x = 0.12 * amount;
}
