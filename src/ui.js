import { MODE, MODE_INFO, RULES } from './config.js';
import { ACHIEVEMENTS, STICKERS } from './progress.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['menu', 'modes', 'pause', 'over', 'help', 'trophies'];
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
    on('btn-menu-help', () => this.openHelp('menu'));
    on('btn-trophies', () => handlers.onTrophies());
    on('btn-trophies-close', () => this.show('menu'));
    on('btn-modes-back', () => this.show('menu'));
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
    $('btn-powerup').addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget.blur();
      handlers.onPowerup();
    });

    const grid = $('mode-grid');
    // Daily Challenge first: it changes every day.
    const order = [MODE.DAILY, MODE.KEEPER_POWER, MODE.GOALPOST_REDUCTION, MODE.TIME_REDUCTION];
    order.forEach((id, i) => {
      const m = MODE_INFO[id];
      const card = document.createElement('button');
      card.className = `mode-card${id === MODE.DAILY ? ' daily' : ''}`;
      card.innerHTML = `
        <div class="num">${id === MODE.DAILY ? 'Today' : `Mode 0${i}`}</div>
        <h3>${m.name}</h3>
        <span class="tag">${m.tag}</span>
        <p>${m.desc}</p>
        <div class="best">${id === MODE.DAILY ? "Today's best" : 'Best'}: <b data-best="${m.id}">0</b></div>
        ${id === MODE.DAILY ? '<div class="streak" id="daily-streak"></div>' : ''}`;
      card.addEventListener('click', () => {
        card.blur();
        handlers.onClick?.();
        handlers.onSelectMode(m.id);
      });
      grid.appendChild(card);
    });

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

  show(name) {
    for (const s of SCREENS) $(`screen-${s}`).classList.toggle('hidden', s !== name);
    this.current = name;
  }

  openHelp(returnTo) {
    this.helpReturn = returnTo;
    this.show('help');
  }

  closeHelp() {
    const back = this.helpReturn;
    this.helpReturn = null;
    if (back === 'game') {
      this.show(null);
      this.handlers.onHelpClosed?.();
    } else {
      this.show(back ?? 'menu');
    }
  }

  setHud(visible) {
    $('hud').classList.toggle('hidden', !visible);
  }

  setBest(bests, dailyStreak) {
    document.querySelectorAll('[data-best]').forEach((el) => {
      el.textContent = bests[el.dataset.best] ?? 0;
    });
    const streak = $('daily-streak');
    if (streak) streak.textContent = dailyStreak > 0 ? `🔥 ${dailyStreak}-day streak` : 'Start a streak today';
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
    $('btn-sound').classList.toggle('muted', muted);
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

  showTrophies(progress) {
    const grid = $('ach-grid');
    grid.innerHTML = '';
    for (const a of ACHIEVEMENTS) {
      const owned = progress.has(a.id);
      const el = document.createElement('div');
      el.className = `ach ${owned ? 'unlocked' : 'locked'}`;
      const hidden = a.secret && !owned;
      el.innerHTML = '<div class="icon"></div><div><b></b><span></span></div>';
      el.querySelector('.icon').textContent = hidden ? '❔' : a.icon;
      el.querySelector('b').textContent = hidden ? 'Secret' : a.name;
      el.querySelector('span').textContent = hidden ? 'Some codes never go out of style' : a.desc;
      grid.appendChild(el);
    }
    $('ach-count').textContent = `${progress.unlockedCount} / ${ACHIEVEMENTS.length}`;

    const album = $('sticker-grid');
    album.innerHTML = '';
    for (const s of STICKERS) {
      const owned = progress.hasSticker(s.id);
      const el = document.createElement('div');
      el.className = `sticker${owned ? ' owned' : ''}`;
      el.style.setProperty('--c', s.color);
      el.innerHTML = '<div class="icon"></div><div></div>';
      el.querySelector('.icon').textContent = s.icon;
      el.lastElementChild.textContent = owned ? s.name : `#${s.id}`;
      album.appendChild(el);
    }
    $('sticker-count').textContent = `${progress.stickerCount} / ${STICKERS.length}`;
    this.show('trophies');
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
