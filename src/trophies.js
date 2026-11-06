import { BOSSES } from './features/bosses.js';
import { STICKERS } from './progress.js';

// Presentation data for the Trophy Room: rarity, category, reward XP, progress
// towards locked achievements and an illustrated badge for each one.

export const RARITY = {
  common: { label: 'Common', xp: 25, rank: 0 },
  rare: { label: 'Rare', xp: 50, rank: 1 },
  epic: { label: 'Epic', xp: 100, rank: 2 },
  legendary: { label: 'Legendary', xp: 250, rank: 3 },
};

export const CATEGORY = { gameplay: 'Gameplay', skill: 'Skill', challenges: 'Challenges', hidden: 'Hidden' };

// Line-art glyphs (24 × 24, stroked) drawn inside the badge.
const G = {
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.6l4 2.9-1.5 4.7h-5L8 10.5z"/><path d="M12 3.5v4.1M16 10.5l4-1.3M14.5 15.2l2.5 3.4M9.5 15.2 7 18.6M8 10.5 4 9.2"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M15 9l5-5M17 4h3v3"/>',
  sparkle: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M18.5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  diamond: '<path d="M6.5 4h11L21 9l-9 11L3 9z"/><path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5"/>',
  flame: '<path d="M12 3c1 4 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.6 1.5-4.2 2.6-5.2.3 2.1 1.4 3.2 2.6 3.2 0-3.1-1-5.7.3-8.5z"/>',
  comet: '<circle cx="15.5" cy="8.5" r="4"/><path d="M12.5 11.5 4 20M11.6 7.6 5 14.2M16.4 12.4 9.8 19"/>',
  curve: '<path d="M4 20C6 11 11 6 18.5 5"/><circle cx="18.5" cy="5" r="2"/><path d="M8 13.5h4"/><path d="M8 16.5h4" opacity=".5"/>',
  feather: '<path d="M20 4C12 4 6.5 9 5.5 18.5"/><path d="M5.5 18.5C13 18 18 12.5 20 4M9 14h6M11 10.5h6"/><path d="M5.5 18.5 4 20"/>',
  rocket: '<path d="M12 3c3 2 4.8 5.6 4.8 9.6L15 16H9l-1.8-3.4C7.2 8.6 9 5 12 3z"/><circle cx="12" cy="10" r="1.6"/><path d="M9 16l-2 4.5M15 16l2 4.5M12 17v3.5"/>',
  net: '<path d="M3 20V5h18v15"/><path d="M6 8h12M6 11.5h12M6 15h12M8 5v15M12 5v15M16 5v15" opacity=".55"/><circle cx="20" cy="9" r="1.6" fill="currentColor"/>',
  clover: '<circle cx="9.2" cy="9.2" r="3.2"/><circle cx="14.8" cy="9.2" r="3.2"/><circle cx="9.2" cy="14.8" r="3.2"/><circle cx="14.8" cy="14.8" r="3.2"/><path d="M15 15l5 5"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/><path d="M5.5 15.5h13"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v3.5M8 20h8M9.5 17h5"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7.2"/><path d="M12 13.5 15 10M10 3h4M12 3v3M18.6 6.4l1.5-1.5"/>',
  moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z"/><path d="M17 4l.6 1.6 1.6.6-1.6.6L17 8.4l-.6-1.6-1.6-.6 1.6-.6z"/>',
  wind: '<path d="M3 8.5h11a3 3 0 1 0-3-3M3 12.5h15a3 3 0 1 1-3 3M3 16.5h7"/>',
  bolt: '<path d="M13 2.5 5 14h6l-1 7.5 8-11.5h-6z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  album: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M12 6.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
  fifty: '<text x="12" y="16.5" text-anchor="middle">50</text><path d="M4 20h16" opacity=".5"/>',
  hundred: '<text x="12" y="16.5" text-anchor="middle" textLength="17" lengthAdjust="spacingAndGlyphs">100</text><path d="M4 20h16" opacity=".5"/>',
  calendar: '<path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5"/><path d="M8 15l2.5 2.2L16 13"/>',
  secret: '<path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.3-1.2.9-1.2 1.7V14.5"/><circle cx="12" cy="18" r=".9" fill="currentColor"/>',
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** id -> { rarity, category, glyph, progress(ctx) -> 0..1 | null, goal(ctx) -> "3 / 5" } */
export const TROPHY_META = {
  first_goal: { rarity: 'common', category: 'gameplay', glyph: 'ball' },
  top_bins: { rarity: 'common', category: 'skill', glyph: 'target' },
  perfect: { rarity: 'common', category: 'skill', glyph: 'sparkle' },
  pure_striker: { rarity: 'epic', category: 'skill', glyph: 'diamond', count: (c) => [c.bestPerfects, 5] },
  on_fire: { rarity: 'rare', category: 'skill', glyph: 'flame', count: (c) => [c.bestStreak, 5] },
  unstoppable: { rarity: 'legendary', category: 'skill', glyph: 'comet', count: (c) => [c.bestStreak, 10] },
  bend_it: { rarity: 'rare', category: 'skill', glyph: 'curve' },
  chip: { rarity: 'rare', category: 'skill', glyph: 'feather' },
  rocket: { rarity: 'common', category: 'skill', glyph: 'rocket' },
  postman: { rarity: 'rare', category: 'gameplay', glyph: 'net', count: (c) => [c.bestWoodwork, 3] },
  lucky: { rarity: 'rare', category: 'gameplay', glyph: 'clover' },
  giant_killer: { rarity: 'rare', category: 'challenges', glyph: 'crown', count: (c) => [c.bosses, 1] },
  boss_rush: { rarity: 'legendary', category: 'challenges', glyph: 'trophy', count: (c) => [c.bosses, BOSSES.length] },
  ice_cold: { rarity: 'epic', category: 'challenges', glyph: 'stopwatch' },
  night_owl: { rarity: 'common', category: 'gameplay', glyph: 'moon' },
  storm: { rarity: 'epic', category: 'challenges', glyph: 'wind' },
  power_player: { rarity: 'common', category: 'gameplay', glyph: 'bolt' },
  collector: { rarity: 'rare', category: 'gameplay', glyph: 'star', count: (c) => [c.stickers, 1] },
  completionist: { rarity: 'legendary', category: 'challenges', glyph: 'album', count: (c) => [c.stickers, STICKERS.length] },
  half_century: { rarity: 'rare', category: 'challenges', glyph: 'fifty', count: (c) => [c.bestScore, 50] },
  centurion: { rarity: 'epic', category: 'challenges', glyph: 'hundred', count: (c) => [c.bestScore, 100] },
  daily: { rarity: 'common', category: 'challenges', glyph: 'calendar' },
  big_head: { rarity: 'legendary', category: 'hidden', glyph: 'secret' },
};

/** Progress towards a locked achievement: { value, target, ratio } or null when it is all-or-nothing. */
export function trophyProgress(id, ctx) {
  const m = TROPHY_META[id];
  if (!m?.count) return null;
  const [value, target] = m.count(ctx);
  return { value: Math.min(value, target), target, ratio: clamp01(value / target) };
}

let badgeId = 0;

// One silhouette per rarity, so rarity reads at a glance: coin, shield, hexagon, star.
const poly = (pts) => `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
const around = (n, r, offset = 0) => Array.from({ length: n }, (_, k) => {
  const a = -Math.PI / 2 + offset + (k * 2 * Math.PI) / n;
  return [32 + Math.cos(a) * r, 32 + Math.sin(a) * r];
});
const star = (points, r1, r2) => around(points * 2, 1).map((_, k) => {
  const r = k % 2 ? r2 : r1, a = -Math.PI / 2 + (k * Math.PI) / points;
  return [32 + Math.cos(a) * r, 32 + Math.sin(a) * r];
});
const circle = (r) => `M${32 - r} 32a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
const SHAPES = {
  common: { outer: circle(29), inner: circle(22.5) },
  rare: { outer: 'M32 3 56 12v20c0 14-10 24-24 29C18 56 8 46 8 32V12z', inner: 'M32 9 50 16v16c0 10.5-7.4 18-18 22-10.6-4-18-11.5-18-22V16z' },
  epic: { outer: poly(around(6, 30)), inner: poly(around(6, 23)) },
  legendary: { outer: poly(star(10, 31, 25.5)), inner: circle(20.5) },
};

/** Illustrated medallion: the rarity's silhouette and colours with the glyph on top. */
export function badgeSvg(id, { locked = false, hidden = false } = {}) {
  const m = TROPHY_META[id] ?? { rarity: 'common', glyph: 'star' };
  const glyph = hidden ? G.secret : G[m.glyph];
  const shape = SHAPES[m.rarity] ?? SHAPES.common;
  const u = `bd${badgeId++}`;
  return `<svg class="badge-svg r-${m.rarity}${locked ? ' locked' : ''}" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="${u}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="b-hi"/><stop offset="1" class="b-lo"/></linearGradient>
      <linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${u}c"><path d="${shape.outer}"/></clipPath>
    </defs>
    <path d="${shape.outer}" fill="url(#${u}a)"/>
    <ellipse cx="32" cy="6" rx="36" ry="20" fill="url(#${u}b)" clip-path="url(#${u}c)" opacity=".5"/>
    <path d="${shape.outer}" fill="none" class="b-rim" stroke-width="1.6"/>
    <path d="${shape.inner}" class="b-inner"/>
    <g transform="translate(17 17) scale(1.25)" class="b-glyph" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
  </svg>`;
}

export const LOCK_SVG = '<svg viewBox="0 0 24 24" class="lock" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/></svg>';
