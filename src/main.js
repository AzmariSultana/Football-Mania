import * as THREE from 'three';
import { Game } from './game.js';
import { setupPwa } from './pwa.js';
import { PostFX } from './fx/post.js';

// Replaces python main(): GLUT window + idle loop -> WebGL canvas + requestAnimationFrame.

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

function start() {
  const canvas = document.getElementById('scene');
  if (!webglAvailable()) {
    document.getElementById('fatal-msg').textContent =
      'Your browser or device does not support WebGL 2. Try a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.';
    document.getElementById('fatal').classList.remove('hidden');
    document.getElementById('screen-menu').classList.add('hidden');
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 5, 14000);
  const post = new PostFX(renderer, scene, camera);
  const game = new Game(renderer, scene, camera);
  game.onGraphics = (q) => {
    post.setQuality(q);
    renderer.shadowMap.type = q === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  };
  game.applySettings('graphics');

  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    post.setPixelRatio(renderer.getPixelRatio());
    post.setSize(w, h);
    camera.aspect = w / h;
    // Keep the goal in frame on narrow (portrait) screens.
    camera.fov = w / h < 1 ? 70 : 55;
    camera.updateProjectionMatrix();
    game.onResize(renderer.domElement.height, camera.fov);
  };
  window.addEventListener('resize', resize);
  resize();

  // Adaptive resolution: drop the pixel ratio when frames get slow, restore it when there is headroom.
  const maxRatio = Math.min(window.devicePixelRatio, 2);
  let ratio = maxRatio;
  let frameTimes = 0, frameCount = 0;
  const adapt = (dt) => {
    frameTimes += dt;
    frameCount++;
    if (frameCount < 90) return;
    const avg = frameTimes / frameCount;
    frameTimes = frameCount = 0;
    let next = ratio;
    if (avg > 1 / 40 && ratio > 1) next = Math.max(1, ratio - 0.25);
    else if (avg < 1 / 75 && ratio < maxRatio) next = Math.min(maxRatio, ratio + 0.25);
    if (next !== ratio && !document.hidden) {
      ratio = next;
      renderer.setPixelRatio(ratio);
      resize();
    }
  };

  const clock = new THREE.Clock();
  const focus = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    adapt(dt);
    game.update(dt);
    post.setMenu(game.state === 'menu');
    post.setFocus(camera.position.distanceTo(focus.copy(game.focusPoint).setY(60)));
    post.render(dt);
  });

  window.footballMania = game; // handy for debugging from the console
}

setupPwa();
start();
