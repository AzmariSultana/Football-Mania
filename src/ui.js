import { MODE, MODE_INFO, RULES } from './config.js';
import { ACHIEVEMENTS, STICKERS } from './progress.js';
import { RARITY, CATEGORY, TROPHY_META, trophyProgress, badgeSvg, LOCK_SVG } from './trophies.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'modes', 'pause', 'over', 'help', 'trophies', 'career', 'settings'];
const SUBSCREENS = ['modes', 'trophies', 'career', 'settings'];
const MODE_SHORT = ['Goalkeeper Power', 'Goalpost Reduction', 'Time Reduction', 'Daily Challenge', 'Practice'];
const FILTERS = [
  ['all', 'All'], ['unlocked', 'Unlocked'], ['locked', 'Locked'],
  ['common', 'Common'], ['rare', 'Rare'], ['epic', 'Epic'], ['legendary', 'Legendary'],
  ['gameplay', 'Gameplay'], ['skill', 'Skill'], ['challenges', 'Challenges'], ['hidden', 'Hidden'],
];
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

// Visual identity for each mode card on the Choose a Mode screen.
const MODE_LOOK = {
  [MODE.DAILY]: {
    theme: 'daily',
    diff: 'Expert',
    objective: 'Ten fixed kicks, the same for everyone today.',
    rules: ['Wind on every kick', 'Two boss keepers', 'No miss limit'],
    icon: '<svg viewBox="0 0 24 24"><path d="M4 6h16v14H4zM4 10h16M8 3v5M16 3v5"/><path d="M8 15l2.5 2.2L16 13"/></svg>',
    art: `<svg viewBox="0 0 120 120"><rect x="18" y="26" width="84" height="76" rx="10"/><path d="M18 46h84M40 16v18M80 16v18"/><text x="60" y="88" text-anchor="middle">10</text></svg>`,
  },
  [MODE.KEEPER_POWER]: {
    theme: 'keeper',
    diff: 'Easy',
    objective: 'Beat a keeper who grows with every goal.',
    rules: ['Keeper +8% per goal', '3 misses and out', 'Boss every 5 goals'],
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="2.5"/><path d="M12 9v7M12 10l-6-4M12 10l6-4M12 16l-3 5M12 16l3 5"/></svg>',
    art: `<svg viewBox="0 0 120 120"><circle cx="60" cy="26" r="11"/><path d="M60 40v34M60 46 28 26M60 46l32-20M60 74 46 102M60 74l14 28" stroke-width="10"/><circle cx="24" cy="23" r="7"/><circle cx="96" cy="23" r="7"/></svg>`,
  },
  [MODE.GOALPOST_REDUCTION]: {
    theme: 'goal',
    diff: 'Medium',
    objective: 'Keep scoring while the goal closes in.',
    rules: ['Goal −40 per goal', '3 misses and out', 'Boss every 5 goals'],
    icon: '<svg viewBox="0 0 24 24"><path d="M3 19V6h18v13"/><path d="M8 10l-2 2 2 2M16 10l2 2-2 2"/></svg>',
    art: `<svg viewBox="0 0 120 120"><g class="shrink"><path d="M14 96V34h92v62" stroke-width="7"/><path d="M14 52h92M14 72h92M36 34v62M60 34v62M84 34v62" stroke-width="1.5" opacity=".5"/></g></svg>`,
  },
  [MODE.TIME_REDUCTION]: {
    theme: 'time',
    diff: 'Hard',
    objective: 'Shoot before the shot clock runs out.',
    rules: ['30 s per shot', '−3 s after every goal', 'Time out = a miss'],
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.2"/><path d="M12 13.5 15 10M10 3h4M12 3v3"/></svg>',
    art: `<svg viewBox="0 0 120 120"><circle cx="60" cy="66" r="40" opacity=".35"/><circle class="tick" cx="60" cy="66" r="40" pathLength="100"/><path d="M50 14h20M60 14v12"/><path class="hand" d="M60 66V38"/></svg>`,
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

    // Trophy Room filters, search and sort
    this.trophyFilter = 'all';
    const filters = $('ach-filters');
    for (const [id, label] of FILTERS) {
      const b = document.createElement('button');
      b.className = `chip-tab${id === 'all' ? ' active' : ''}${RARITY[id] ? ` r-${id}` : ''}`;
      b.dataset.filter = id;
      b.setAttribute('role', 'tab');
      b.textContent = label;
      filters.appendChild(b);
    }
    filters.addEventListener('click', (e) => {
      const b = e.target.closest('.chip-tab');
      if (!b) return;
      e.stopPropagation();
      handlers.onClick?.();
      this.trophyFilter = b.dataset.filter;
      filters.querySelectorAll('.chip-tab').forEach((x) => x.classList.toggle('active', x === b));
      this.renderAchievements();
    });
    $('ach-search').addEventListener('input', () => this.renderAchievements());
    $('ach-sort').addEventListener('change', () => this.renderAchievements());
    // Typing in the search box must not trigger game shortcuts.
    for (const el of [$('ach-search'), $('ach-sort')]) {
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
    // Daily Challenge first (featured): it changes every day.
    const order = [MODE.DAILY, MODE.KEEPER_POWER, MODE.GOALPOST_REDUCTION, MODE.TIME_REDUCTION];
    order.forEach((id, i) => {
      const m = MODE_INFO[id];
      const look = MODE_LOOK[id];
      const card = document.createElement('button');
      card.className = `mode-card theme-${look.theme}${id === MODE.DAILY ? ' daily featured-mode' : ''}`;
      card.style.setProperty('--i', i);
      card.innerHTML = `
        ${id === MODE.DAILY ? '<span class="ribbon"><i></i>Featured today</span>' : ''}
        <div class="mc-art" aria-hidden="true">${look.art}</div>
        <div class="mc-head">
          <span class="mc-icon" aria-hidden="true">${look.icon}</span>
          <span class="num">${id === MODE.DAILY ? `<span class="mc-date"></span>` : `Mode 0${i}`}</span>
          <span class="diff d-${look.diff.toLowerCase()}">${look.diff}</span>
        </div>
        <h3>${m.name}</h3>
        <p class="objective">${look.objective}</p>
        <ul class="rules">${look.rules.map((r) => `<li>${r}</li>`).join('')}</ul>
        ${id === MODE.DAILY ? `<div class="daily-strip">
          <span><small>Refreshes in</small><b class="countdown">--:--:--</b></span>
          <span><small>Streak</small><b id="daily-streak">0</b></span>
          <span><small>Reward</small><b class="daily-reward">+25 XP</b></span>
        </div>` : ''}
        <div class="mc-stats">
          <div><small>${id === MODE.DAILY ? "Today's best" : 'Best'}</small><b data-best="${m.id}">0</b></div>
          <div><small>Best combo</small><b data-combo="${m.id}">×0</b></div>
          <div class="mc-comp"><small>${id === MODE.DAILY ? 'Today' : 'Played'}</small><b data-comp="${m.id}">0</b></div>
        </div>
        <div class="mc-foot">
          <span class="xp-chip"><svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>30–90 XP per goal</span>
          <span class="mc-play">Play<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        </div>`;
      card.addEventListener('click', () => {
        card.blur();
        handlers.onClick?.();
        handlers.onSelectMode(m.id);
      });
      // Subtle 3D tilt towards the pointer.
      card.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || reduceMotion()) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 7}deg`);
        card.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 6}deg`);
        card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
      grid.appendChild(card);
    });
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
    $('meta-career').textContent = `Lv ${c.level}`;
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
    this.show('career');
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
      el.closest('.mc-comp').classList.toggle('done', id === MODE.DAILY && progress.dailyDoneToday);
    });
    const reward = document.querySelector('.daily-reward');
    if (reward) reward.textContent = progress.has('daily') ? '+25 XP' : 'Trophy';
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
    if (date) date.textContent = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
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
  achievementToast({ icon, name, desc }, kicker = 'Achievement unlocked', color = null) {
    const el = document.createElement('div');
    el.className = `ach-toast${color ? ' tinted' : ''}`;
    if (color) el.style.setProperty('--c', color);
    el.innerHTML = `<div class="icon"></div><div><div class="kicker"></div><b></b><span></span></div>`;
    el.querySelector('.icon').textContent = icon;
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

    // Completion summary
    const total = this.trophies.length;
    const unlocked = this.trophies.filter((t) => t.owned).length;
    const pct = Math.round((unlocked / total) * 100);
    $('comp-pct').textContent = `${pct}%`;
    $('ach-count').textContent = unlocked;
    $('ach-total').textContent = `/ ${total} unlocked`;
    const rank = [...COMPLETION_RANKS].reverse().find(([min]) => pct >= min);
    const next = COMPLETION_RANKS.find(([min]) => min > pct);
    $('comp-rank').textContent = rank[1];
    $('comp-next').innerHTML = next
      ? `<b>${Math.ceil((next[0] / 100) * total) - unlocked}</b> more to reach <b>${next[1]}</b>`
      : 'Every achievement unlocked. Legendary.';
    $('comp-ring').style.setProperty('--p', 0);
    requestAnimationFrame(() => requestAnimationFrame(() => setRing($('comp-ring'), unlocked / total)));
    $('rarity-split').innerHTML = Object.entries(RARITY).map(([id, r]) => {
      const all = this.trophies.filter((t) => t.rarity === id);
      return `<span class="r-${id}"><i></i>${r.label} <b>${all.filter((t) => t.owned).length}/${all.length}</b></span>`;
    }).join('');

    // Featured: latest unlock, or the closest locked one
    const latest = this.trophies.filter((t) => t.owned).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
    const closest = this.trophies.filter((t) => !t.owned && !t.hidden)
      .sort((a, b) => (b.prog?.ratio ?? 0) - (a.prog?.ratio ?? 0) || RARITY[a.rarity].rank - RARITY[b.rarity].rank)[0];
    const f = latest ?? closest;
    const fe = $('featured');
    if (f) {
      fe.className = `featured glass r-${f.rarity}${f.owned ? ' owned' : ''}${f.isNew ? ' is-new' : ''}`;
      fe.innerHTML = `
        <div class="feat-badge">${badgeSvg(f.id, { locked: !f.owned })}</div>
        <div class="feat-body">
          <div class="label">${f.owned ? (f.isNew ? 'New unlock' : 'Latest unlock') : 'Next up'}</div>
          <h3>${esc(f.name)}</h3>
          <p>${esc(f.desc)}</p>
          <div class="feat-meta">
            <span class="rarity r-${f.rarity}">${RARITY[f.rarity].label}</span>
            <span class="xp">+${RARITY[f.rarity].xp} XP</span>
            ${f.owned && f.at ? `<span class="date">${fmtDate(f.at)}</span>` : ''}
          </div>
          ${!f.owned && f.prog ? `<div class="prog"><div class="stat-bar"><i style="--w:${f.prog.ratio * 100}%"></i></div><small>${f.prog.value} / ${f.prog.target}</small></div>` : ''}
        </div>`;
    } else {
      fe.className = 'featured glass';
      fe.innerHTML = '';
    }

    // Player stats
    const stats = [
      ['Total goals', c.goals], ['Best streak', `×${c.bestStreak}`], ['Perfect strikes', c.perfects],
      ['Bosses beaten', progress.bossCount], ['Play time', fmtTime(c.seconds)],
      ['Accuracy', `${c.accuracy}%`], ['Highest score', progress.bestScore.score],
    ];
    $('trophy-stats').innerHTML = stats.map(([k, v], i) =>
      `<div class="t-stat glass" style="--i:${i}"><b>${esc(v)}</b><span>${k}</span></div>`).join('');

    // Reset filters each visit
    this.trophyFilter = 'all';
    $('ach-search').value = '';
    $('ach-sort').value = 'default';
    $('ach-filters').querySelectorAll('.chip-tab').forEach((x) => x.classList.toggle('active', x.dataset.filter === 'all'));
    this.renderAchievements();

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
      el.querySelector('.name').textContent = owned ? s.name : 'Not found';
      album.appendChild(el);
    }
    $('sticker-count').textContent = `${progress.stickerCount} / ${STICKERS.length}`;
    $('screen-trophies').scrollTop = 0;
    this.show('trophies');
    progress.markTrophiesSeen();
  }

  renderAchievements() {
    if (!this.trophies) return;
    const q = $('ach-search').value.trim().toLowerCase();
    const f = this.trophyFilter;
    const list = this.trophies.filter((t) => {
      if (f === 'unlocked' && !t.owned) return false;
      if (f === 'locked' && t.owned) return false;
      if (RARITY[f] && t.rarity !== f) return false;
      if (CATEGORY[f] && t.category !== f) return false;
      if (q) {
        const text = t.hidden ? 'secret hidden' : `${t.name} ${t.desc} ${t.rarity} ${t.category}`;
        if (!text.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const sort = $('ach-sort').value;
    if (sort === 'recent') list.sort((a, b) => (b.at ?? 0) - (a.at ?? 0) || a.index - b.index);
    else if (sort === 'rarity') list.sort((a, b) => RARITY[b.rarity].rank - RARITY[a.rarity].rank || a.index - b.index);
    else if (sort === 'progress') list.sort((a, b) => Number(a.owned) - Number(b.owned) || (b.prog?.ratio ?? 0) - (a.prog?.ratio ?? 0) || a.index - b.index);

    $('ach-grid').innerHTML = list.map((t, i) => {
      const r = RARITY[t.rarity];
      const name = t.hidden ? 'Secret' : t.name;
      const desc = t.hidden ? 'Some codes never go out of style' : t.desc;
      let foot;
      if (t.owned) {
        foot = `<span class="status ok"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Unlocked</span>${t.at ? `<span class="date">${fmtDate(t.at)}</span>` : ''}`;
      } else if (t.prog) {
        foot = `<div class="prog"><div class="stat-bar"><i style="--w:${t.prog.ratio * 100}%"></i></div><small>${t.prog.value}/${t.prog.target}</small></div>`;
      } else {
        foot = `<span class="status">${LOCK_SVG}Locked</span>`;
      }
      return `<article class="ach-card r-${t.rarity}${t.owned ? ' owned' : ' locked'}${t.isNew ? ' is-new' : ''}" style="--i:${Math.min(i, 16)}">
        ${t.isNew ? '<span class="new-tag">New</span><i class="sparks"><i></i><i></i><i></i><i></i></i>' : ''}
        <div class="ach-badge">${badgeSvg(t.id, { locked: !t.owned, hidden: t.hidden })}${t.owned ? '' : `<span class="lock-pip">${LOCK_SVG}</span>`}</div>
        <div class="ach-body">
          <div class="ach-top"><span class="rarity r-${t.rarity}">${r.label}</span><span class="xp">${t.owned ? `+${r.xp} XP` : t.hidden ? '??? XP' : `${r.xp} XP`}</span></div>
          <h4>${esc(name)}</h4>
          <p>${esc(desc)}</p>
          <div class="ach-foot">${foot}</div>
        </div>
      </article>`;
    }).join('');
    $('ach-empty').classList.toggle('hidden', list.length > 0);
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

  showGameOver({ modeName, score, best, newBest, goals, shots, streak, dailyText, unlocks }) {
    $('over-mode').textContent = modeName;
    $('over-score').textContent = score;
    $('over-best').textContent = best;
    $('over-goals').textContent = goals;
    $('over-acc').textContent = shots ? `${Math.round((goals / shots) * 100)}%` : '0%';
    $('over-streak').textContent = streak;
    $('over-newbest').classList.toggle('hidden', !newBest);
    $('over-daily').classList.toggle('hidden', !dailyText);
    $('over-daily').textContent = dailyText || '';
    const list = $('over-unlocks');
    list.innerHTML = '';
    list.classList.toggle('hidden', !unlocks.length);
    for (const u of unlocks) {
      const s = document.createElement('span');
      s.textContent = `${u.icon} ${u.name}`;
      list.appendChild(s);
    }
    this.show('over');
  }

  fatal(message) {
    $('fatal-msg').textContent = message;
    $('fatal').classList.remove('hidden');
    this.show(null);
  }
}
