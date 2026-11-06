// Service worker: makes the game installable and playable offline.
//
// - Precaches the app shell and Three.js on install.
// - The game's own pages, styles and scripts: network first (so a deploy's files always
//   load together), falling back to the cache offline.
// - Versioned third-party files (Three.js, fonts): served from the cache, refreshed in the background.
//
// The deploy workflow replaces __BUILD__ with the commit SHA, so each deploy gets
// a fresh cache and old ones are deleted. Every file in src/ and css/ must be
// listed in ASSETS (the workflow checks this).

const VERSION = '__BUILD__';
const CACHE = `football-mania-${VERSION}`;
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/features.css',
  './css/menu.css',
  './css/hub.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './src/main.js',
  './src/pwa.js',
  './src/game.js',
  './src/config.js',
  './src/physics.js',
  './src/camera.js',
  './src/input.js',
  './src/ui.js',
  './src/audio.js',
  './src/rng.js',
  './src/progress.js',
  './src/settings.js',
  './src/cosmetics.js',
  './src/power.js',
  './src/trophies.js',
  './src/features/bosses.js',
  './src/features/powerups.js',
  './src/features/replay.js',
  './src/fx/particles.js',
  './src/fx/post.js',
  './src/world/stadium.js',
  './src/world/goal.js',
  './src/world/collectibles.js',
  './src/entities/ball.js',
  './src/entities/characters.js',
  './src/entities/keeper.js',
  './src/entities/kicker.js',
  './src/entities/wall.js',
  `${THREE}/build/three.module.js`,
  `${THREE}/examples/jsm/geometries/RoundedBoxGeometry.js`,
  `${THREE}/examples/jsm/postprocessing/EffectComposer.js`,
  `${THREE}/examples/jsm/postprocessing/RenderPass.js`,
  `${THREE}/examples/jsm/postprocessing/ShaderPass.js`,
  `${THREE}/examples/jsm/postprocessing/MaskPass.js`,
  `${THREE}/examples/jsm/postprocessing/Pass.js`,
  `${THREE}/examples/jsm/postprocessing/UnrealBloomPass.js`,
  `${THREE}/examples/jsm/postprocessing/BokehPass.js`,
  `${THREE}/examples/jsm/postprocessing/GTAOPass.js`,
  `${THREE}/examples/jsm/postprocessing/OutputPass.js`,
  `${THREE}/examples/jsm/shaders/CopyShader.js`,
  `${THREE}/examples/jsm/shaders/LuminosityHighPassShader.js`,
  `${THREE}/examples/jsm/shaders/BokehShader.js`,
  `${THREE}/examples/jsm/shaders/GTAOShader.js`,
  `${THREE}/examples/jsm/shaders/PoissonDenoiseShader.js`,
  `${THREE}/examples/jsm/shaders/OutputShader.js`,
  `${THREE}/examples/jsm/math/SimplexNoise.js`,
  `${THREE}/examples/jsm/utils/BufferGeometryUtils.js`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('football-mania-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(response) {
  // Opaque responses (e.g. Google Fonts without CORS) are fine to keep too.
  return response && (response.ok || response.type === 'opaque');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // The game's own files: network first, so the page, styles and scripts always come
  // from the same deploy (serving cached CSS with a fresh page showed old layouts).
  // The cache is only the offline fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cacheable(response)) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error())),
    );
    return;
  }

  // Versioned third-party files (Three.js, fonts): stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (cacheable(response)) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached || Response.error());
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    }),
  );
});
