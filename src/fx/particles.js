import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uScale / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

const FRAG = /* glsl */`
  uniform float uSoft;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5 || vAlpha <= 0.0) discard;
    float a = uSoft > 0.5 ? smoothstep(0.5, 0.0, d) : smoothstep(0.5, 0.4, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const _color = new THREE.Color();
const _dir = new THREE.Vector3();

/**
 * Pooled GPU point particles. One draw call per system; dead particles are
 * hidden by alpha = 0. Two systems are used: normal blending (confetti, turf)
 * and additive (sparks, flashes, ball trail).
 */
export class Particles {
  constructor(scene, { max = 2000, additive = false, soft = true } = {}) {
    this.max = max;
    this.cursor = 0;
    this.alive = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.flutter = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry = geo;

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 }, uSoft: { value: soft ? 1 : 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  /** Pixel scale for size attenuation: drawingBufferHeight / (2 tan(fov / 2)). */
  setViewport(bufferHeight, fovDeg) {
    this.material.uniforms.uScale.value = bufferHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
  }

  /**
   * @param {object} o
   * @param {THREE.Vector3} o.position
   * @param {number} o.count
   * @param {number|number[]} o.color      hex or list of hex colours
   * @param {THREE.Vector3} [o.direction]  main direction (default up)
   * @param {number} [o.spread]            0 = straight, 1 = hemisphere, 2 = sphere
   */
  emit({
    position, count = 20, color = 0xffffff, direction = null, spread = 1, speed = [50, 150],
    life = [0.5, 1], size = [3, 6], gravity = 300, drag = 1, flutter = 0, jitter = 0,
  }) {
    const colors = Array.isArray(color) ? color : [color];
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;

      _dir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      if (direction) {
        _dir.multiplyScalar(spread).add(direction).normalize();
      } else if (spread <= 1) {
        _dir.y = Math.abs(_dir.y);
      }
      const sp = speed[0] + Math.random() * (speed[1] - speed[0]);
      this.pos[i * 3] = position.x + (Math.random() - 0.5) * jitter;
      this.pos[i * 3 + 1] = position.y + (Math.random() - 0.5) * jitter;
      this.pos[i * 3 + 2] = position.z + (Math.random() - 0.5) * jitter;
      this.vel[i * 3] = _dir.x * sp;
      this.vel[i * 3 + 1] = _dir.y * sp;
      this.vel[i * 3 + 2] = _dir.z * sp;
      _color.setHex(colors[(Math.random() * colors.length) | 0]);
      this.col[i * 3] = _color.r;
      this.col[i * 3 + 1] = _color.g;
      this.col[i * 3 + 2] = _color.b;
      this.maxLife[i] = this.life[i] = life[0] + Math.random() * (life[1] - life[0]);
      this.baseSize[i] = size[0] + Math.random() * (size[1] - size[0]);
      this.gravity[i] = gravity;
      this.drag[i] = drag;
      this.flutter[i] = flutter * (0.5 + Math.random());
    }
    this.alive = this.max;
  }

  update(dt) {
    if (!this.alive) return;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; }
        continue;
      }
      alive++;
      this.life[i] -= dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      const j = i * 3;
      this.vel[j] *= k;
      this.vel[j + 1] = this.vel[j + 1] * k - this.gravity[i] * dt;
      this.vel[j + 2] *= k;
      if (this.flutter[i]) {
        this.vel[j] += Math.sin(this.life[i] * 9 + i) * this.flutter[i] * dt;
        this.vel[j + 2] += Math.cos(this.life[i] * 7 + i) * this.flutter[i] * dt;
      }
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] = Math.max(0.5, this.pos[j + 1] + this.vel[j + 1] * dt);
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = Math.min(1, t * 2.5);
      this.size[i] = this.baseSize[i] * (0.6 + 0.4 * t);
    }
    this.alive = alive;
    const a = this.geometry.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
  }
}
