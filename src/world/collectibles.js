import * as THREE from 'three';
import { STICKER } from '../config.js';

function starShape(outer, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function glowTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 7;
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(64, 64, 50, 0, Math.PI * 2);
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

/** Spinning golden star that sometimes appears inside the goal mouth. */
export class StickerTarget {
  constructor(scene) {
    this.group = new THREE.Group();
    const geo = new THREE.ExtrudeGeometry(starShape(STICKER.radius, STICKER.radius * 0.45), {
      depth: 3, bevelEnabled: true, bevelSize: 1.2, bevelThickness: 1.2, bevelSegments: 2,
    });
    geo.center();
    this.star = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xffd23f, emissive: 0xffb000, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.25,
    }));
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,210,63,0.9)'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    this.glow.scale.setScalar(STICKER.radius * 5.5);
    // A bright white ring that pulses outwards: reads against any crowd colour behind the net.
    this.ring = new THREE.Sprite(new THREE.SpriteMaterial({
      map: ringTexture(), transparent: true, depthWrite: false, depthTest: false,
    }));
    this.ring.renderOrder = 8;
    this.group.add(this.glow, this.ring, this.star);
    this.group.visible = false;
    this.active = false;
    this.time = 0;
    this.base = new THREE.Vector3();
    scene.add(this.group);
  }

  show(x, y) {
    this.base.set(x, y, -8);
    this.group.position.copy(this.base);
    this.group.visible = this.active = true;
    this.group.scale.setScalar(0.01);
  }

  hide() {
    this.group.visible = this.active = false;
  }

  /** Ball-centre distance test. */
  hits(pos, radius) {
    return this.active && pos.distanceTo(this.group.position) < radius + STICKER.radius;
  }

  update(dt) {
    if (!this.group.visible) return;
    this.time += dt;
    this.star.rotation.y += dt * 2.4;
    this.group.position.y = this.base.y + Math.sin(this.time * 2.5) * 4;
    const s = this.group.scale.x;
    this.group.scale.setScalar(s + (1 - s) * Math.min(1, dt * 6));
    this.glow.material.opacity = 0.75 + Math.sin(this.time * 5) * 0.25;
    this.glow.scale.setScalar(STICKER.radius * (5.5 + Math.sin(this.time * 5) * 0.8)); // breathing halo
    const pulse = (this.time * 0.9) % 1;                       // ring expands and fades, once a second
    this.ring.scale.setScalar(STICKER.radius * (2.6 + pulse * 2.4));
    this.ring.material.opacity = 0.9 * (1 - pulse);
  }
}

/** Fading ring showing where a near miss crossed the goal line. */
export class GhostMarker {
  constructor(scene) {
    this.mesh = new THREE.Mesh(
      new THREE.RingGeometry(8, 11, 32),
      new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0, depthTest: false }),
    );
    this.mesh.renderOrder = 9;
    this.life = 0;
    scene.add(this.mesh);
  }

  show(x, y) {
    this.mesh.position.set(x, y, 1);
    this.life = 2.2;
  }

  update(dt) {
    this.life = Math.max(0, this.life - dt);
    this.mesh.material.opacity = Math.min(1, this.life) * 0.9;
    this.mesh.visible = this.life > 0;
    this.mesh.scale.setScalar(1 + (2.2 - this.life) * 0.4);
  }
}

/** Pulsing ring under the keeper for bosses and the Ice Keeper power-up. */
export class Aura {
  constructor(scene) {
    this.mesh = new THREE.Mesh(
      new THREE.RingGeometry(40, 58, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 4;
    this.target = 0;
    this.time = 0;
    scene.add(this.mesh);
  }

  set(color) {
    if (color === null) {
      this.target = 0;
      return;
    }
    this.mesh.material.color.set(color);
    this.target = 1;
  }

  update(dt, follow) {
    this.time += dt;
    const m = this.mesh.material;
    m.opacity += (this.target * (0.55 + Math.sin(this.time * 4) * 0.2) - m.opacity) * Math.min(1, dt * 5);
    this.mesh.visible = m.opacity > 0.01;
    this.mesh.position.set(follow.x, 1.2, follow.z);
    this.mesh.scale.setScalar(1 + Math.sin(this.time * 2) * 0.05);
  }
}
