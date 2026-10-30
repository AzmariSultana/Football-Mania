import * as THREE from 'three';
import { GRID_LENGTH, FIELD_BACK, FIELD_FRONT, GOAL, RULES, lerp } from '../config.js';

const _crowdMatrix = new THREE.Matrix4();
const FIELD_W = GRID_LENGTH * 2;
const FIELD_D = FIELD_BACK + FIELD_FRONT;
const BOARD_BACK_Z = -120;  // python draw_borders back_y = 120
const BOARD_HEIGHT = 60;

// ---------------------------------------------------------------- pitch texture
// python draw_field: base quad plus penalty box, goal area, spot, arc, centre circle and line.
function pitchTexture(maxAnisotropy) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = Math.round(2048 * (FIELD_D / FIELD_W));
  const k = canvas.width / FIELD_W;
  const ctx = canvas.getContext('2d');
  const X = (x) => (x + GRID_LENGTH) * k;
  const Z = (z) => (z + FIELD_BACK) * k;

  // Mowing stripes
  const stripe = 75;
  for (let z = -FIELD_BACK, i = 0; z < FIELD_FRONT; z += stripe, i++) {
    ctx.fillStyle = i % 2 ? '#3f8f3c' : '#4a9e45';
    ctx.fillRect(0, Z(z), canvas.width, stripe * k + 1);
  }
  // Grain
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n * 0.6;
    img.data[i + 1] += n;
    img.data[i + 2] += n * 0.4;
  }
  ctx.putImageData(img, 0, 0);

  const base = GOAL.width; // lines follow the original 400 wide goal
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 4 * k;
  const rect = (x0, z0, x1, z1) => ctx.strokeRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));

  ctx.beginPath();
  ctx.moveTo(X(-GRID_LENGTH + 20), Z(0));
  ctx.lineTo(X(GRID_LENGTH - 20), Z(0));
  ctx.stroke();
  rect(-GRID_LENGTH + 20, -FIELD_BACK + 20, GRID_LENGTH - 20, FIELD_FRONT - 20);

  const boxW = base * 1.5, boxD = base * 0.7;
  rect(-boxW / 2, 0, boxW / 2, boxD);
  const areaW = base * 0.8, areaD = base * 0.25;
  rect(-areaW / 2, 0, areaW / 2, areaD);

  const spot = base * 0.5;
  ctx.beginPath();
  ctx.arc(X(0), Z(spot), 4 * k, 0, Math.PI * 2);
  ctx.fill();

  // Penalty arc: only the part outside the box
  const arcR = base * 0.4;
  const a = Math.acos((boxD - spot) / arcR);
  ctx.beginPath();
  ctx.arc(X(0), Z(spot), arcR * k, Math.PI / 2 - a, Math.PI / 2 + a);
  ctx.stroke();

  const circleZ = spot * 2.5;
  ctx.beginPath();
  ctx.arc(X(0), Z(circleZ), arcR * k, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(X(-GRID_LENGTH + 20), Z(circleZ));
  ctx.lineTo(X(GRID_LENGTH - 20), Z(circleZ));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(0), Z(circleZ), 5 * k, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// python generate_border_colors: random colour per board
function boardTexture(color) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 64;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(color);
  ctx.fillStyle = `#${col.getHexString()}`;
  ctx.fillRect(0, 0, c.width, c.height);
  const light = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b > 0.55;
  ctx.fillStyle = light ? '#101318' : '#ffffff';
  ctx.font = '700 40px "Bebas Neue", Impact, sans-serif';
  ctx.textBaseline = 'middle';
  const words = ['FOOTBALL MANIA', 'FREE KICK CHALLENGE', 'TOP BINS = 9 PTS'];
  let x = 20;
  for (let i = 0; x < c.width; i++) {
    const t = words[i % words.length];
    ctx.fillText(t, x, 34);
    x += ctx.measureText(t).width + 60;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,250,230,0.55)');
  g.addColorStop(1, 'rgba(255,250,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const SKY_FRAG = /* glsl */`
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 groundColor;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 col = h > 0.0
      ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(horizonColor, groundColor, clamp(-h * 4.0, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const DAY = {
  top: new THREE.Color(0x2f72d0), horizon: new THREE.Color(0xbfe0f7), ground: new THREE.Color(0x3c5a3a),
  key: new THREE.Color(0xfff1d8), keyIntensity: 2.6, hemi: 1.15,
  keyPos: new THREE.Vector3(700, 1300, 900),
};
const NIGHT = {
  top: new THREE.Color(0x03060f), horizon: new THREE.Color(0x16223d), ground: new THREE.Color(0x0b1410),
  key: new THREE.Color(0xe4ecff), keyIntensity: 2.1, hemi: 0.3,
  keyPos: new THREE.Vector3(-650, 1400, 1000),
};

export class Stadium {
  constructor(scene, renderer) {
    this.scene = scene;
    this.time = 0;
    this.cycleTime = 0;
    this.excitement = 0;
    this.day = 1;

    this.buildLights();
    this.buildSky();
    this.buildPitch(renderer.capabilities.getMaxAnisotropy());
    this.buildBoards();
    this.buildStands();
    this.buildFloodlights();
  }

  // ------------------------------------------------------------------ lights
  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3a5a2a, DAY.hemi);
    this.scene.add(this.hemi);

    const key = new THREE.DirectionalLight(DAY.key, DAY.keyIntensity);
    key.position.copy(DAY.keyPos);
    key.target.position.set(0, 0, 350);
    key.castShadow = true;
    // Phones and tablets get a lighter shadow map.
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    key.shadow.mapSize.setScalar(touch ? 1024 : 2048);
    const sc = key.shadow.camera;
    sc.left = -1000; sc.right = 1000; sc.top = 900; sc.bottom = -900;
    sc.near = 200; sc.far = 4000;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.6;
    this.scene.add(key, key.target);
    this.key = key;
  }

  buildSky() {
    this.skyUniforms = {
      topColor: { value: DAY.top.clone() },
      horizonColor: { value: DAY.horizon.clone() },
      groundColor: { value: DAY.ground.clone() },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(6000, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
        side: THREE.BackSide, depthWrite: false, fog: false,
      }),
    );
    sky.renderOrder = -1;
    this.scene.add(sky);

    const starCount = 900;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9 + 0.08);
      pos.set([
        Math.sin(phi) * Math.cos(theta) * 5500,
        Math.cos(phi) * 5500,
        Math.sin(phi) * Math.sin(theta) * 5500,
      ], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
    }));
    this.scene.add(this.stars);

    this.scene.fog = new THREE.Fog(DAY.horizon.clone(), 3200, 7000);
  }

  buildPitch(maxAnisotropy) {
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_W, FIELD_D),
      new THREE.MeshStandardMaterial({ map: pitchTexture(maxAnisotropy), roughness: 0.95 }),
    );
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, 0, (FIELD_FRONT - FIELD_BACK) / 2);
    field.receiveShadow = true;
    this.scene.add(field);

    const surround = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000),
      new THREE.MeshStandardMaterial({ color: 0x2f6a2c, roughness: 1 }),
    );
    surround.rotation.x = -Math.PI / 2;
    surround.position.y = -0.5;
    surround.receiveShadow = true;
    this.scene.add(surround);
  }

  buildBoards() {
    this.boardMats = [];
    const make = (length) => {
      const color = new THREE.Color().setHSL(Math.random(), 0.75, 0.45);
      const tex = boardTexture(color);
      tex.repeat.set(length / 1100, 1);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5,
      });
      this.boardMats.push(mat);
      const side = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.8 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(length, BOARD_HEIGHT, 6), [side, side, side, side, mat, side]);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    const sideLen = FIELD_FRONT - BOARD_BACK_Z;
    const left = make(sideLen);
    left.rotation.y = Math.PI / 2;
    left.position.set(-GRID_LENGTH, BOARD_HEIGHT / 2, (FIELD_FRONT + BOARD_BACK_Z) / 2);
    const right = make(sideLen);
    right.rotation.y = -Math.PI / 2;
    right.position.set(GRID_LENGTH, BOARD_HEIGHT / 2, (FIELD_FRONT + BOARD_BACK_Z) / 2);
    const back = make(FIELD_W);
    back.position.set(0, BOARD_HEIGHT / 2, BOARD_BACK_Z);
  }

  // python draw_crowd: rows of randomly coloured fans behind the goal.
  // Now on stepped stands on three sides, drawn with two InstancedMeshes.
  buildStands() {
    const rows = 7, step = 34, rise = 24, spacing = 26;
    const concrete = new THREE.MeshStandardMaterial({ color: 0x4b525c, roughness: 0.95 });
    const seats = [];

    const addStand = (origin, along, out, length) => {
      for (let r = 0; r < rows; r++) {
        const h = (r + 1) * rise;
        const box = new THREE.Mesh(new THREE.BoxGeometry(length, h, step), concrete);
        const centre = origin.clone().addScaledVector(out, step * (r + 0.5));
        box.position.set(centre.x, h / 2, centre.z);
        box.rotation.y = Math.atan2(out.x, out.z);
        box.receiveShadow = true;
        this.scene.add(box);
        const n = Math.floor(length / spacing);
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.07) continue; // a few empty seats
          const p = centre.clone().addScaledVector(along, -length / 2 + spacing * (i + 0.5) + (Math.random() - 0.5) * 6);
          seats.push({ x: p.x, y: h, z: p.z, phase: Math.random() * Math.PI * 2, speed: 8 + Math.random() * 5 });
        }
      }
      const back = new THREE.Mesh(new THREE.BoxGeometry(length, rows * rise + 120, 20), concrete);
      const bp = origin.clone().addScaledVector(out, step * rows + 10);
      back.position.set(bp.x, (rows * rise + 120) / 2, bp.z);
      back.rotation.y = Math.atan2(out.x, out.z);
      this.scene.add(back);
    };

    addStand(new THREE.Vector3(0, 0, BOARD_BACK_Z - 50), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), FIELD_W + 200);
    const sideLen = FIELD_FRONT - BOARD_BACK_Z + 100;
    const sideZ = (FIELD_FRONT + BOARD_BACK_Z) / 2;
    addStand(new THREE.Vector3(-GRID_LENGTH - 50, 0, sideZ), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), sideLen);
    addStand(new THREE.Vector3(GRID_LENGTH + 50, 0, sideZ), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), sideLen);

    const count = seats.length;
    this.seats = seats;
    this.fanBodies = new THREE.InstancedMesh(new THREE.BoxGeometry(15, 20, 10), new THREE.MeshStandardMaterial({ roughness: 0.8 }), count);
    this.fanHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(6, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.7 }), count);
    const color = new THREE.Color();
    const skins = [0xffd2b3, 0xe0ac7e, 0xa86f4c, 0x6b4430, 0xf1c6a5];
    for (let i = 0; i < count; i++) {
      // python crowd colour: random.uniform(0.2, 1) per channel
      color.setRGB(0.2 + Math.random() * 0.8, 0.2 + Math.random() * 0.8, 0.2 + Math.random() * 0.8, THREE.SRGBColorSpace);
      this.fanBodies.setColorAt(i, color);
      color.setHex(skins[i % skins.length]);
      this.fanHeads.setColorAt(i, color);
    }
    this.fanBodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fanHeads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.fanBodies, this.fanHeads);
    this.updateCrowd(0);
  }

  buildFloodlights() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b939e, metalness: 0.6, roughness: 0.4 });
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 0.1 });
    const glowMat = new THREE.SpriteMaterial({
      map: glowTexture(), blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.glowMat = glowMat;
    const towers = [[-1150, -380], [1150, -380], [-1150, 1050], [1150, 1050]];
    for (const [x, z] of towers) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(9, 14, 760, 10), poleMat);
      pole.position.set(x, 380, z);
      pole.castShadow = true;
      this.scene.add(pole);
      const head = new THREE.Group();
      head.position.set(x, 780, z);
      head.lookAt(0, 0, 350);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(170, 110, 14), poleMat);
      head.add(frame);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          const lamp = new THREE.Mesh(new THREE.BoxGeometry(32, 26, 4), this.lampMat);
          lamp.position.set(-60 + i * 40, -32 + j * 32, 8);
          head.add(lamp);
        }
      }
      this.scene.add(head);
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(520, 520, 1);
      glow.position.set(x * 0.98, 780, z * 0.98 + (z < 0 ? 10 : -10));
      this.scene.add(glow);
    }
  }

  /** Make the crowd jump; decays over time. */
  cheer(amount = 1) {
    this.excitement = Math.min(1.5, this.excitement + amount);
  }

  /** Random fan position, used for camera flashes. */
  randomSeat(out) {
    const s = this.seats[(Math.random() * this.seats.length) | 0];
    return out.set(s.x, s.y + 22, s.z);
  }

  updateCrowd(dt) {
    const m = _crowdMatrix;
    const ex = Math.min(1, this.excitement);
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      const jump = ex * Math.max(0, Math.sin(this.time * s.speed + s.phase)) * 14;
      const sway = Math.sin(this.time * 1.5 + s.phase) * 0.8;
      m.makeTranslation(s.x, s.y + 10 + jump + sway, s.z);
      this.fanBodies.setMatrixAt(i, m);
      m.makeTranslation(s.x, s.y + 26 + jump + sway, s.z);
      this.fanHeads.setMatrixAt(i, m);
    }
    this.fanBodies.instanceMatrix.needsUpdate = true;
    this.fanHeads.instanceMatrix.needsUpdate = true;
    this.excitement = Math.max(0, this.excitement - dt * 0.35);
  }

  /** python set_background_color: brightness 1 -> 0.2 over DAY_NIGHT_PERIOD, then back. */
  updateDayNight(dt, running) {
    if (running) this.cycleTime += dt;
    const period = RULES.dayNightPeriod;
    const t = (this.cycleTime % (2 * period)) / period;
    const tri = t < 1 ? t : 2 - t;                       // 0 = day, 1 = night
    const night = tri * tri * (3 - 2 * tri);              // smoothstep
    this.day = 1 - night;

    const u = this.skyUniforms;
    u.topColor.value.lerpColors(DAY.top, NIGHT.top, night);
    u.horizonColor.value.lerpColors(DAY.horizon, NIGHT.horizon, night);
    u.groundColor.value.lerpColors(DAY.ground, NIGHT.ground, night);
    this.scene.fog.color.copy(u.horizonColor.value);

    this.key.color.lerpColors(DAY.key, NIGHT.key, night);
    this.key.intensity = lerp(DAY.keyIntensity, NIGHT.keyIntensity, night);
    this.key.position.lerpVectors(DAY.keyPos, NIGHT.keyPos, night);
    this.hemi.intensity = lerp(DAY.hemi, NIGHT.hemi, night);

    this.stars.material.opacity = Math.max(0, night - 0.3) * 1.4;
    this.glowMat.opacity = night * 0.95;
    this.lampMat.emissiveIntensity = 0.1 + night * 3;
    for (const m of this.boardMats) m.emissiveIntensity = 0.15 + night * 0.7;
  }

  update(dt, running) {
    this.time += dt;
    this.crowdAccum = (this.crowdAccum ?? 0) + dt;
    this.updateDayNight(dt, running);
    // ~1000 fans: only animate every frame while they are celebrating, otherwise
    // a gentle sway at ~20 fps is indistinguishable and much cheaper.
    if (this.excitement > 0.01 || this.crowdAccum > 0.05) {
      this.updateCrowd(this.crowdAccum);
      this.crowdAccum = 0;
    }
  }

  get isNight() {
    return this.day < 0.35;
  }
}
