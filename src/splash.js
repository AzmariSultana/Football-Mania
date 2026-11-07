// Opening splash controller. The animation itself is CSS (index.html + css/splash.css)
// and starts at first paint; this decides when it dissolves:
//   - not before the intro has played (INTRO_MS), unless the player skips,
//   - not before the game has drawn its first frame (so there is never a blank frame),
//   - immediately on any key, click or tap once the game is ready.

const INTRO_MS = 2900;

/**
 * @param {object} o
 * @param {() => void} [o.onGesture]  runs inside the skip gesture (audio may start here)
 * @param {() => void} [o.onDone]     the splash has started dissolving
 */
export function runSplash({ onGesture, onDone } = {}) {
  const el = document.getElementById('splash');
  const root = document.documentElement;
  let ready = false, done = false, skipRequested = !!window.__splashSkip, timer = 0;

  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    window.removeEventListener('keydown', onKey, true);
    el?.removeEventListener('pointerdown', onPointer);
    el?.classList.add('out');
    root.classList.remove('booting'); // let the menu's entrance play as the splash fades
    onDone?.();
    setTimeout(() => el?.remove(), 900);
  };

  const skip = () => {
    skipRequested = true;
    onGesture?.();
    if (ready) finish();
  };
  // Capture phase: the skip key must not also act on the menu underneath (Enter = Play).
  const onKey = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    skip();
  };
  const onPointer = (e) => {
    e.preventDefault();
    skip();
  };

  if (!el) {
    root.classList.remove('booting');
    return { ready() { onDone?.(); }, finish() {} };
  }
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('pointerdown', onPointer);
  // Slow connection: once the intro is over, switch the bar to a "still loading" shimmer.
  const waitTimer = setTimeout(() => { if (!ready) el.classList.add('waiting'); }, INTRO_MS);

  return {
    /** The game has drawn its first frame. */
    ready() {
      if (ready) return;
      ready = true;
      clearTimeout(waitTimer);
      el.classList.remove('waiting');
      if (skipRequested) { finish(); return; }
      timer = setTimeout(finish, Math.max(0, INTRO_MS - performance.now()));
    },
    /** Dissolve now (e.g. a fatal error screen needs to be visible). */
    finish,
  };
}
