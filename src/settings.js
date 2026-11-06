// Player settings, stored in localStorage. Sound lives in audio.js (its own key).

const KEY = 'footballMania.settings';
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export const SETTING_OPTIONS = {
  graphics: ['low', 'medium', 'high'],
  camera: ['broadcast', 'first'],
  motion: ['on', 'off'],
  power: ['auto', 'on', 'off'],
};

const DEFAULTS = {
  graphics: touch ? 'medium' : 'high',
  camera: 'broadcast',
  motion: matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'off' : 'on',
  power: 'auto', // battery saver: auto = when the battery is low and not charging
};

export class Settings {
  constructor() {
    this.data = { ...DEFAULTS };
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved) {
        for (const k of Object.keys(DEFAULTS)) {
          if (SETTING_OPTIONS[k].includes(saved[k])) this.data[k] = saved[k];
        }
      }
    } catch { /* storage unavailable or corrupt */ }
    this.listeners = [];
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    if (!SETTING_OPTIONS[key]?.includes(value) || this.data[key] === value) return;
    this.data[key] = value;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
    for (const fn of this.listeners) fn(key, value);
  }

  onChange(fn) {
    this.listeners.push(fn);
  }
}
