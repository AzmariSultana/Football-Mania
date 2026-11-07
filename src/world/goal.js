import * as THREE from 'three';
import { GOAL, getGoalPoints, BRAND_FONT } from '../config.js';

const NET_CELL = 11;

function netTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function labelTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = `900 88px ${BRAND_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function scaleUVs(geometry, su, sv) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geometry;
}

const ZONE_COLORS = { 9: 0xffd23f, 5: 0x4fc3ff, 3: 0xffffff };

/** Goal frame, net and the 3x3 scoring-zone overlay (python draw_goalpost). */
export class Goal {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.height = GOAL.height;
    this.netTex = netTexture();
    this.postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.2 });
    this.frameMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.5, metalness: 0.6 });
    this.netMat = new THREE.MeshStandardMaterial({
      map: this.netTex, alphaMap: this.netTex, transparent: true, alphaTest: 0.25,
      side: THREE.DoubleSide, roughness: 0.9, color: 0xf4f4f4, depthWrite: false,
    });
    this.ripples = [];
    this.zonesVisible = false;
    this.zoneOpacity = 0;
    this.highlight = -1;
    this.colliders = [];
    this.setWidth(GOAL.width);
  }

  setWidth(width) {
    this.width = width;
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      child.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.userData.disposable) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    }
    this.build();
  }

  build() {
    const w = this.width, h = this.height, d = GOAL.netDepth, r = GOAL.postRadius;
    const g = this.group;

    const cyl = (len, radius, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 16), mat);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    // Posts and crossbar
    cyl(h + r, r, this.postMat).position.set(-w / 2, (h + r) / 2, 0);
    cyl(h + r, r, this.postMat).position.set(w / 2, (h + r) / 2, 0);
    const bar = cyl(w + 2 * r, r, this.postMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, h, 0);

    // Back frame holding the net
    const fr = 2.2;
    for (const sx of [-1, 1]) {
      const top = cyl(d, fr, this.frameMat);
      top.rotation.x = Math.PI / 2;
      top.position.set(sx * w / 2, h, -d / 2);
      const back = cyl(h, fr, this.frameMat);
      back.position.set(sx * w / 2, h / 2, -d);
      const ground = cyl(d, fr, this.frameMat);
      ground.rotation.x = Math.PI / 2;
      ground.position.set(sx * w / 2, fr, -d / 2);
    }
    const backTop = cyl(w, fr, this.frameMat);
    backTop.rotation.z = Math.PI / 2;
    backTop.position.set(0, h, -d);
    const backGround = cyl(w, fr, this.frameMat);
    backGround.rotation.z = Math.PI / 2;
    backGround.position.set(0, fr, -d);

    // Net: back panel is finely segmented so it can bulge.
    const backGeo = scaleUVs(new THREE.PlaneGeometry(w, h, 40, 20), w / NET_CELL, h / NET_CELL);
    this.backNet = new THREE.Mesh(backGeo, this.netMat);
    this.backNet.position.set(0, h / 2, -d);
    this.backBase = Float32Array.from(backGeo.attributes.position.array);
    g.add(this.backNet);

    const roof = new THREE.Mesh(scaleUVs(new THREE.PlaneGeometry(w, d), w / NET_CELL, d / NET_CELL), this.netMat);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, h, -d / 2);
    g.add(roof);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(scaleUVs(new THREE.PlaneGeometry(d, h), d / NET_CELL, h / NET_CELL), this.netMat);
      side.rotation.y = Math.PI / 2;
      side.position.set(sx * w / 2, h / 2, -d / 2);
      g.add(side);
    }

    // Scoring zones (python get_goal_points thirds)
    this.zones = [];
    const zw = w / 3, zh = h / 3;
    for (let iy = 0; iy < 3; iy++) {
      for (let ix = 0; ix < 3; ix++) {
        const cx = -w / 2 + zw * (ix + 0.5);
        const cy = zh * (iy + 0.5);
        const pts = getGoalPoints(cx, cy, w, h);
        const mat = new THREE.MeshBasicMaterial({
          color: ZONE_COLORS[pts], transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
        });
        mat.userData.disposable = true;
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(zw - 3, zh - 3), mat);
        tile.position.set(cx, cy, -1);
        tile.renderOrder = 2;
        g.add(tile);

        const labelMat = new THREE.SpriteMaterial({
          map: labelTexture(String(pts), pts === 9 ? '#ffd23f' : pts === 5 ? '#7fd6ff' : '#ffffff'),
          transparent: true, opacity: 0, depthWrite: false,
        });
        labelMat.userData.disposable = true;
        const label = new THREE.Sprite(labelMat);
        const size = Math.min(zw, zh) * 0.5;
        label.scale.set(size, size, 1);
        label.position.set(cx, cy, -2);
        label.renderOrder = 3;
        g.add(label);
        this.zones.push({ tile, label, pts });
      }
    }

    // Colliders for the frame (world space; the group sits at the origin).
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    this.colliders = [
      { wa: V(-w / 2, 0, 0), wb: V(-w / 2, h, 0), wr: r },
      { wa: V(w / 2, 0, 0), wb: V(w / 2, h, 0), wr: r },
      { wa: V(-w / 2, h, 0), wb: V(w / 2, h, 0), wr: r },
    ];
  }

  /** python check_goal: inside the mouth when crossing the goal line. */
  isInside(x, y, radius) {
    return Math.abs(x) < this.width / 2 - GOAL.postRadius && y > 0 && y < this.height - GOAL.postRadius * 0.5 + radius * 0.3;
  }

  /**
   * Net is soft: crossing one of its planes from either side kills most of the
   * ball's speed along that axis and starts a ripple. Returns true on contact.
   */
  collideNet(ball) {
    const p = ball.position, q = ball.prev, v = ball.velocity;
    const w = this.width, h = this.height, d = GOAL.netDepth, r = ball.radius;
    let hit = false;

    const inDepth = p.z < 0 && p.z > -d;
    const inWidth = Math.abs(p.x) < w / 2;
    // Side panels
    for (const sx of [-w / 2, w / 2]) {
      if (inDepth && p.y < h && (q.x - sx) * (p.x - sx) < 0) {
        p.x = sx + Math.sign(q.x - sx) * 0.5;
        v.x *= -0.15;
        v.z *= 0.6;
        hit = true;
      }
    }
    // Roof
    if (inDepth && inWidth && (q.y - h) * (p.y - h) < 0) {
      p.y = h + Math.sign(q.y - h) * 0.5;
      v.y *= -0.15;
      hit = true;
    }
    // Back panel (account for the ball radius when inside the goal)
    const back = -d + r;
    if (Math.abs(p.x) < w / 2 && p.y < h && q.z > back && p.z <= back) {
      p.z = back;
      this.ripple(p.x, p.y, Math.min(1, -v.z / 900));
      v.z *= -0.12;
      v.x *= 0.5;
      v.y *= 0.5;
      hit = true;
    }
    return hit;
  }

  ripple(x, y, strength) {
    this.ripples.push({ x, y: y - this.height / 2, t: 0, s: 26 * strength });
  }

  showZones(visible) {
    this.zonesVisible = visible;
  }

  highlightAt(x, y) {
    if (Math.abs(x) > this.width / 2 || y < 0 || y > this.height) {
      this.highlight = -1;
      return;
    }
    const ix = Math.max(0, Math.min(2, Math.floor((x + this.width / 2) / (this.width / 3))));
    const iy = Math.max(0, Math.min(2, Math.floor(y / (this.height / 3))));
    this.highlight = iy * 3 + ix;
  }

  update(dt) {
    const target = this.zonesVisible ? 1 : 0;
    this.zoneOpacity += (target - this.zoneOpacity) * Math.min(1, dt * 8);
    this.zones.forEach((z, i) => {
      const hi = i === this.highlight;
      z.tile.material.opacity = this.zoneOpacity * (hi ? 0.3 : 0.08);
      z.label.material.opacity = this.zoneOpacity * (hi ? 0.95 : 0.45);
    });

    if (!this.ripples.length) return;
    const pos = this.backNet.geometry.attributes.position;
    const arr = pos.array, base = this.backBase;
    for (let i = 0; i < arr.length; i += 3) {
      const bx = base[i], by = base[i + 1];
      let disp = 0;
      for (const r of this.ripples) {
        const dx = bx - r.x, dy = by - r.y;
        const fall = Math.exp(-(dx * dx + dy * dy) / 2600);
        disp -= r.s * fall * Math.exp(-r.t * 3.2) * Math.cos(r.t * 16);
      }
      arr[i + 2] = base[i + 2] + disp;
    }
    pos.needsUpdate = true;
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 2);
    if (!this.ripples.length) {
      arr.set(base);
      pos.needsUpdate = true;
    }
  }
}
