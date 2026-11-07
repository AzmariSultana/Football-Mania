import * as THREE from 'three';
import { Game } from './game.js';
import { setupPwa } from './pwa.js';
import { PostFX } from './fx/post.js';
import { PowerManager } from './power.js';
import { runSplash } from './splash.js';

// Replaces python main(): GLUT window + idle loop -> WebGL canvas + requestAnimationFrame.

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

// The 3D boards, flags and goal labels draw text onto canvases once, at build time, so
// the brand font must be ready first. Capped, so a slow or blocked font CDN never holds
// up the game (the splash is still playing meanwhile).
function brandFontsReady(timeout = 1500) {
  if (!document.fonts?.load) return Promise.resolve();
  const load = Promise.all([
    document.fonts.load('800 42px "Big Shoulders Display"'),
    document.fonts.load('900 42px "Big Shoulders Display"'),
  ]).catch(() => {});
  return Promise.race([load, new Promise((ok) => setTimeout(ok, timeout))]);
}

async function start() {
  const canvas = document.getElementById('scene');
  let game = null;
  const splash = runSplash({
    // Skipping is a user gesture: the one moment browsers let audio start. Play a short
    // rising chord and a crowd swell, then the menu music fades in on its own.
    onGesture: () => {
      if (!game) return;
      game.audio.unlock();
      game.audio.sting();
      game.audio.setCrowdLevel(0.5);
      setTimeout(() => game?.audio.setCrowdLevel(0), 1400);
    },
    onDone: () => {
      if (!game) return;
      game.introSweep();
      game.ui.animateMenuStats();
    },
  });
  if (!webglAvailable()) {
    splash.finish();
    document.getElementById('fatal-msg').textContent =
      'Your browser or device does not support WebGL 2. Try a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.';
    document.getElementById('fatal').classList.remove('hidden');
    document.getElementById('screen-menu').classList.add('hidden');
    return;
  }

  await brandFontsReady();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 5, 14000);
  const post = new PostFX(renderer, scene, camera);
  game = new Game(renderer, scene, camera);
  game.onGraphics = (q) => {
    post.setQuality(q);
    renderer.shadowMap.type = q === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  };
  game.applySettings('graphics');

  // Size the drawing buffer to the canvas as displayed. During rotation, split screen or
  // while hidden the browser can briefly report 0 (aspect → Infinity/NaN → an all-black
  // frame), so those readings are ignored and the last good size is kept.
  const resize = () => {
    const w = Math.round(canvas.clientWidth || window.innerWidth);
    const h = Math.round(canvas.clientHeight || window.innerHeight);
    if (!(w >= 2 && h >= 2)) return;
    renderer.setSize(w, h, false);
    post.setPixelRatio(renderer.getPixelRatio());
    post.setSize(w, h);
    camera.aspect = w / h;
    // Keep the goal in frame on narrow (portrait) screens.
    camera.fov = w / h < 1 ? 70 : 55;
    camera.updateProjectionMatrix();
    game.onResize(renderer.domElement.height, camera.fov);
  };
  // Mobile browsers report rotation and toolbar changes late and in several steps:
  // resize now, next frame, and once more after the layout has settled.
  let settle = 0;
  const scheduleResize = () => {
    resize();
    requestAnimationFrame(resize);
    clearTimeout(settle);
    settle = setTimeout(resize, 300);
  };
  window.addEventListener('resize', scheduleResize);
  window.visualViewport?.addEventListener('resize', scheduleResize);
  screen.orientation?.addEventListener?.('change', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);
  document.addEventListener('fullscreenchange', scheduleResize);
  resize();

  // Adaptive resolution: drop the pixel ratio when frames get slow, restore it when there
  // is headroom. Only measured during uncapped gameplay (capped frames are slow on purpose).
  const deviceRatio = Math.min(window.devicePixelRatio, 2);
  let maxRatio = deviceRatio;
  let ratio = maxRatio;
  let frameTimes = 0, frameCount = 0;
  const setRatio = (r) => {
    if (r === ratio) return;
    ratio = r;
    renderer.setPixelRatio(ratio);
    resize();
  };
  const adapt = (dt) => {
    frameTimes += dt;
    frameCount++;
    if (frameCount < 90) return;
    const avg = frameTimes / frameCount;
    frameTimes = frameCount = 0;
    if (avg > 1 / 40 && ratio > 1) setRatio(Math.max(1, ratio - 0.25));
    else if (avg < 1 / 75 && ratio < maxRatio) setRatio(Math.min(maxRatio, ratio + 0.25));
  };

  const focus = new THREE.Vector3();
  const power = new PowerManager({
    renderer,
    audio: game.audio,
    mode: () => game.frameMode,
    frame: (dt, mode, cap) => {
      if (mode === 'play' && !cap) adapt(dt);
      else frameTimes = frameCount = 0;
      game.update(dt);
      post.setMenu(game.state === 'menu');
      post.setFocus(camera.position.distanceTo(focus.copy(game.focusPoint).setY(60)));
      post.render(dt);
    },
    // Battery saver: fewer pixels and no ambient occlusion; frame caps tighten in power.js.
    onSaverChange: (saver) => {
      post.setPowerSave(saver);
      // CSS side: no frosted-glass blur (re-computed over the canvas every frame) and no decorative loops.
      document.documentElement.classList.toggle('power-saver', saver);
      maxRatio = saver ? Math.min(deviceRatio, 1.25) : deviceRatio;
      setRatio(saver ? Math.min(ratio, maxRatio) : maxRatio); // full resolution back immediately
    },
  });
  game.onPower = (pref) => power.setPreference(pref);
  game.applySettings('power');
  power.start();
  // Dissolve the splash only after the scene has really been drawn (two frames: the first
  // rAF can run before the first render has been composited).
  requestAnimationFrame(() => requestAnimationFrame(() => splash.ready()));

  // WebGL context loss (GPU reset, memory pressure, app backgrounded on mobile). Without
  // handling, the canvas just stays black. Three.js restores its own state when the
  // browser gives the context back; around that we pause the match, hold the loop and
  // explain what's happening, offering a reload if the context doesn't come back.
  const notice = document.getElementById('gfx-notice');
  let reloadTimer = 0;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); // allow the browser to restore it
    console.warn('[render] WebGL context lost; pausing until it is restored');
    game.autoPause();
    power.setBlocked(true);
    notice.classList.remove('hidden', 'failed');
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => notice.classList.add('failed'), 5000);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.info('[render] WebGL context restored');
    clearTimeout(reloadTimer);
    notice.classList.add('hidden');
    resize();
    power.setBlocked(false);
  });
  document.getElementById('gfx-reload').addEventListener('click', () => location.reload());

  window.footballMania = game; // handy for debugging from the console
  game.powerManager = power; // (not game.power: that's the shot power, 0..1)
}

setupPwa();
start();
