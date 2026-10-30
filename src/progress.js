import { dateKey } from './rng.js';

// Everything the player keeps between sessions, stored in localStorage.

const KEY = 'footballMania.progress';
const LEGACY_BEST_KEY = 'footballMania.best';

export const ACHIEVEMENTS = [
  { id: 'first_goal', icon: '⚽', name: 'Off the Mark', desc: 'Score your first goal' },
  { id: 'top_bins', icon: '🎯', name: 'Top Bins', desc: 'Score in a top corner' },
  { id: 'perfect', icon: '✨', name: 'Sweet Spot', desc: 'Land a Perfect Strike' },
  { id: 'pure_striker', icon: '💎', name: 'Pure Striker', desc: '5 Perfect Strikes in one game' },
  { id: 'on_fire', icon: '🔥', name: 'On Fire', desc: 'Score 5 goals in a row' },
  { id: 'unstoppable', icon: '☄️', name: 'Unstoppable', desc: 'Score 10 goals in a row' },
  { id: 'bend_it', icon: '🌀', name: 'Bend It', desc: 'Score with full curve' },
  { id: 'chip', icon: '🪶', name: 'Chip Shot', desc: 'Score with under 15% power' },
  { id: 'rocket', icon: '🚀', name: 'Rocket', desc: 'Score with over 85% power' },
  { id: 'postman', icon: '🥅', name: 'Postman', desc: 'Hit the woodwork 3 times in one game' },
  { id: 'lucky', icon: '🍀', name: 'Lucky Bounce', desc: 'Score after a touch off the keeper or wall' },
  { id: 'giant_killer', icon: '👑', name: 'Giant Killer', desc: 'Beat a boss keeper' },
  { id: 'boss_rush', icon: '🏆', name: 'Boss Rush', desc: 'Beat every boss keeper' },
  { id: 'ice_cold', icon: '⏱️', name: 'Ice Cold', desc: 'Score with under 3 s on the shot clock' },
  { id: 'night_owl', icon: '🌙', name: 'Under the Lights', desc: 'Score at night' },
  { id: 'storm', icon: '🌬️', name: 'Weather the Storm', desc: 'Score in a strong wind' },
  { id: 'power_player', icon: '⚡', name: 'Power Player', desc: 'Use a power-up' },
  { id: 'collector', icon: '⭐', name: 'Collector', desc: 'Find a golden sticker' },
  { id: 'completionist', icon: '📒', name: 'Completionist', desc: 'Collect all 12 stickers' },
  { id: 'half_century', icon: '🥈', name: 'Half Century', desc: 'Score 50 points in one game' },
  { id: 'centurion', icon: '💯', name: 'Centurion', desc: 'Score 100 points in one game' },
  { id: 'daily', icon: '📅', name: 'Daily Grind', desc: 'Finish a Daily Challenge' },
  { id: 'big_head', icon: '🤯', name: 'Big Game Energy', desc: 'Find the secret code', secret: true },
];

export const STICKERS = [
  { id: 1, icon: '👟', name: 'Golden Boot', color: '#ffd23f' },
  { id: 2, icon: '🧤', name: 'Flying Keeper', color: '#4fc3ff' },
  { id: 3, icon: '🦶', name: 'Rabona', color: '#ff7ad9' },
  { id: 4, icon: '🤸', name: 'Bicycle Kick', color: '#c6ff3d' },
  { id: 5, icon: '🥄', name: 'Panenka', color: '#ff9f43' },
  { id: 6, icon: '🦋', name: 'Knuckleball', color: '#a29bfe' },
  { id: 7, icon: '🌈', name: 'Trivela', color: '#ff4d5e' },
  { id: 8, icon: '🦂', name: 'Scorpion', color: '#ffd23f' },
  { id: 9, icon: '🎩', name: 'Hat-trick', color: '#e0e0e0' },
  { id: 10, icon: '🥜', name: 'Nutmeg', color: '#d4a373' },
  { id: 11, icon: '🏟️', name: 'Olympic Goal', color: '#00e5ff' },
  { id: 12, icon: '🕸️', name: 'Top Bins', color: '#ffffff' },
];

