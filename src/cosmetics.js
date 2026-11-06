// Locker: cosmetic items and how they are earned. Every unlock hangs off a system the
// player already engages with (levels, achievements, bosses, the Daily, stickers), so
// progress in any of them pays out something visible in the next match.

/**
 * Unlock rule shapes:
 *   null                       always available
 *   { level: n }               reach player level n
 *   { achievement: id }        unlock that achievement
 *   { stickers: n }            collect n stickers
 *   { dailyStreak: n }         reach an n-day Daily streak (best ever)
 */
export const LOCKER = {
  kit: {
    label: 'Kit',
    items: [
      { id: 'classic', name: 'Classic Red', color: 0xd32f2f, unlock: null },
      { id: 'home', name: 'Home White', color: 0xf2f4f7, unlock: null },
      { id: 'volt', name: 'Volt', color: 0xc6ff3d, unlock: { level: 2 } },
      { id: 'royal', name: 'Royal Blue', color: 0x2346c8, unlock: { level: 4 } },
      { id: 'sunset', name: 'Sunset', color: 0xff7a1a, unlock: { level: 6 } },
      { id: 'midnight', name: 'Midnight', color: 0x14161c, unlock: { achievement: 'night_owl' } },
      { id: 'crown', name: 'Crown Purple', color: 0x7e3ff2, unlock: { achievement: 'giant_killer' } },
      { id: 'gold', name: 'Golden Era', color: 0xe8b62c, unlock: { achievement: 'centurion' } },
    ],
  },
  ball: {
    label: 'Ball',
    items: [
      { id: 'classic', name: 'Classic', base: 0xebebeb, panel: 0x121212, unlock: null },
      { id: 'volt', name: 'Volt', base: 0xf3f7ec, panel: 0x8fd11d, unlock: { level: 3 } },
      { id: 'street', name: 'Street', base: 0xff7a1a, panel: 0x161616, unlock: { level: 5 } },
      { id: 'retro', name: 'Retro Leather', base: 0x9a6233, panel: 0x5e3a1c, rough: 0.6, unlock: { dailyStreak: 3 } },
      { id: 'neon', name: 'Neon Night', base: 0x111a30, panel: 0xc6ff3d, glow: 0.35, unlock: { level: 8 } },
      { id: 'star', name: 'Star Collector', base: 0xf5f7fb, panel: 0xe2a628, unlock: { stickers: 6 } },
      { id: 'legend', name: 'Legend', base: 0xffcf40, panel: 0x6b4a00, metal: 0.8, unlock: { achievement: 'unstoppable' } },
    ],
  },
  trail: {
    label: 'Shot trail',
    items: [
      { id: 'white', name: 'Clean', colors: [0xffffff], unlock: null },
      { id: 'volt', name: 'Volt', colors: [0xc6ff3d, 0xe8ff9a], unlock: { level: 2 } },
      { id: 'ice', name: 'Ice', colors: [0x8fe3ff, 0xffffff], unlock: { level: 7 } },
      { id: 'crimson', name: 'Crimson', colors: [0xff3b5c, 0xff8a9c], unlock: { achievement: 'storm' } },
      { id: 'royal', name: 'Royal', colors: [0xa46bff, 0x4f8dff], unlock: { achievement: 'boss_rush' } },
      { id: 'prism', name: 'Prism', colors: [0xff4d5e, 0xffd23f, 0xc6ff3d, 0x4fc3ff, 0xa46bff], unlock: { achievement: 'completionist' } },
    ],
  },
  matchday: {
    label: 'Matchday',
    items: [
      { id: 'random', name: 'Surprise me', sky: ['#2f72d0', '#ffa868', '#16223d'], unlock: null },
      { id: 'day', name: 'Day', sky: ['#2f72d0', '#bfe0f7'], unlock: null },
      { id: 'golden', name: 'Golden Hour', sky: ['#34508f', '#ffa868'], unlock: { level: 3 } },
      { id: 'night', name: 'Floodlights', sky: ['#03060f', '#16223d'], unlock: { level: 5 } },
      { id: 'rain', name: 'Rain', sky: ['#252d38', '#56626f'], unlock: { level: 7 } },
    ],
  },
};

export const LOCKER_DEFAULTS = { kit: 'classic', ball: 'classic', trail: 'white', matchday: 'random' };
export const CONDITIONS = ['day', 'golden', 'night', 'rain'];
export const CONDITION_LABEL = { day: 'Day', golden: 'Golden hour', night: 'Floodlights', rain: 'Rain' };

export function findItem(category, id) {
  const items = LOCKER[category]?.items ?? [];
  return items.find((i) => i.id === id) ?? items[0];
}

/** Human-readable requirement, e.g. "Reach level 4". */
export function unlockText(rule, achievementName = (id) => id) {
  if (!rule) return 'Available';
  if (rule.level) return `Reach level ${rule.level}`;
  if (rule.achievement) return `Unlock "${achievementName(rule.achievement)}"`;
  if (rule.stickers) return `Collect ${rule.stickers} stickers`;
  if (rule.dailyStreak) return `${rule.dailyStreak}-day Daily streak`;
  return 'Locked';
}

/**
 * Matchday condition for a run. Normal runs are random (weighted towards the classic
 * looks) unless the player pinned one in the Locker; the Daily is the same for everyone.
 */
export function pickCondition({ daily = false, dateSeedValue = 0, preference = 'random', rand = Math.random }) {
  if (daily) return CONDITIONS[Math.abs(dateSeedValue) % CONDITIONS.length];
  if (preference !== 'random' && CONDITIONS.includes(preference)) return preference;
  const r = rand();
  return r < 0.34 ? 'day' : r < 0.6 ? 'golden' : r < 0.85 ? 'night' : 'rain';
}
