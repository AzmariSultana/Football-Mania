import { dateKey } from './rng.js';
import { LOCKER, LOCKER_DEFAULTS } from './cosmetics.js';

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
  career: { shots: 0, goals: 0, topCorners: 0, bestStreak: 0, xp: 0, games: 0, perfects: 0, bestPerfects: 0, bestWoodwork: 0, seconds: 0 },
  trophySeen: 0,
  modes: {},
  locker: { ...LOCKER_DEFAULTS },
  lockerSeen: null, // null until first save: everything unlocked so far counts as seen
});

// XP needed to go from level L to L + 1.
const xpStep = (level) => 200 + 100 * (level - 1);
const RANKS = [
  [20, 'Legend'], [15, 'Free-kick Specialist'], [10, 'Playmaker'], [6, 'Starter'], [3, 'Prospect'], [1, 'Rookie'],
];

/** Level, rank and progress towards the next level for a total XP. */
export function levelFor(xp) {
  let level = 1, left = xp;
  while (left >= xpStep(level)) {
    left -= xpStep(level);
    level++;
  }
  return { level, xp: left, next: xpStep(level), rank: RANKS.find(([min]) => level >= min)[1] };
}

export class Progress {
  constructor() {
    this.data = DEFAULTS();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved) {
        this.data = {
          ...DEFAULTS(), ...saved,
          daily: { ...DEFAULTS().daily, ...saved.daily },
          career: { ...DEFAULTS().career, ...saved.career },
        };
      }
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

  /** Highest score in any mode, including any Daily Challenge. */
  get bestScore() {
    let best = 0, mode = null;
    for (const [m, s] of Object.entries(this.data.bests)) {
      if (Number(m) === 4) continue; // Practice runs are endless, so they don't count
      if (s > best) { best = s; mode = Number(m); }
    }
    for (const s of Object.values(this.data.daily.best)) if (s > best) { best = s; mode = 3; }
    return { score: best, mode };
  }

  // ---------------------------------------------------------------- career
  /** Lifetime stats and XP, updated after every resolved shot. */
  recordShot({ goal, base = 0, streak = 0 }) {
    const c = this.data.career;
    c.shots++;
    if (goal) {
      c.goals++;
      if (base === 9) c.topCorners++;
      c.bestStreak = Math.max(c.bestStreak, streak);
      c.xp += base * 10 + Math.min(streak, 10) * 5;
    } else {
      c.xp += 2;
    }
    this.save();
  }

  recordGame({ perfects = 0, woodwork = 0, seconds = 0 } = {}) {
    const c = this.data.career;
    c.games++;
    c.xp += 25;
    c.perfects += perfects;
    c.bestPerfects = Math.max(c.bestPerfects, perfects);
    c.bestWoodwork = Math.max(c.bestWoodwork, woodwork);
    c.seconds += Math.max(0, Math.round(seconds));
    this.save();
  }

  /** Per-mode games played and best goal streak. */
  modeStats(mode) {
    return { games: 0, bestStreak: 0, ...this.data.modes?.[mode] };
  }

  recordModeRun(mode, streak) {
    this.data.modes ??= {};
    const m = this.modeStats(mode);
    m.games++;
    m.bestStreak = Math.max(m.bestStreak, streak);
    this.data.modes[mode] = m;
    this.save();
  }

  get dailyDoneToday() {
    return this.data.daily.lastDate === dateKey();
  }

  // ---------------------------------------------------------------- locker
  /** Does the player meet an unlock rule from cosmetics.js? */
  meets(rule) {
    if (!rule) return true;
    if (rule.level) return this.career.level >= rule.level;
    if (rule.achievement) return this.has(rule.achievement);
    if (rule.stickers) return this.stickerCount >= rule.stickers;
    if (rule.dailyStreak) return Math.max(this.data.daily.bestStreak ?? 0, this.dailyStreak) >= rule.dailyStreak;
    return false;
  }

  /** Keys ("category:id") of every unlocked locker item. */
  unlockedItems() {
    const out = [];
    for (const [cat, def] of Object.entries(LOCKER)) {
      for (const item of def.items) if (this.meets(item.unlock)) out.push(`${cat}:${item.id}`);
    }
    return out;
  }

  /** Unlocked items the player hasn't looked at in the Locker yet. */
  newItems() {
    const unlocked = this.unlockedItems();
    if (!this.data.lockerSeen) {
      this.data.lockerSeen = unlocked;
      this.save();
      return [];
    }
    return unlocked.filter((k) => !this.data.lockerSeen.includes(k));
  }

  markLockerSeen() {
    this.data.lockerSeen = this.unlockedItems();
    this.save();
  }

  equipped(category) {
    const id = this.data.locker?.[category] ?? LOCKER_DEFAULTS[category];
    const item = LOCKER[category].items.find((i) => i.id === id);
    // Fall back to the default if the saved choice is unknown or no longer unlocked.
    return item && this.meets(item.unlock) ? id : LOCKER_DEFAULTS[category];
  }

  equip(category, id) {
    const item = LOCKER[category]?.items.find((i) => i.id === id);
    if (!item || !this.meets(item.unlock)) return false;
    this.data.locker = { ...LOCKER_DEFAULTS, ...this.data.locker, [category]: id };
    this.save();
    return true;
  }

  /** Unlock time (ms) of an achievement, or null. */
  unlockedAt(id) {
    const t = this.data.achievements[id];
    return typeof t === 'number' ? t : null;
  }

  /** Timestamp of the last Trophy Room visit; unlocks after it count as new. */
  get trophySeen() {
    return this.data.trophySeen ?? 0;
  }

  markTrophiesSeen() {
    this.data.trophySeen = Date.now();
    this.save();
  }

  get bossCount() {
    return this.data.bosses.length;
  }

  get career() {
    const c = this.data.career;
    return { ...c, accuracy: c.shots ? Math.round((c.goals / c.shots) * 100) : 0, ...levelFor(c.xp), totalXp: c.xp };
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
      d.bestStreak = Math.max(d.bestStreak ?? 0, d.streak);
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