const DEFAULTS = () => ({
  bests: {},
  achievements: {},
  stickers: [],
  bosses: [],
  tips: {},
  daily: { lastDate: null, streak: 0, best: {} },
});

export class Progress {
  constructor() {
    this.data = DEFAULTS();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved) this.data = { ...DEFAULTS(), ...saved, daily: { ...DEFAULTS().daily, ...saved.daily } };
      const legacy = JSON.parse(localStorage.getItem(LEGACY_BEST_KEY));
      if (legacy) {
        for (const [mode, score] of Object.entries(legacy)) {
          this.data.bests[mode] = Math.max(this.data.bests[mode] ?? 0, score);
        }
        localStorage.removeItem(LEGACY_BEST_KEY);
        this.save();
      }
    } catch { /* storage unavailable or corrupt: start fresh */ }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- bests
  best(mode) {
    return this.data.bests[mode] ?? 0;
  }

  bestsMap() {
    return { ...this.data.bests, 3: this.dailyBest() };
  }

  submitBest(mode, score) {
    const isNew = score > this.best(mode);
    if (isNew) {
      this.data.bests[mode] = score;
      this.save();
    }
    return isNew;
  }

  // ---------------------------------------------------------------- daily
  dailyBest(date = dateKey()) {
    return this.data.daily.best[date] ?? 0;
  }

  get dailyStreak() {
    const { lastDate, streak } = this.data.daily;
    if (!lastDate) return 0;
    const now = new Date();
    const today = dateKey(now);
    const yesterday = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    return lastDate === today || lastDate === yesterday ? streak : 0;
  }

  /**
   * Record a finished daily run for the day it was started on (a run that
   * crosses midnight still counts for its own day). Returns { best, newBest, streak }.
   */
  submitDaily(score, date = new Date()) {
    const today = dateKey(date);
    const d = this.data.daily;
    if (d.lastDate !== today && (!d.lastDate || d.lastDate < today)) {
      const yesterday = dateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
      d.streak = d.lastDate === yesterday ? d.streak + 1 : 1;
      d.lastDate = today;
    }
    const newBest = score > (d.best[today] ?? 0);
    if (newBest) d.best[today] = score;
    // Keep only the last few weeks of daily scores.
    const keys = Object.keys(d.best).sort();
    while (keys.length > 30) delete d.best[keys.shift()];
    this.save();
    return { best: d.best[today], newBest, streak: d.streak };
  }

  // ---------------------------------------------------------------- achievements
  has(id) {
    return !!this.data.achievements[id];
  }

  /** Returns the achievement definition if it was newly unlocked. */
  unlock(id) {
    if (this.has(id)) return null;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return null;
    this.data.achievements[id] = Date.now();
    this.save();
    return def;
  }

  get unlockedCount() {
    return Object.keys(this.data.achievements).length;
  }

  // ---------------------------------------------------------------- collectibles
  hasSticker(id) {
    return this.data.stickers.includes(id);
  }

  /** Award a random sticker the player does not own yet. Returns it, or null if the album is full. */
  awardSticker(randomFn) {
    const missing = STICKERS.filter((s) => !this.hasSticker(s.id));
    if (!missing.length) return null;
    const sticker = missing[Math.floor(randomFn() * missing.length)];
    this.data.stickers.push(sticker.id);
    this.save();
    return sticker;
  }

  get stickerCount() {
    return this.data.stickers.length;
  }

  beatBoss(id) {
    if (!this.data.bosses.includes(id)) {
      this.data.bosses.push(id);
      this.save();
    }
    return this.data.bosses.length;
  }

  /** True the first time a tip id is requested. */
  firstTime(tip) {
    if (this.data.tips[tip]) return false;
    this.data.tips[tip] = 1;
    this.save();
    return true;
  }
}
