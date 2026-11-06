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

// LED advertising boards. Each texture stacks three "faces" vertically; the board
// rolls between them like a tri-vision sign while the text scrolls sideways.
const BOARD_THEMES = [
  { bg: '#0b1630', fg: '#c6ff3d', accent: '#ffffff' },
  { bg: '#c6ff3d', fg: '#0b1630', accent: '#0b1630' },
  { bg: '#101318', fg: '#f2c14e', accent: '#ffffff' },
];
const BOARD_WORDS = [
  ['FOOTBALL MANIA', 'MASTER EVERY CURVE'],
  ['TOP BINS = 9 PTS', 'FREE KICK CHALLENGE'],
  ['DAILY CHALLENGE', 'FOOTBALL MANIA'],
];
const BOARD_FACE_H = 64;

function boardTexture(offset) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = BOARD_FACE_H * 4; // 3 faces + a copy of the first, so the roll wraps cleanly
  const ctx = c.getContext('2d');
  for (let f = 0; f < 4; f++) {
    const theme = BOARD_THEMES[(f + offset) % 3];
    const words = BOARD_WORDS[(f + offset) % 3];
    const y0 = f * BOARD_FACE_H;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, y0, c.width, BOARD_FACE_H);
    // Subtle LED scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = y0; y < y0 + BOARD_FACE_H; y += 3) ctx.fillRect(0, y, c.width, 1);
    ctx.font = '700 40px "Bebas Neue", Impact, sans-serif';
    ctx.textBaseline = 'middle';
    let x = 24;
    for (let i = 0; x < c.width; i++) {
      const t = words[i % words.length];
      ctx.fillStyle = theme.fg;
      ctx.fillText(t, x, y0 + 34);
      x += ctx.measureText(t).width + 26;
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.moveTo(x, y0 + 22); ctx.lineTo(x + 12, y0 + 32); ctx.lineTo(x, y0 + 42);
      ctx.fill();
      x += 40;
    }
  }
  // Canvas row 0 is the top; flip so face 0 sits at uv.y = 0.75..1.
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.y = 0.25;
  return tex;
}

function flagTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 80;
  const ctx = c.getContext('2d');
  const designs = [
    ['#0b1630', '#c6ff3d'],
    ['#c6ff3d', '#0b1630'],
    ['#f5f7fb', '#f2c14e'],
    ['#101318', '#f5f7fb'],
  ];
  const [bg, fg] = designs[kind % designs.length];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 80);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, 56); ctx.lineTo(128, 18); ctx.lineTo(128, 34); ctx.lineTo(0, 72);
  ctx.fill();
  ctx.font = '700 30px "Bebas Neue", Impact, sans-serif';
  ctx.fillText('FM', 12, 36);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hazeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 60 + Math.random() * 136, y = 70 + Math.random() * 116, r = 40 + Math.random() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(c);
}

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Light shaft: an open cone, brightest at the lamp and towards its axis, faded at the edges.
const BEAM_VERT = /* glsl */`
  varying float vH;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vH = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;
const BEAM_FRAG = /* glsl */`
  uniform vec3 color;
  uniform float intensity;
  varying float vH;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float edge = pow(facing, 2.2);
    float along = pow(vH, 1.6) * smoothstep(0.0, 0.25, vH);
    gl_FragColor = vec4(color * intensity * edge * along, 1.0);
  }`;

function beamMaterial(color, intensity = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, intensity: { value: intensity } },
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
}

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

/** Stretch a unit cone (apex up) from `from` to `to`. */
function aimBeam(mesh, from, to, radius) {
  _dir.subVectors(from, to);
  const len = _dir.length();
  mesh.position.addVectors(from, to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(_up, _dir.normalize());
  mesh.scale.set(radius, len, radius);
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
    this.menuMix = 1;     // 1 = cinematic evening look of the main menu
    this.wave = 1;        // strength of the Mexican wave (menu only)
    this.motion = true;

    this.buildLights();
    this.buildSky();
    this.buildPitch(renderer.capabilities.getMaxAnisotropy());
    this.buildBoards();
    this.buildStands();
    this.buildFloodlights();
    this.buildFlags();
    this.buildAtmosphere();
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
    this.boards = [];
    const make = (length) => {
      const i = this.boards.length;
      const tex = boardTexture(i);
      tex.repeat.x = length / 1100;
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.5,
      });
      this.boardMats.push(mat);
      this.boards.push({ tex, face: 0, roll: 0, speed: (i % 2 ? -1 : 1) * 0.012 });
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
          seats.push({
            x: p.x, y: h, z: p.z, phase: Math.random() * Math.PI * 2, speed: 8 + Math.random() * 5,
            angle: Math.atan2(p.x, p.z - 350),
          });
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
    // Home end in lime and white, away fans in navy and gold, a few neutrals.
    const home = [0xc6ff3d, 0xa8e02a, 0xf5f7fb, 0xdfe6ee, 0x2f3a4a];
    const away = [0x1b2b55, 0x24407a, 0xf2c14e, 0xf5f7fb, 0x2f3a4a];
    for (let i = 0; i < count; i++) {
      const s = seats[i];
      const pal = s.x > 120 ? away : home;
      color.setHex(Math.random() < 0.82 ? pal[(Math.random() * pal.length) | 0] : 0x8a6d5a);
      color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
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
    this.beamMat = beamMaterial(0xfff3d6);
    const cone = new THREE.ConeGeometry(1, 1, 40, 1, true);
    for (const [x, z] of towers) {
      // Volumetric-looking shaft from each floodlight down onto the pitch.
      const beam = new THREE.Mesh(cone, this.beamMat);
      aimBeam(beam, new THREE.Vector3(x * 0.97, 770, z * 0.97), new THREE.Vector3(x * 0.25, 0, 300 + z * 0.15), 360);
      beam.renderOrder = 2;
      this.scene.add(beam);
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

  // Flags on the roofline of every stand; the cloth ripples in a vertex shader.
  buildFlags() {
    this.flagUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
    const geo = new THREE.PlaneGeometry(72, 44, 12, 6);
    geo.translate(36, 0, 0); // hoist (pole side) at x = 0
    const mats = [0, 1, 2, 3].map((k) => {
      const m = new THREE.MeshStandardMaterial({
        map: flagTexture(k), side: THREE.DoubleSide, roughness: 0.85,
        emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0,
      });
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = this.flagUniforms.uTime;
        shader.uniforms.uWind = this.flagUniforms.uWind;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float ph = modelMatrix[3].x * 0.011 + modelMatrix[3].z * 0.017;
            float k = position.x / 72.0;
            float w = sin(position.x * 0.11 - uTime * 5.5 + ph) + 0.4 * sin(position.x * 0.23 - uTime * 8.3 + position.y * 0.08);
            transformed.z += w * 7.0 * k * uWind;
            transformed.y -= k * k * 5.0 * (1.2 - uWind * 0.6);`);
      };
      return m;
    });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, metalness: 0.7, roughness: 0.35 });
    const poleGeo = new THREE.CylinderGeometry(1.6, 1.6, 120, 6);
    const top = 7 * 24 + 120; // stand back wall height
    let n = 0;
    const add = (x, z) => {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, top + 60, z);
      this.scene.add(pole);
      const flag = new THREE.Mesh(geo, mats[n++ % mats.length]);
      flag.position.set(x, top + 96, z);
      flag.rotation.y = -0.5; // blowing towards the far side
      this.scene.add(flag);
    };
    const backZ = BOARD_BACK_Z - 50 - 34 * 7 - 10;
    for (let x = -900; x <= 900; x += 300) add(x, backZ);
    const sideX = GRID_LENGTH + 50 + 34 * 7 + 10;
    for (let z = 0; z <= 900; z += 300) {
      add(-sideX, z);
      add(sideX, z);
    }
  }

  // Haze drifting over the stands, sweeping searchlights and the pools they cast.
  buildAtmosphere() {
    const hazeMat = new THREE.SpriteMaterial({
      map: hazeTexture(), color: 0x9fb4d8, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.hazeMat = hazeMat;
    this.haze = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(hazeMat);
      const a = (i / 14) * Math.PI * 1.4 - Math.PI * 1.2;
      const r = 900 + Math.random() * 400;
      s.position.set(Math.cos(a) * r, 120 + Math.random() * 160, 300 + Math.sin(a) * r * 0.75);
      const sc = 700 + Math.random() * 500;
      s.scale.set(sc, sc * 0.45, 1);
      s.userData = { base: s.position.clone(), phase: Math.random() * 10 };
      this.scene.add(s);
      this.haze.push(s);
    }

    const cone = new THREE.ConeGeometry(1, 1, 32, 1, true);
    const poolMat = new THREE.MeshBasicMaterial({
      map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
      color: 0xe8f6ff, fog: false, polygonOffset: true, polygonOffsetFactor: -4,
    });
    this.poolMat = poolMat;
    this.sweeps = [];
    const sources = [[-620, 520, -440], [620, 520, -440], [-1220, 520, 700], [1220, 520, 700]];
    const tints = [0xe8f6ff, 0xe8f6ff, 0xe7ffc4, 0xfff0c8];
    sources.forEach(([x, y, z], i) => {
      const mat = beamMaterial(tints[i]);
      const beam = new THREE.Mesh(cone, mat);
      beam.renderOrder = 2;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 32), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 1.5;
      this.scene.add(beam, pool);
      this.sweeps.push({ beam, pool, mat, from: new THREE.Vector3(x, y, z), to: new THREE.Vector3(), phase: i * 1.7 });
    });
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
    // Mexican wave: a crest travelling round the ground.
    const crest = ((this.time * 0.55) % (Math.PI * 2)) - Math.PI;
    const wave = this.wave;
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      let jump = ex * Math.max(0, Math.sin(this.time * s.speed + s.phase)) * 14;
      if (wave > 0.01) {
        let d = Math.abs(s.angle - crest);
        if (d > Math.PI) d = Math.PI * 2 - d;
        jump += wave * Math.exp(-d * d * 18) * 16;
      }
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
    const cycleNight = tri * tri * (3 - 2 * tri);         // smoothstep
    // The menu is set in the evening, under the floodlights.
    const night = lerp(cycleNight, 0.8, this.menuMix);
    this.day = 1 - night;
    this.night = night;

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
    this.lampMat.emissiveIntensity = 0.1 + night * 4;
    for (const m of this.boardMats) m.emissiveIntensity = 0.3 + night * 0.9;
    this.beamMat.uniforms.intensity.value = Math.max(0, night - 0.25) * 0.16;
    this.hazeMat.opacity = 0.05 + night * 0.18 * (0.5 + this.menuMix * 0.5);
    this.scene.fog.near = lerp(3200, 1800, this.menuMix);
    this.scene.fog.far = lerp(7000, 5200, this.menuMix);
  }

  updateAmbient(dt) {
    const t = this.time;
    const mm = this.menuMix;

    // Flags
    this.flagUniforms.uTime.value = t;
    this.flagUniforms.uWind.value = 0.85 + Math.sin(t * 0.37) * 0.15 + this.windBoost;

    // Boards: sideways scroll, and every few seconds roll to the next face.
    for (let i = 0; i < this.boards.length; i++) {
      const b = this.boards[i];
      b.tex.offset.x = (b.tex.offset.x + dt * b.speed) % 1;
      const cycle = 6;
      const local = (t + i * 0.45) % cycle;
      const face = Math.floor((t + i * 0.45) / cycle) % 3;
      const k = local < 0.6 ? 1 - Math.pow(1 - local / 0.6, 3) : 1; // ease-out roll
      const roll = (face + k) % 3;
      b.tex.offset.y = 0.75 - roll * 0.25;
    }

    // Haze drifts slowly sideways and breathes.
    for (const h of this.haze) {
      const p = h.userData.phase;
      h.position.x = h.userData.base.x + Math.sin(t * 0.05 + p) * 120;
      h.position.y = h.userData.base.y + Math.sin(t * 0.13 + p) * 12;
    }

    // Searchlight sweeps (menu only).
    const sweep = mm * Math.max(0, this.night - 0.3);
    this.poolMat.opacity = sweep * 0.22;
    for (const s of this.sweeps) {
      const a = t * 0.22 + s.phase;
      s.to.set(Math.sin(a) * 650, 0, 380 + Math.sin(a * 1.31 + s.phase) * 380);
      aimBeam(s.beam, s.from, s.to, 110);
      s.mat.uniforms.intensity.value = sweep * 0.2;
      s.beam.visible = s.pool.visible = sweep > 0.01;
      s.pool.position.x = s.to.x;
      s.pool.position.z = s.to.z;
      s.pool.scale.setScalar(150);
    }
  }

  /**
   * @param {boolean} running  a game is in progress (day/night cycle runs)
   * @param {boolean} menu     main menu is up (cinematic evening look)
   */
  update(dt, running, menu = false) {
    this.time += dt;
    this.crowdAccum = (this.crowdAccum ?? 0) + dt;
    const target = menu ? 1 : 0;
    this.menuMix += (target - this.menuMix) * (1 - Math.exp(-dt * 1.6));
    if (Math.abs(target - this.menuMix) < 0.002) this.menuMix = target;
    this.wave = this.motion ? this.menuMix : 0;
    this.windBoost = this.windBoost ?? 0;
    this.updateDayNight(dt, running);
    this.updateAmbient(dt);
    // ~1000 fans: only animate every frame while they are celebrating (or doing
    // the wave), otherwise a gentle sway at ~20 fps is indistinguishable and cheaper.
    if (this.excitement > 0.01 || this.wave > 0.01 || this.crowdAccum > 0.05) {
      this.updateCrowd(this.crowdAccum);
      this.crowdAccum = 0;
    }
  }

  get isNight() {
    return this.day < 0.35;
  }
}
