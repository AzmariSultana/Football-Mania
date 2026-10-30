// Installable app support: service worker registration and the "Install app" button.

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export function setupPwa() {
  registerServiceWorker();
  setupInstallButton();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Skip on localhost so edits show up immediately while developing; add ?sw to test it locally.
  const local = LOCAL_HOSTS.includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has('sw')) return;
  const register = () => navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.warn('Service worker registration failed:', err);
  });
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function isInstalled() {
  return ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches)
    || navigator.standalone === true;
}

function setupInstallButton() {
  const button = document.getElementById('btn-install');
  const iosHint = document.getElementById('install-hint');
  if (!button || isInstalled()) return;

  // Chrome, Edge and Android offer a native install prompt; show our button when it's available.
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    button.classList.remove('hidden');
  });
  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    button.blur();
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    button.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    button.classList.add('hidden');
    iosHint?.classList.add('hidden');
  });

  // iOS Safari has no install prompt: explain Add to Home Screen instead.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) iosHint?.classList.remove('hidden');
}
