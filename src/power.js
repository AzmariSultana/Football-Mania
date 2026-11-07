// Lifecycle and power management: runs the render loop at the frame rate each state
// actually needs, stops it entirely while the page is hidden, suspends audio while the
// game is inactive, and switches to a battery-saver profile when the battery is low.

// Frame caps per state (0 = uncapped, i.e. the display refresh rate).
const CAPS = {
  normal: { play: 0, paused: 12, menu: 30, overlay: 24 },
  saver: { play: 60, paused: 8, menu: 20, overlay: 15 },
};
// Gameplay is capped at 60 on touch devices and on battery: 120 Hz screens otherwise
// double the GPU work for a free-kick game that doesn't benefit from it.
const PLAY_CAP_ON_BATTERY = 60;

export class PowerManager {
  /**
   * @param {object} o
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {(dt: number, mode: string) => void} o.frame   update + render one frame
   * @param {() => string} o.mode                           current frame mode
   * @param {object} o.audio                                AudioFX (suspend/resume)
   * @param {(saver: boolean) => void} o.onSaverChange
   */
  constructor({ renderer, frame, mode, audio, onSaverChange }) {
    this.renderer = renderer;
    this.frame = frame;
    this.mode = mode;
    this.audio = audio;
    this.onSaverChange = onSaverChange;
    this.preference = 'auto';
    this.saver = false;
    this.onBattery = false;
    this.batteryLow = false;
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.running = false;
    this.last = 0;
    this.tick = (now) => this.onAnimationFrame(now);

    this.bindLifecycle();
    this.watchBattery();
  }

  /** Hold the loop (e.g. while the WebGL context is lost); releasing restarts it if visible. */
  setBlocked(blocked) {
    this.blocked = blocked;
    if (blocked) this.stop();
    else if (document.visibilityState !== 'hidden') this.start();
  }

  start() {
    if (this.running || this.blocked) return;
    this.running = true;
    this.last = performance.now(); // no time jump after a pause
    this.renderer.setAnimationLoop(this.tick);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  onAnimationFrame(now) {
    const mode = this.mode();
    const cap = this.capFor(mode);
    // The first rAF timestamp after start() can be earlier than the performance.now()
    // taken there; never hand the game a negative time step.
    const elapsed = Math.max(0, (now - this.last) / 1000);
    // Skip this display refresh when the state doesn't need a new frame yet
    // (small tolerance so a 60 Hz cap on a 60 Hz screen never drops frames).
    if (cap && elapsed < 1 / cap - 0.004) return;
    this.last = now;
    this.frame(Math.min(elapsed, mode === 'play' ? 0.05 : 0.1), mode, cap);
  }

  capFor(mode) {
    const caps = this.saver ? CAPS.saver : CAPS.normal;
    if (mode === 'play' && !caps.play && (this.touch || this.onBattery)) return PLAY_CAP_ON_BATTERY;
    return caps[mode] ?? 0;
  }

  // ------------------------------------------------------------ lifecycle
  bindLifecycle() {
    const sync = () => {
      if (document.visibilityState === 'hidden') {
        this.stop();
        this.audio.suspend();
      } else {
        this.start();
        if (document.hasFocus()) this.audio.resume();
      }
    };
    document.addEventListener('visibilitychange', sync);
    // Backgrounded / bfcache / frozen pages (mobile): same as hidden.
    window.addEventListener('pagehide', () => { this.stop(); this.audio.suspend(); });
    window.addEventListener('pageshow', sync);
    document.addEventListener('freeze', () => { this.stop(); this.audio.suspend(); });
    document.addEventListener('resume', sync);
    // Another window took focus: the game auto-pauses (game.js) and goes quiet; it keeps
    // drawing the paused scene at a low rate since it's still visible.
    window.addEventListener('blur', () => this.audio.suspend());
    window.addEventListener('focus', () => { if (!document.hidden) this.audio.resume(); });
  }

  // ------------------------------------------------------------ battery saver
  watchBattery() {
    if (!navigator.getBattery) return;
    navigator.getBattery().then((battery) => {
      const update = () => {
        this.onBattery = !battery.charging;
        this.batteryLow = !battery.charging && battery.level <= 0.3;
        this.applySaver();
      };
      battery.addEventListener('chargingchange', update);
      battery.addEventListener('levelchange', update);
      update();
    }).catch(() => {});
  }

  /** @param {'auto'|'on'|'off'} preference */
  setPreference(preference) {
    this.preference = preference;
    this.applySaver();
  }

  applySaver() {
    const saver = this.preference === 'on' || (this.preference === 'auto' && this.batteryLow);
    if (saver === this.saver && this.applied) return;
    this.saver = saver;
    this.applied = true;
    this.onSaverChange?.(saver);
  }
}
