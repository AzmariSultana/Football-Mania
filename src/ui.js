import { MODE, MODE_INFO, RULES } from './config.js';
import { ACHIEVEMENTS, STICKERS, levelFor } from './progress.js';
import { RARITY, CATEGORY, TROPHY_META, trophyProgress, badgeSvg, LOCK_SVG } from './trophies.js';
import { LOCKER, unlockText } from './cosmetics.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
let previewId = 0;
/** Small illustration of a Locker item: shirt, ball, trail streak or matchday sky. */
function itemPreview(category, item) {
  const u = `lp${previewId++}`;
  if (category === 'kit') {
    const dark = ((item.color >> 16) * 0.3 + ((item.color >> 8) & 255) * 0.59 + (item.color & 255) * 0.11) > 150;
    return `<svg viewBox="0 0 64 56"><path d="M22 6 30 3q2 5 4 0l8 3 14 9-6 10-6-3v30H20V22l-6 3-6-10z" fill="${hex(item.color)}" stroke="rgba(255,255,255,.25)" stroke-width="1"/>
      <text x="32" y="38" text-anchor="middle" font-size="14" font-weight="900" font-family="Big Shoulders Display, sans-serif" fill="${dark ? '#0b1428' : '#ffffff'}">10</text></svg>`;
  }
  if (category === 'ball') {
    const p = hex(item.panel);
    return `<svg viewBox="0 0 64 56"><defs><radialGradient id="${u}" cx=".35" cy=".3"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs>
      <circle cx="32" cy="28" r="23" fill="${hex(item.base)}"/>
      <path d="M32 19l8.6 6.2-3.3 10.1H27l-3.3-10.1z" fill="${p}"/>
      <path d="M32 5.2l4 3.2-1.5 4.6h-5L28 8.4zM53.5 21l-1 5-4.6.6-2-4.6 3.2-3.6zM46 48l-4.8 1-2-4.4 3-3.8 4.6 1.4zM18 48l-2.8-5.8 4.6-1.4 3 3.8-2 4.4zM10.5 21l4.4-2.6 3.2 3.6-2 4.6-4.6-.6z" fill="${p}"/>
      <circle cx="32" cy="28" r="23" fill="url(#${u})"/></svg>`;
  }
  if (category === 'trail') {
    const stops = item.colors.map((c, i) => `<stop offset="${item.colors.length === 1 ? 1 : i / (item.colors.length - 1)}" stop-color="${hex(c)}"/>`).join('');
    return `<svg viewBox="0 0 64 56"><defs><linearGradient id="${u}" x1="0" x2="1">${stops}</linearGradient>
      <linearGradient id="${u}f" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#fff"/></linearGradient>
      <mask id="${u}m"><rect width="64" height="56" fill="url(#${u}f)"/></mask></defs>
      <path d="M4 44C18 40 32 26 48 16" stroke="url(#${u})" stroke-width="7" stroke-linecap="round" fill="none" mask="url(#${u}m)"/>
      <circle cx="51" cy="14" r="7" fill="#fff"/></svg>`;
  }
  // matchday
  const sky = item.sky;
  const stops = sky.map((c, i) => `<stop offset="${i / Math.max(1, sky.length - 1)}" stop-color="${c}"/>`).join('');
  const extra = item.id === 'rain'
    ? '<path d="M14 8l-3 10M26 6l-3 10M38 9l-3 10M50 7l-3 10M20 20l-3 10M44 21l-3 10" stroke="#b8cde4" stroke-width="1.6" stroke-linecap="round"/>'
    : item.id === 'night' ? '<circle cx="14" cy="10" r="1.2" fill="#fff"/><circle cx="40" cy="7" r="1" fill="#fff"/><circle cx="52" cy="14" r="1.3" fill="#fff"/><circle cx="26" cy="15" r="1" fill="#fff"/>'
      : item.id === 'golden' ? '<circle cx="46" cy="30" r="8" fill="#ffd27a"/>'
        : item.id === 'day' ? '<circle cx="48" cy="12" r="6" fill="#fff6d5"/>'
          : '<text x="32" y="27" text-anchor="middle" font-size="18" font-weight="900" font-family="Big Shoulders Display, sans-serif" fill="#fff">?</text>';
  return `<svg viewBox="0 0 64 56"><defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>
    <clipPath id="${u}c"><rect x="2" y="2" width="60" height="52" rx="9"/></clipPath></defs>
    <g clip-path="url(#${u}c)"><rect width="64" height="56" fill="url(#${u})"/>${extra}<rect y="38" width="64" height="18" fill="#2f6a2c"/><path d="M0 46h64" stroke="rgba(255,255,255,.5)"/></g></svg>`;
}

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'modes', 'pause', 'over', 'help', 'trophies', 'career', 'settings'];
const SUBSCREENS = ['modes', 'trophies', 'career', 'settings'];
const MODE_SHORT = ['Goalkeeper Power', 'Goalpost Reduction', 'Time Reduction', 'Daily Challenge', 'Practice'];
// Trophy cabinet shelves, in display order.
const SHELVES = ['skill', 'gameplay', 'challenges', 'hidden'];
const COMPLETION_RANKS = [[0, 'Amateur'], [25, 'Semi-pro'], [50, 'Professional'], [75, 'World Class'], [100, 'Hall of Fame']];
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtDate = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Ease a number up from 0 for stat cards. */
function countUp(el, to, dur = 900) {
  if (!el) return;
  if (reduceMotion() || !to) { el.textContent = to; return; }
  const start = performance.now();
  const tick = (now) => {
    const t = Math.max(0, Math.min(1, (now - start) / dur));
    el.textContent = Math.round(to * (1 - Math.pow(1 - t, 4)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Visual identity for each mode tile on the Choose a Mode screen: a level (1-4) for the
// difficulty bars, a one-line objective, rule tags and a full-bleed poster illustration.
const MODE_LOOK = {
  [MODE.DAILY]: {
    theme: 'daily',
    diff: 'Expert', level: 4,
    objective: 'Ten fixed kicks. Same for everyone today.',
    rules: ['Wind', '2 bosses', 'No miss limit'],
    art: `<svg viewBox="0 0 300 360" aria-hidden="true">
      <text x="240" y="200" text-anchor="end" class="a-big">10</text>
      <g class="a-dots">${Array.from({ length: 10 }, (_, k) => `<circle cx="${300 - 14 - (k % 2) * 34}" cy="${20 + Math.floor(k / 2) * 34}" r="11" ${k < 3 ? 'class="on"' : ''}/>`).join('')}</g>
    </svg>`,
  },
  [MODE.KEEPER_POWER]: {
    theme: 'keeper',
    diff: 'Easy', level: 1,
    objective: 'The keeper grows with every goal you score.',
    rules: ['Keeper +8%', '3 lives', 'Bosses'],
    art: `<svg viewBox="0 0 300 360" aria-hidden="true">
      <g class="a-solid" transform="rotate(-18 170 190)">
        <circle cx="170" cy="70" r="30"/>
        <rect x="132" y="108" width="76" height="120" rx="26"/>
        <rect x="58" y="96" width="92" height="30" rx="15" transform="rotate(-28 104 111)"/>
        <rect x="190" y="96" width="92" height="30" rx="15" transform="rotate(28 236 111)"/>
        <circle cx="62" cy="64" r="26" class="a-glove"/>
        <circle cx="278" cy="64" r="26" class="a-glove"/>
        <rect x="136" y="214" width="30" height="110" rx="15" transform="rotate(10 151 214)"/>
        <rect x="176" y="214" width="30" height="110" rx="15" transform="rotate(-10 191 214)"/>
      </g>
    </svg>`,
  },
  [MODE.GOALPOST_REDUCTION]: {
    theme: 'goal',
    diff: 'Medium', level: 2,
    objective: 'Keep scoring while the goal closes in.',
    rules: ['Goal −40', '3 lives', 'Bosses'],
    art: `<svg viewBox="0 0 300 360" aria-hidden="true">
      <g class="a-goal"><path class="a-frame" d="M40 300V110h220v190"/>
        <path class="a-net" d="M40 150h220M40 190h220M40 230h220M40 270h220M80 110v190M120 110v190M160 110v190M200 110v190M240 110v190"/></g>
      <path class="a-solid a-push l" d="M0 180l36 25-36 25z"/>
      <path class="a-solid a-push r" d="M300 180l-36 25 36 25z"/>
    </svg>`,
  },
  [MODE.TIME_REDUCTION]: {
    theme: 'time',
    diff: 'Hard', level: 3,
    objective: 'Beat the shot clock. It shrinks every goal.',
    rules: ['30 s', '−3 s per goal', '3 lives'],
    art: `<svg viewBox="0 0 300 360" aria-hidden="true">
      <circle cx="160" cy="190" r="110" class="a-track"/>
      <circle cx="160" cy="190" r="110" class="a-ring" pathLength="100"/>
      <rect x="140" y="52" width="40" height="22" rx="6" class="a-solid"/>
      <text x="160" y="226" text-anchor="middle" class="a-mid">30</text>
    </svg>`,
  },
};

function setRing(el, ratio) {
  el?.style.setProperty('--p', (Math.max(0, Math.min(1, ratio)) * 100).toFixed(1));
}
const RING_LENGTH = 119.4;

/** DOM overlay: menus (python draw_menu / draw_mode_selection / draw_game_over) and the HUD. */
export class UI {
  constructor(handlers) {
    this.handlers = handlers;
    this.helpReturn = null;
    this.cache = {};

    // Buttons drop focus after a click so Space/Enter go to the game, not the button.
    const on = (id, fn) => $(id).addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget.blur();
      handlers.onClick?.();
      fn();
    });
    on('btn-play', () => this.show('modes'));
    on('btn-menu-help', () => this.openHelp('settings'));
    on('btn-trophies', () => handlers.onTrophies());
    on('btn-trophies-back', () => this.show('menu'));
    on('btn-modes-back', () => this.show('menu'));
    on('btn-career', () => handlers.onCareer());
    on('btn-profile', () => handlers.onCareer());
    on('btn-career-close', () => this.show('menu'));
    // Player card: Overview / Locker tabs, Locker categories and equipping
    this.lockerCat = 'kit';
    $('card-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      handlers.onClick?.();
      this.showCardPane(b.dataset.pane);
    });
    $('locker-cats').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      handlers.onClick?.();
      this.lockerCat = b.dataset.cat;
      this.renderLocker();
    });
    $('locker-grid').addEventListener('click', (e) => {
      const tile = e.target.closest('.locker-item');
      if (!tile || tile.classList.contains('locked')) return;
      e.stopPropagation();
      handlers.onClick?.();
      handlers.onEquip?.(this.lockerCat, tile.dataset.id);
      this.renderLocker();
    });
    on('btn-daily', () => handlers.onDaily());
    on('btn-practice', () => handlers.onPractice());
    on('btn-settings', () => this.show('settings'));
    on('btn-settings-close', () => this.show('menu'));
    on('btn-menu-sound', () => handlers.onToggleMute());
    on('btn-help-back', () => this.closeHelp(true));

    // Settings: segmented controls
    document.querySelectorAll('.seg[data-setting]').forEach((seg) => {
      seg.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        e.stopPropagation();
        btn.blur();
        handlers.onClick?.();
        const key = seg.dataset.setting, value = btn.dataset.value;
        if (key === 'sound') {
          if ((value === 'off') !== !!this.muted) handlers.onToggleMute();
        } else {
          handlers.onSetting(key, value);
        }
      });
    });

    // Trophy Room: category tabs, status switch, rarity / sort menus, search
    this.trophyCat = 'all';
    this.trophyStatus = 'all';
    $('ach-filters').addEventListener('click', (e) => {
      const b = e.target.closest('.cat-tab');
      if (!b) return;
      e.stopPropagation();
      handlers.onClick?.();
      this.trophyCat = b.dataset.cat;
      this.renderAchievements();
    });
    $('ach-status').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      b.blur();
      handlers.onClick?.();
      this.trophyStatus = b.dataset.status;
      $('ach-status').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      this.renderAchievements();
    });
    $('ach-grid').addEventListener('click', (e) => {
      const tile = e.target.closest('.medal');
      if (!tile) return;
      e.stopPropagation();
      handlers.onClick?.();
      this.inspect(tile.dataset.id, true);
    });
    $('ach-search').addEventListener('input', () => this.renderAchievements());
    for (const id of ['ach-sort', 'ach-rarity']) $(id).addEventListener('change', () => this.renderAchievements());
    // Typing in the search box must not trigger game shortcuts.
    for (const el of [$('ach-search'), $('ach-sort'), $('ach-rarity')]) {
      for (const type of ['keydown', 'keyup']) el.addEventListener(type, (e) => e.stopPropagation());
    }

    // Menu keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, select')) return;
      if (this.current === 'menu' && e.code === 'Enter' && !e.target.closest?.('button')) {
        handlers.onClick?.();
        this.show('modes');
      } else if (this.current === 'menu' && e.code === 'KeyH') {
        this.openHelp('menu');
      } else if (this.current === 'modes' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
        const step = e.code === 'ArrowLeft' || e.code === 'ArrowUp' ? -1 : 1;
        const n = this.modeTiles.length;
        const next = (this.modeIndex + step + n) % n;
        this.selectMode(next); // don't rely on the focus event (it doesn't fire if the window isn't focused)
        this.modeTiles[next].focus({ preventScroll: true });
      } else if (this.current === 'modes' && e.code === 'Enter' && !e.target.closest?.('button')) {
        this.modeTiles[this.modeIndex].click();
      } else if (this.current === 'over' && e.code === 'Enter' && !e.target.closest?.('button')) {
        $('btn-restart').click();
      } else if (this.current === 'over' && e.code === 'Escape') {
        $('btn-over-menu').click();
      } else if (e.code === 'Escape' && SUBSCREENS.includes(this.current)) {
        this.show('menu');
      } else if (e.code === 'Escape' && this.current === 'help' && this.helpReturn !== 'game') {
        this.closeHelp(true);
      }
    });

    this.buildMotes();
    on('btn-resume', () => handlers.onResume());
    on('btn-restart-pause', () => handlers.onRestart());
    on('btn-quit', () => handlers.onMenu());
    on('btn-restart', () => handlers.onRestart());
    on('btn-over-menu', () => handlers.onMenu());
    on('btn-over-modes', () => { handlers.onMenu(); this.show('modes'); });
    on('btn-help-close', () => this.closeHelp());
    on('btn-pause', () => handlers.onTogglePause());
    on('btn-camera', () => handlers.onToggleCamera());
    on('btn-sound', () => handlers.onToggleMute());
    on('btn-help', () => handlers.onHelp());
    on('btn-end', () => handlers.onEnd());
    // Tappable curve controls (touch screens have no Q/E keys).
    $('btn-curve-left').addEventListener('click', (e) => { e.stopPropagation(); e.currentTarget.blur(); handlers.onCurve(-1); });
    $('btn-curve-right').addEventListener('click', (e) => { e.stopPropagation(); e.currentTarget.blur(); handlers.onCurve(1); });
    $('btn-powerup').addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget.blur();
      handlers.onPowerup();
    });

    const grid = $('mode-grid');
    // Daily Challenge first: it changes every day.
    const order = [MODE.DAILY, MODE.KEEPER_POWER, MODE.GOALPOST_REDUCTION, MODE.TIME_REDUCTION];
    this.modeTiles = order.map((id, i) => {
      const m = MODE_INFO[id];
      const look = MODE_LOOK[id];
      const daily = id === MODE.DAILY;
      const bars = [1, 2, 3, 4].map((n) => `<i${n <= look.level ? ' class="on"' : ''}></i>`).join('');
      const tile = document.createElement('button');
      tile.className = `mode-tile theme-${look.theme}${i === 0 ? ' is-active' : ''}`;
      tile.style.setProperty('--i', i);
      tile.setAttribute('aria-label', `${m.name}. ${look.objective}`);
      tile.innerHTML = `
        <span class="mt-shape">
          <span class="mt-bg"></span>
          <span class="mt-art">${look.art}</span>
          <span class="mt-num">0${i + 1}</span>
          <span class="mt-top">
            ${daily
              ? '<span class="live"><i></i>Live</span><span class="mt-reset">Resets <b class="countdown">--:--:--</b></span>'
              : `<span class="bars" title="Difficulty: ${look.diff}">${bars}</span><span class="mt-diff">${look.diff}</span>`}
          </span>
          <span class="mt-body">
            <span class="mt-kicker">${daily ? '<span class="mc-date"></span>' : `Mode 0${i}`}</span>
            <span class="mt-title">${m.name}</span>
            <span class="mt-detail">
              <span class="mt-obj">${look.objective}</span>
              <span class="mt-tags">${look.rules.map((r) => `<span>${r}</span>`).join('')}</span>
              <span class="mt-stats">
                <span><small>${daily ? 'Today' : 'Best'}</small><b data-best="${m.id}">0</b></span>
                <span><small>Combo</small><b data-combo="${m.id}">×0</b></span>
                ${daily
                  ? `<span><small>Streak</small><b id="daily-streak">0</b></span><span><small>Kicks</small><b data-comp="${m.id}">0 / 10</b></span>`
                  : `<span><small>Played</small><b data-comp="${m.id}">0</b></span>`}
              </span>
              <span class="mt-cta"><span class="mt-play">Play</span><kbd class="key sm">Enter</kbd></span>
            </span>
          </span>
        </span>`;
      tile.addEventListener('click', () => {
        tile.blur();
        handlers.onClick?.();
        handlers.onSelectMode(m.id);
      });
      tile.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.selectMode(i); });
      tile.addEventListener('focus', () => this.selectMode(i));
      grid.appendChild(tile);
      return tile;
    });
    this.modeIndex = 0;
    this.buildMotes('mode-motes', 18);

    this.misses = $('hud-misses');
    for (let i = 0; i < RULES.maxMiss; i++) this.misses.appendChild(document.createElement('i'));

    this.banner = $('banner');
    this.toastEl = $('toast');
    this.current = 'menu';
  }

  /** Only touch the DOM when a value changes (the HUD updates every frame). */
  set(key, value, apply) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    apply(value);
  }

  /** Switch screens; the outgoing one fades out instead of vanishing. */
  show(name) {
    const prev = this.current;
    for (const s of SCREENS) {
      const el = $(`screen-${s}`);
      clearTimeout(el.leaveTimer);
      if (s === name) {
        el.classList.remove('hidden', 'leaving');
      } else if (s === prev && s !== name && !el.classList.contains('hidden') && !reduceMotion()) {
        el.classList.add('leaving');
        el.leaveTimer = setTimeout(() => el.classList.add('hidden'), 260);
      } else {
        el.classList.add('hidden');
        el.classList.remove('leaving');
      }
    }
    this.current = name;
    if (name === 'menu' && prev !== 'menu') this.animateMenuStats();
    clearInterval(this.dailyTimer);
    if (name === 'modes') {
      this.tickDaily();
      this.dailyTimer = setInterval(() => this.tickDaily(), 1000);
    }
  }

  openHelp(returnTo) {
    this.helpReturn = returnTo;
    $('help-cta-label').textContent = returnTo === 'game' ? 'Back to the pitch' : 'Enter the pitch';
    $('screen-help').scrollTop = 0;
    this.show('help');
  }

  /** @param {boolean} back  true = Back link (return where we came from); false = main CTA */
  closeHelp(back = false) {
    const from = this.helpReturn;
    this.helpReturn = null;
    if (from === 'game') {
      this.show(null);
      this.handlers.onHelpClosed?.();
    } else if (back) {
      this.show(from ?? 'menu');
    } else {
      this.show('modes');
    }
  }

  /** Focus one mode tile: it expands and shows its details. */
  selectMode(i) {
    if (i === this.modeIndex && this.modeTiles[i].classList.contains('is-active')) return;
    this.modeIndex = i;
    this.modeTiles.forEach((t, k) => t.classList.toggle('is-active', k === i));
  }

  setMissesVisible(visible) {
    this.misses.classList.toggle('hidden', !visible);
  }

  // ------------------------------------------------------------ main menu
  setMenuStats(progress, dailyStreak) {
    const c = progress.career;
    const best = progress.bestScore;
    this.menuStats = { c, best };
    $('stat-best-mode').textContent = best.score ? MODE_SHORT[best.mode] ?? 'Best run' : 'No games yet';
    $('stat-acc-sub').textContent = `${c.goals} of ${c.shots} shots`;
    $('stat-acc-bar').style.setProperty('--w', `${c.accuracy}%`);
    $('stat-rank').textContent = c.rank;
    $('stat-xp').textContent = `${c.xp} / ${c.next} XP`;
    $('stat-xp-bar').style.setProperty('--w', `${(c.xp / c.next) * 100}%`);
    $('profile-level').textContent = c.level;
    $('profile-rank').textContent = `${c.rank} · Lv ${c.level}`;
    setRing($('profile-ring'), c.xp / c.next);
    const fresh = progress.newItems().length;
    $('meta-career').innerHTML = fresh ? `<span class="new-badge">${fresh} new</span> Lv ${c.level}` : `Lv ${c.level}`;
    $('meta-career').classList.toggle('live', fresh > 0);
    const daily = $('meta-daily');
    const todayBest = progress.dailyBest();
    daily.textContent = dailyStreak > 0 ? `${dailyStreak}-day streak` : todayBest ? `Best ${todayBest}` : 'New today';
    daily.classList.toggle('live', !todayBest);
    this.setModeStats(progress);
    if (this.current === 'menu') this.animateMenuStats();
  }

  animateMenuStats() {
    if (!this.menuStats) return;
    const { c, best } = this.menuStats;
    countUp($('stat-best'), best.score);
    countUp($('stat-acc'), c.accuracy);
    countUp($('stat-tc'), c.topCorners);
    countUp($('stat-combo'), c.bestStreak);
    countUp($('stat-level'), c.level, 600);
  }

  // ------------------------------------------------------------ settings
  syncSettings(settings) {
    this.settingsRef = settings;
    document.querySelectorAll('.seg[data-setting]').forEach((seg) => {
      const key = seg.dataset.setting;
      const value = key === 'sound' ? (this.muted ? 'off' : 'on') : settings.get(key);
      seg.querySelectorAll('button').forEach((b) => {
        const on = b.dataset.value === value;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on);
      });
    });
  }

  // ------------------------------------------------------------ career
  showCareer(progress) {
    const c = progress.career;
    $('career-level').textContent = c.level;
    $('career-rank').textContent = c.rank;
    $('career-xp').textContent = `${c.xp} / ${c.next} XP to level ${c.level + 1}`;
    setRing($('career-ring'), c.xp / c.next);
    $('career-xp-bar').style.setProperty('--w', `${(c.xp / c.next) * 100}%`);
    const cells = [
      ['Games', c.games], ['Shots', c.shots], ['Goals', c.goals], ['Accuracy', `${c.accuracy}%`],
      ['Top corners', c.topCorners], ['Best streak', c.bestStreak], ['Perfect strikes', c.perfects], ['Total XP', c.totalXp],
    ];
    $('career-grid').innerHTML = cells.map(([k, v]) => `<div><b>${esc(v)}</b><span>${k}</span></div>`).join('');
    const bests = progress.bestsMap();
    $('career-records').innerHTML = [0, 1, 2, 3, 4].map((m) =>
      `<div><span>${MODE_SHORT[m]}${m === 3 ? ' · today' : ''}</span><b>${bests[m] ?? 0}</b></div>`).join('');

    // The next level-based reward, so levelling up always has a visible target.
    let next = null;
    for (const [cat, def] of Object.entries(LOCKER)) {
      for (const item of def.items) {
        const lv = item.unlock?.level;
        if (lv && lv > c.level && (!next || lv < next.lv)) next = { lv, item, cat };
      }
    }
    $('career-next-reward').innerHTML = next
      ? `Next reward: <b>${esc(next.item.name)}</b> ${esc(LOCKER[next.cat].label.toLowerCase())} at level ${next.lv}`
      : 'Every level reward unlocked';

    this.progressRef = progress;
    $('locker-dot').classList.toggle('hidden', progress.newItems().length === 0);
    this.showCardPane('overview');
    this.show('career');
  }

  showCardPane(pane) {
    $('card-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.pane === pane));
    $('pane-overview').classList.toggle('hidden', pane !== 'overview');
    $('pane-locker').classList.toggle('hidden', pane !== 'locker');
    if (pane === 'locker') {
      this.lockerFresh = new Set(this.progressRef.newItems());
      this.renderLocker();
      this.progressRef.markLockerSeen();
      $('locker-dot').classList.add('hidden');
    }
  }

  renderLocker() {
    const p = this.progressRef;
    if (!p) return;
    const unlocked = new Set(p.unlockedItems());
    $('locker-cats').innerHTML = Object.entries(LOCKER).map(([cat, def]) => {
      const owned = def.items.filter((i) => unlocked.has(`${cat}:${i.id}`)).length;
      return `<button class="${cat === this.lockerCat ? 'active' : ''}" data-cat="${cat}" role="tab">${def.label}<small>${owned}/${def.items.length}</small></button>`;
    }).join('');
    const cat = this.lockerCat;
    const equipped = p.equipped(cat);
    const achName = (id) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
    $('locker-grid').innerHTML = LOCKER[cat].items.map((item, i) => {
      const key = `${cat}:${item.id}`;
      const isOwned = unlocked.has(key);
      const isOn = item.id === equipped;
      const state = isOn ? 'Equipped' : isOwned ? 'Equip' : unlockText(item.unlock, achName);
      return `<button class="locker-item${isOn ? ' equipped' : ''}${isOwned ? '' : ' locked'}" data-id="${item.id}" style="--i:${i}"
          ${isOwned ? '' : 'aria-disabled="true"'} aria-pressed="${isOn}">
        ${this.lockerFresh?.has(key) ? '<span class="li-new">New</span>' : ''}
        ${isOwned ? '' : '<svg class="li-lock" viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/></svg>'}
        <span class="li-preview">${itemPreview(cat, item)}</span>
        <span class="li-name">${esc(item.name)}</span>
        <span class="li-state">${esc(state)}</span>
      </button>`;
    }).join('');
    const hints = {
      kit: 'Your kit in every match. Keepers always wear a contrasting colour.',
      ball: 'The match ball. The golden power-up still turns it gold for one shot.',
      trail: 'The streak behind your shots. Streaks of 3+ still set it on fire.',
      matchday: 'Normal modes use this condition. <b>The Daily Challenge always has its own.</b>',
    };
    $('locker-hint').innerHTML = hints[cat];
  }

  setHud(visible) {
    $('hud').classList.toggle('hidden', !visible);
  }

  setBest(bests, dailyStreak) {
    document.querySelectorAll('[data-best]').forEach((el) => {
      el.textContent = bests[el.dataset.best] ?? 0;
    });
    const streak = $('daily-streak');
    if (streak) streak.textContent = dailyStreak > 0 ? `${dailyStreak} day${dailyStreak === 1 ? '' : 's'}` : 'Start one';
  }

  /** Per-mode combo / games played and the Daily Challenge state. */
  setModeStats(progress) {
    document.querySelectorAll('[data-combo]').forEach((el) => {
      el.textContent = `×${progress.modeStats(Number(el.dataset.combo)).bestStreak}`;
    });
    document.querySelectorAll('[data-comp]').forEach((el) => {
      const id = Number(el.dataset.comp);
      el.textContent = id === MODE.DAILY ? (progress.dailyDoneToday ? 'Done' : '0 / 10') : progress.modeStats(id).games;
      el.parentElement.classList.toggle('done', id === MODE.DAILY && progress.dailyDoneToday);
    });
  }

  /** Live "refreshes in" countdown on the Daily card while the mode screen is up. */
  tickDaily() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    const pad = (n) => String(n).padStart(2, '0');
    const cd = document.querySelector('.countdown');
    if (cd) cd.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    const date = document.querySelector('.mc-date');
    if (date) date.textContent = `Daily · ${now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;
  }

  setTrophyCount(unlocked, total) {
    $('trophy-count').textContent = `${unlocked}/${total}`;
  }

  setMode(name) {
    $('hud-mode').textContent = name;
  }

  setInfo(text) {
    this.set('info', text, (v) => { $('hud-info').textContent = v; });
  }

  setScore(score, bump = false) {
    const el = $('hud-score');
    if (!bump) {
      cancelAnimationFrame(this.scoreAnim);
      el.textContent = score;
      this.shownScore = score;
      return;
    }
    // Count up to the new score.
    const from = this.shownScore ?? 0;
    const start = performance.now();
    cancelAnimationFrame(this.scoreAnim);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 600);
      el.textContent = Math.round(from + (score - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) this.scoreAnim = requestAnimationFrame(tick);
    };
    this.scoreAnim = requestAnimationFrame(tick);
    this.shownScore = score;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 450);
  }

  setMultiplier(mult) {
    this.set('mult', mult, (m) => {
      const el = $('hud-mult');
      el.classList.toggle('hidden', m <= 1);
      el.classList.toggle('x2', m >= 2);
      el.textContent = `×${m}`;
      // Restart the pop animation.
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  }

  setMisses(missed) {
    [...this.misses.children].forEach((el, i) => el.classList.toggle('lost', i >= RULES.maxMiss - missed));
  }

  /** Daily Challenge shows a kick counter instead of the miss balls. */
  setKicks(kick, total) {
    const daily = kick !== null;
    this.misses.classList.toggle('hidden', daily);
    $('hud-kicks').classList.toggle('hidden', !daily);
    if (daily) $('hud-kicks').innerHTML = `Kick <b>${Math.min(kick, total)}</b> / ${total}`;
  }

  /** python draw_timer */
  setTimer(seconds, limit) {
    const box = $('hud-timer');
    if (seconds === null) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    this.set('timerText', Math.ceil(seconds), (v) => { $('hud-timer-text').textContent = v; });
    this.set('timerRing', (RING_LENGTH * (1 - seconds / limit)).toFixed(1), (v) => { $('hud-timer-ring').style.strokeDashoffset = v; });
    this.set('timerUrgent', seconds <= 5, (v) => box.classList.toggle('urgent', v));
  }

  setPower(power, charging, inSweet = false) {
    this.set('power', `${power.toFixed(3)}|${charging}|${inSweet}`, () => {
      $('power-fill').style.width = `${(power * 100).toFixed(1)}%`;
      $('power-value').textContent = `${Math.round(power * 100)}%`;
      const meter = document.querySelector('.power-meter');
      meter.classList.toggle('charging', charging);
      meter.classList.toggle('in-sweet', inSweet);
    });
  }

  setSweetSpot(center, width) {
    const el = $('power-sweet');
    el.style.left = `${(center - width / 2) * 100}%`;
    el.style.width = `${width * 100}%`;
  }

  setCurve(curve) {
    $('curve-knob').style.left = `${50 + curve * 45}%`;
  }

  setHintVisible(visible) {
    $('hud-hint').style.opacity = visible ? '1' : '0';
  }

  setBoss(boss) {
    const el = $('hud-boss');
    el.classList.toggle('hidden', !boss);
    if (boss) el.textContent = `Boss · ${boss.name}`;
  }

  /** @param {number|null} kmh  null hides the widget; angle in radians, clockwise from up */
  setWind(kmh, angle, strong) {
    const el = $('hud-wind');
    this.set('windShown', kmh !== null, (v) => el.classList.toggle('hidden', !v));
    if (kmh === null) return;
    this.set('windStrong', strong, (v) => el.classList.toggle('strong', v));
    this.set('windKmh', kmh, (v) => { $('wind-speed').textContent = `${v} km/h`; });
    this.set('windAngle', angle.toFixed(2), (v) => { $('wind-arrow').style.transform = `rotate(${v}rad)`; });
  }

  /** @param {object|null} def  power-up definition; state 'empty' | 'ready' | 'active' */
  setPowerup(def, state) {
    const btn = $('btn-powerup');
    btn.className = `panel powerup ${state}`;
    $('pu-icon').textContent = def ? def.icon : '·';
    $('pu-name').textContent = def ? (state === 'active' ? `${def.name} active` : def.name) : 'Score 3 in a row to earn one';
    btn.title = def ? `${def.name}: ${def.desc} (F)` : 'Earn power-ups with streaks and boss wins';
  }

  setPaused(paused) {
    $('btn-pause').classList.toggle('paused', paused);
    if (paused) this.show('pause');
    else if (this.current === 'pause') this.show(null);
  }

  setMuted(muted) {
    this.muted = muted;
    $('btn-sound').classList.toggle('muted', muted);
    $('btn-menu-sound').classList.toggle('muted', muted);
    if (this.settingsRef) this.syncSettings(this.settingsRef);
  }

  setReplay(on) {
    $('replay-overlay').classList.toggle('hidden', !on);
    $('hud').classList.toggle('replaying', on);
    if (on) this.clearBanner();
  }

  flash(color) {
    const el = $('flash');
    el.style.setProperty('--flash', color);
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  showBanner(title, sub, kind) {
    const b = this.banner;
    b.className = '';
    b.querySelector('.banner-title').textContent = title;
    b.querySelector('.banner-sub').textContent = sub;
    void b.offsetWidth; // restart the animation
    b.className = `show ${kind}`;
  }

  clearBanner() {
    this.banner.className = '';
  }

  toast(text, duration = 1600) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), duration);
  }

  /** Slide-in card for achievements and stickers. */
  achievementToast({ id, icon, name, desc }, kicker = 'Achievement unlocked', color = null) {
    const el = document.createElement('div');
    el.className = `ach-toast${color ? ' tinted' : ''}`;
    if (color) el.style.setProperty('--c', color);
    el.innerHTML = `<div class="icon"></div><div><div class="kicker"></div><b></b><span></span></div>`;
    // Achievements show the same badge as the trophy cabinet; anything else keeps its glyph.
    const iconEl = el.querySelector('.icon');
    if (TROPHY_META[id]) { iconEl.classList.add('badge'); iconEl.innerHTML = badgeSvg(id); }
    else iconEl.textContent = icon;
    el.querySelector('.kicker').textContent = kicker;
    el.querySelector('b').textContent = name;
    el.querySelector('span').textContent = desc;
    $('achievement-stack').appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  // ------------------------------------------------------------ trophy room
  showTrophies(progress) {
    const c = progress.career;
    const ctx = {
      ...c, bosses: progress.bossCount, stickers: progress.stickerCount, bestScore: progress.bestScore.score,
    };
    const seen = progress.trophySeen;
    this.trophies = ACHIEVEMENTS.map((a, index) => {
      const meta = TROPHY_META[a.id] ?? { rarity: 'common', category: 'gameplay' };
      const owned = progress.has(a.id);
      const at = progress.unlockedAt(a.id);
      return {
        ...a, ...meta, index, owned, at,
        hidden: a.secret && !owned,
        isNew: owned && at && seen && at > seen,
        prog: owned ? null : trophyProgress(a.id, ctx),
      };
    });

    // Summary bar
    const total = this.trophies.length;
    const unlocked = this.trophies.filter((t) => t.owned).length;
    const pct = Math.round((unlocked / total) * 100);
    $('comp-pct').textContent = `${pct}%`;
    $('ach-count').textContent = unlocked;
    $('ach-total').textContent = `/ ${total}`;
    const rank = [...COMPLETION_RANKS].reverse().find(([min]) => pct >= min);
    const next = COMPLETION_RANKS.find(([min]) => min > pct);
    $('comp-rank').textContent = rank[1];
    $('comp-next').innerHTML = next
      ? `<b>${Math.ceil((next[0] / 100) * total) - unlocked}</b> more to <b>${next[1]}</b>`
      : 'Every achievement unlocked';
    $('comp-ring').style.setProperty('--p', 0);
    requestAnimationFrame(() => requestAnimationFrame(() => setRing($('comp-ring'), unlocked / total)));
    $('rarity-split').innerHTML = Object.entries(RARITY).map(([id, r]) => {
      const all = this.trophies.filter((t) => t.rarity === id);
      return `<span class="r-${id}"><i></i><em>${r.label}</em><b>${all.filter((t) => t.owned).length}/${all.length}</b></span>`;
    }).join('');
    const stats = [
      ['Goals', c.goals], ['Best streak', `×${c.bestStreak}`], ['Perfect strikes', c.perfects],
      ['Bosses beaten', progress.bossCount], ['Play time', fmtTime(c.seconds)],
      ['Accuracy', `${c.accuracy}%`], ['High score', progress.bestScore.score],
    ];
    $('trophy-stats').innerHTML = stats.map(([k, v]) => `<div><b>${esc(v)}</b><span>${k}</span></div>`).join('');

    // Reset filters each visit; open the detail panel on the latest unlock (or the closest one)
    this.trophyCat = 'all';
    this.trophyStatus = 'all';
    $('ach-search').value = '';
    $('ach-sort').value = 'default';
    $('ach-rarity').value = 'all';
    $('ach-status').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.status === 'all'));
    const latest = this.trophies.filter((t) => t.owned).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
    const closest = this.trophies.filter((t) => !t.owned && !t.hidden)
      .sort((a, b) => (b.prog?.ratio ?? 0) - (a.prog?.ratio ?? 0) || RARITY[a.rarity].rank - RARITY[b.rarity].rank)[0];
    this.selectedTrophy = (latest ?? closest ?? this.trophies[0]).id;
    this.renderAchievements();
    this.inspect(this.selectedTrophy);

    // Sticker album
    const album = $('sticker-grid');
    album.innerHTML = '';
    for (const s of STICKERS) {
      const owned = progress.hasSticker(s.id);
      const el = document.createElement('div');
      el.className = `sticker${owned ? ' owned' : ''}`;
      el.style.setProperty('--c', s.color);
      el.innerHTML = '<span class="num"></span><div class="icon"></div><div class="name"></div>';
      el.querySelector('.num').textContent = `#${String(s.id).padStart(2, '0')}`;
      el.querySelector('.icon').textContent = s.icon;
      el.querySelector('.name').textContent = owned ? s.name : 'Not collected';
      album.appendChild(el);
    }
    $('sticker-count').textContent = `${progress.stickerCount} / ${STICKERS.length}`;
    $('screen-trophies').scrollTop = 0;
    this.show('trophies');
    progress.markTrophiesSeen();
  }

  /** Category tabs, then the shelves of medals that pass the filters. */
  renderAchievements() {
    if (!this.trophies) return;
    const q = $('ach-search').value.trim().toLowerCase();
    const rarity = $('ach-rarity').value;
    const status = this.trophyStatus;
    const pass = (t) => {
      if (status === 'unlocked' && !t.owned) return false;
      if (status === 'locked' && t.owned) return false;
      if (rarity !== 'all' && t.rarity !== rarity) return false;
      if (q) {
        const text = t.hidden ? 'secret hidden' : `${t.name} ${t.desc} ${t.rarity} ${t.category}`;
        if (!text.toLowerCase().includes(q)) return false;
      }
      return true;
    };

    // Tabs show owned / total per category
    const count = (cat) => {
      const all = this.trophies.filter((t) => cat === 'all' || t.category === cat);
      return `${all.filter((t) => t.owned).length}/${all.length}`;
    };
    $('ach-filters').innerHTML = ['all', ...SHELVES].map((cat) =>
      `<button class="cat-tab${cat === this.trophyCat ? ' active' : ''}" role="tab" aria-selected="${cat === this.trophyCat}" data-cat="${cat}">
        ${cat === 'all' ? 'All' : CATEGORY[cat]}<small>${count(cat)}</small></button>`).join('');

    const sort = $('ach-sort').value;
    const order = (list) => {
      if (sort === 'recent') list.sort((a, b) => (b.at ?? 0) - (a.at ?? 0) || a.index - b.index);
      else if (sort === 'rarity') list.sort((a, b) => RARITY[b.rarity].rank - RARITY[a.rarity].rank || a.index - b.index);
      else if (sort === 'progress') list.sort((a, b) => Number(a.owned) - Number(b.owned) || (b.prog?.ratio ?? 0) - (a.prog?.ratio ?? 0) || a.index - b.index);
      return list;
    };

    let shown = 0, i = 0;
    const shelves = (this.trophyCat === 'all' ? SHELVES : [this.trophyCat]).map((cat) => {
      const inCat = this.trophies.filter((t) => t.category === cat);
      const list = order(inCat.filter(pass));
      if (!list.length) return '';
      shown += list.length;
      const owned = inCat.filter((t) => t.owned).length;
      return `<section class="shelf">
        <header><h3>${CATEGORY[cat]}</h3><span class="shelf-count">${owned} / ${inCat.length}</span>
          <i class="shelf-bar"><i style="--w:${(owned / inCat.length) * 100}%"></i></i></header>
        <div class="medals">${list.map((t) => this.medalHtml(t, i++)).join('')}</div>
      </section>`;
    }).join('');
    $('ach-grid').innerHTML = shelves;
    $('ach-empty').classList.toggle('hidden', shown > 0);
  }

  medalHtml(t, i) {
    const r = RARITY[t.rarity];
    const name = t.hidden ? 'Secret' : t.name;
    let meta;
    if (t.owned) meta = `<span class="m-xp">+${r.xp} XP</span>`;
    else if (t.prog) meta = `<span class="m-prog"><i style="--w:${t.prog.ratio * 100}%"></i></span><span class="m-count">${t.prog.value}/${t.prog.target}</span>`;
    else meta = `<span class="m-rarity">${t.hidden ? 'Hidden' : r.label}</span>`;
    return `<button class="medal r-${t.rarity}${t.owned ? ' owned' : ' locked'}${t.isNew ? ' is-new' : ''}${t.id === this.selectedTrophy ? ' is-sel' : ''}"
        data-id="${t.id}" style="--i:${Math.min(i, 20)}" aria-label="${esc(name)}, ${r.label}, ${t.owned ? 'unlocked' : 'locked'}">
      ${t.isNew ? '<span class="m-new">New</span>' : ''}
      ${t.owned ? '' : `<span class="m-lock">${LOCK_SVG}</span>`}
      <span class="m-badge">${badgeSvg(t.id, { locked: !t.owned, hidden: t.hidden })}</span>
      <span class="m-name">${esc(name)}</span>
      <span class="m-meta">${meta}</span>
    </button>`;
  }

  /** Detail panel for one achievement. */
  inspect(id, fromTap = false) {
    const t = this.trophies?.find((x) => x.id === id);
    if (!t) return;
    this.selectedTrophy = id;
    document.querySelectorAll('#ach-grid .medal').forEach((m) => m.classList.toggle('is-sel', m.dataset.id === id));
    const r = RARITY[t.rarity];
    const name = t.hidden ? 'Secret achievement' : t.name;
    const desc = t.hidden ? 'Some codes never go out of style.' : t.desc;
    let status;
    if (t.owned) {
      status = `<div class="insp-row"><span>Status</span><b class="ok">Unlocked</b></div>
        ${t.at ? `<div class="insp-row"><span>Earned</span><b>${fmtDate(t.at)}</b></div>` : ''}`;
    } else if (t.prog) {
      status = `<div class="insp-prog"><div class="insp-prog-top"><span>Progress</span><b>${t.prog.value} / ${t.prog.target}</b></div>
        <div class="stat-bar"><i style="--w:${t.prog.ratio * 100}%"></i></div></div>`;
    } else {
      status = '<div class="insp-row"><span>Status</span><b class="muted">Locked</b></div>';
    }
    const el = $('inspector');
    el.className = `inspector r-${t.rarity}${t.owned ? ' owned' : ' locked'}${t.isNew ? ' is-new' : ''}`;
    el.innerHTML = `
      <div class="insp-stage"><i class="rays"></i><div class="insp-badge">${badgeSvg(t.id, { locked: !t.owned, hidden: t.hidden })}</div></div>
      <div class="insp-tags"><span class="insp-rarity"><i></i>${r.label}</span><span>${CATEGORY[t.category]}</span>${t.isNew ? '<span class="insp-new">New</span>' : ''}</div>
      <h3>${esc(name)}</h3>
      <p>${esc(desc)}</p>
      <div class="insp-rows">
        <div class="insp-row"><span>Reward</span><b class="xp">${t.hidden ? '???' : `${r.xp} XP`}</b></div>
        ${status}
      </div>`;
    // On narrow screens the panel sits above the shelves: bring it into view on tap.
    if (fromTap && matchMedia('(max-width: 980px)').matches) el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /** Floating dust motes behind the Trophy Room. */
  buildMotes(id = 'trophy-motes', count = 28) {
    const box = $(id);
    if (!box) return;
    for (let i = 0; i < count; i++) {
      const m = document.createElement('i');
      m.style.left = `${Math.random() * 100}%`;
      m.style.top = `${Math.random() * 100}%`;
      m.style.setProperty('--s', `${2 + Math.random() * 3}px`);
      m.style.setProperty('--t', `${10 + Math.random() * 14}s`);
      m.style.animationDelay = `${-Math.random() * 20}s`;
      box.appendChild(m);
    }
  }

  /** Post-match results: grade, score, run stats, XP earned and this run's unlocks. */
  showGameOver({ modeName, score, best, newBest, goals, shots, streak, dailyText, unlocks, xpStart = 0, xpEnd = 0, isDaily = false, rewards = [] }) {
    $('over-rewards-wrap').classList.toggle('hidden', !rewards.length);
    $('over-rewards').innerHTML = rewards.map((r) =>
      `<span class="res-medal reward">${itemPreview(r.category, r.item)}<b>${esc(r.item.name)}</b><small>${esc(r.label)}</small></span>`).join('');
    $('over-mode').textContent = modeName;

    // Grade the run on points (the Daily has only 10 kicks, so its bar is lower).
    const cut = isDaily ? [70, 45, 25, 10] : [100, 50, 25, 10];
    const grade = ['S', 'A', 'B', 'C'][cut.findIndex((c) => score >= c)] ?? 'D';
    const g = $('over-grade');
    g.className = `grade g-${grade.toLowerCase()}`;
    g.querySelector('span').textContent = grade;

    countUp($('over-score'), score, 1100);
    $('over-newbest').classList.toggle('hidden', !newBest);
    const bestline = $('over-bestline');
    bestline.classList.toggle('hidden', !!newBest);
    // Rebuilt each time (never patched), so the line can't lose its parts between games.
    const diff = score - best;
    bestline.innerHTML = best > 0 && diff < 0
      ? `<b>${-diff}</b> short of your best <b>${best}</b>`
      : `Best <b>${best}</b>`;

    $('over-goals').textContent = goals;
    $('over-shots').textContent = shots;
    $('over-acc').textContent = shots ? `${Math.round((goals / shots) * 100)}%` : '0%';
    $('over-streak').textContent = `×${streak}`;

    // XP: the bar starts where this run began and fills to where it ended.
    const before = levelFor(xpStart), after = levelFor(xpEnd);
    const levelled = after.level > before.level;
    $('over-xp').textContent = `+${Math.max(0, xpEnd - xpStart)}`;
    $('over-level').textContent = `Level ${after.level}`;
    $('over-levelup').classList.toggle('hidden', !levelled);
    $('over-xp-next').textContent = `${after.xp} / ${after.next} XP`;
    const oldPct = levelled ? 0 : (before.xp / after.next) * 100;
    const newPct = (after.xp / after.next) * 100;
    $('over-xp-old').style.width = `${oldPct}%`;
    const gain = $('over-xp-new');
    gain.style.left = `${oldPct}%`;
    gain.style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => { gain.style.width = `${Math.max(0, newPct - oldPct)}%`; }));

    $('over-daily').classList.toggle('hidden', !dailyText);
    $('over-daily').textContent = dailyText || '';

    // Unlocks as mini medals
    $('over-unlocks-wrap').classList.toggle('hidden', !unlocks.length);
    $('over-unlocks').innerHTML = unlocks.map((u) =>
      `<span class="res-medal" title="${esc(u.desc ?? '')}">${badgeSvg(u.id)}<b>${esc(u.name)}</b></span>`).join('');

    this.show('over');
  }

  fatal(message) {
    $('fatal-msg').textContent = message;
    $('fatal').classList.remove('hidden');
    this.show(null);
  }
}
