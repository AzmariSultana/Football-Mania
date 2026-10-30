import * as THREE from 'three';
import {
  STATE, MODE, MODE_INFO, RULES, GOAL, KEEPER, SHOT, SPAWN, PHYSICS, GRID_LENGTH, FIELD_BACK, FIELD_FRONT,
  DAILY, PERFECT, WIND, BOSS, STICKER, NEAR_MISS,
  getGoalPoints, zoneName, multiplierFor, clamp, rand,
} from './config.js';
import { random, seedRandom, unseedRandom, dateSeed, dateKey } from './rng.js';
import { sphereVsCapsule, computeLaunch, trajectoryPoint } from './physics.js';
import { Stadium } from './world/stadium.js';
import { Goal } from './world/goal.js';
import { StickerTarget, GhostMarker, Aura } from './world/collectibles.js';
import { Ball } from './entities/ball.js';
import { Keeper } from './entities/keeper.js';
import { Kicker } from './entities/kicker.js';
import { DefensiveWall } from './entities/wall.js';
import { setBigHead } from './entities/characters.js';
import { Particles } from './fx/particles.js';
import { AudioFX } from './audio.js';
import { CameraRig, CAM_FIRST_PERSON } from './camera.js';
import { Input, PAD } from './input.js';
import { UI } from './ui.js';
import { Progress, ACHIEVEMENTS, STICKERS } from './progress.js';
import { BOSSES } from './features/bosses.js';
import { POWERUPS, POWERUP_IDS, POWERUP_STREAKS } from './features/powerups.js';
import { Replay } from './features/replay.js';

const PREVIEW_DOTS = 18;
const LASER_DOTS = 44;
const REPLAY_SPEED = 0.5;
const KICKER_KITS = [0xd32f2f, 0xff7a1a, 0xf5f5f5, 0xffd600, 0x7e3ff2, 0x111418];
const KEEPER_KITS = [0x2e9d4a, 0xff3d9a, 0x00bcd4, 0xc6ff3d, 0xff9800];
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

const MISS_TEXT = {
  keeper: ['SAVED!', ['What a stop', 'Keeper says no', 'Fingertips!']],
  wall: ['BLOCKED', ['Straight into the wall', 'Get it up and over']],
  post: ['OFF THE POST', ['So close!', 'Rattled the woodwork']],
  over: ['OVER THE BAR', ['Keep it down', 'Into the stands']],
  wide: ['WIDE', ['Just off target', 'Wide of the post']],
  short: ['NO GOAL', ['Not enough on it', 'Comfortable for the keeper']],
  time: ['TIME UP', ['The shot clock ran out']],
};
const pick = (list) => list[(Math.random() * list.length) | 0];

const _v = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _spin = new THREE.Vector3();
const _accel = new THREE.Vector3();
const _target = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _fwd = new THREE.Vector3();

/**
 * Game controller. Mirrors the python module-level state machine
 * (STATE_MENU -> STATE_MODE_SELECT -> STATE_PLAYING -> STATE_GAME_OVER) and its
 * shoot_ball / move_ball / score_goal / missed_goal flow, plus the arcade layer:
 * perfect strikes, streak multipliers, wind, bosses, power-ups, stickers,
 * replays, achievements and the Daily Challenge.
 *
 * Kick phases: aim -> runup -> flight -> result -> (replay) -> next kick.
 */
export class Game {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.baseFov = camera.fov;

    this.stadium = new Stadium(scene, renderer);
    this.goal = new Goal(scene);
    this.ball = new Ball(scene);
    this.keeper = new Keeper(scene);
    this.kicker = new Kicker(scene);
    this.wall = new DefensiveWall(scene);
    this.sticker = new StickerTarget(scene);
    this.ghost = new GhostMarker(scene);
    this.aura = new Aura(scene);
    this.fx = new Particles(scene, { max: 2500, additive: false, soft: false });
    this.glow = new Particles(scene, { max: 2000, additive: true, soft: true });
    this.audio = new AudioFX();
    this.rig = new CameraRig(camera);
    this.progress = new Progress();
    this.raycaster = new THREE.Raycaster();
    this.goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.createMarker();
    this.createPreview();

    const kh = this.kicker.human, gk = this.keeper.human;
    this.replay = new Replay([
      this.ball.mesh,
      gk.root, gk.body, gk.shoulderL, gk.shoulderR, gk.hipL, gk.hipR,
      kh.root, kh.body, kh.shoulderL, kh.shoulderR, kh.hipL, kh.hipR,
      ...this.wall.humans.map((h) => h.root),
    ]);

    this.state = STATE.MENU;
    this.mode = MODE.KEEPER_POWER;
    this.paused = false;
    this.phase = 'aim';
    this.spot = new THREE.Vector3();
    this.eye = new THREE.Vector3();
    this.trailFrom = new THREE.Vector3();
    this.wind = new THREE.Vector3();
    this.windStrength = 0;
    this.aim = new THREE.Vector2(0, 100);    // python marker_x / marker_z
    this.power = 0;
    this.charging = false;
    this.chargeTime = 0;
    this.curve = 0;
    this.sweet = { center: 0.5, width: PERFECT.width };
    this.shot = null;
    this.accumulator = 0;
    this.time = 0;
    this.flashTimer = 0;
    this.hitStop = 0;
    this.recordTail = 0;
    this.konami = [];
    this.bigHead = false;
    this.cooldowns = { bounce: 0, keeper: 0, wall: 0, post: 0, net: 0 };

    this.ui = new UI({
      onClick: () => { this.audio.unlock(); this.audio.click(); },
      onSelectMode: (mode) => this.startMode(mode),
      onResume: () => this.setPaused(false),
      onRestart: () => this.startMode(this.mode),
      onMenu: () => this.toMenu(),
      onTogglePause: () => this.setPaused(!this.paused),
      onToggleCamera: () => this.toggleCamera(),
      onToggleMute: () => this.toggleMute(),
      onHelp: () => this.openHelp(),
      onHelpClosed: () => this.closeHelp(),
      onEnd: () => this.endGame(),
      onPowerup: () => this.activatePowerup(),
      onTrophies: () => this.ui.showTrophies(this.progress),
    });
    this.refreshMenu();
    this.ui.setMuted(this.audio.muted);
    this.ui.setHud(false);
    this.ui.show('menu');

    this.input = new Input(renderer.domElement, {
      onKeyDown: (code) => this.onKeyDown(code),
      onKeyUp: (code) => this.onKeyUp(code),
      onPointerDown: (button) => this.onPointerDown(button),
      onPointerUp: (button) => { if (button === 0) this.releaseCharge(); },
      onPointerMove: () => { this.pointerAimDirty = true; },
      onWheel: (dir) => this.adjustCurve(-dir),
      onBlur: () => this.autoPause(),
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });

    this.resetRun();
    this.rig.update(1, this.cameraContext());
    this.rig.snap();
  }

  // ------------------------------------------------------------ scene helpers
  createMarker() {
    // python draw_marker: red sphere on the goal plane. Now a reticle that always shows through.
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, depthTest: false, transparent: true });
    this.marker = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.5, 11.5, 40), mat);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), mat);
    this.marker.add(ring, dot);
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 6), mat);
      const a = (i * Math.PI) / 2;
      tick.position.set(Math.sin(a) * 15, Math.cos(a) * 15, 0);
      tick.rotation.z = -a;
      this.marker.add(tick);
    }
    this.marker.traverse((o) => { o.renderOrder = 10; });
    this.scene.add(this.marker);
  }

  createPreview() {
    this.preview = new THREE.InstancedMesh(
      new THREE.SphereGeometry(2, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }),
      LASER_DOTS,
    );
    this.preview.frustumCulled = false;
    this.scene.add(this.preview);
  }

  onResize(bufferHeight, fov) {
    this.baseFov = fov;
    this.bufferHeight = bufferHeight;
    this.updateParticleScale();
  }

  updateParticleScale() {
    this.fx.setViewport(this.bufferHeight, this.camera.fov);
    this.glow.setViewport(this.bufferHeight, this.camera.fov);
  }

  refreshMenu() {
    this.ui.setBest(this.progress.bestsMap(), this.progress.dailyStreak);
    this.ui.setTrophyCount(this.progress.unlockedCount, ACHIEVEMENTS.length);
  }

  get isDaily() {
    return this.mode === MODE.DAILY;
  }

  // ------------------------------------------------------------ state machine
  startMode(mode) {
    this.mode = mode;
    // Daily Challenge: seed every gameplay random number with the date the run
    // started on (fixed for the whole run, even across midnight).
    this.dailyDate = new Date();
    if (mode === MODE.DAILY) seedRandom(dateSeed(this.dailyDate));
    else unseedRandom();
    this.state = STATE.PLAYING;
    this.paused = false;
    this.ui.setPaused(false);
    this.ui.setReplay(false);
    this.ui.show(null);
    this.ui.setHud(true);
    this.ui.setMode(MODE_INFO[mode].name);
    this.stadium.cycleTime = 0;
    this.resetRun();
    this.audio.unlock();
    this.audio.whistle();
    this.ui.toast(this.isDaily ? `Daily Challenge · ${dateKey(this.dailyDate)} · ${DAILY.kicks} kicks` : 'Beat the wall, beat the keeper!', 2200);
    if (this.progress.firstTime('perfect')) this.delayedTip('Tip: release inside the green band for a Perfect Strike', 2400);
  }

  /** Show a tip a little later, unless the player has left the game by then. */
  delayedTip(text, delay) {
    const run = this.runId;
    setTimeout(() => {
      if (this.state === STATE.PLAYING && this.runId === run) this.ui.toast(text, 4000);
    }, delay);
  }

  toMenu() {
    unseedRandom();
    this.state = STATE.MENU;
    this.paused = false;
    this.ui.setPaused(false);
    this.ui.setReplay(false);
    this.ui.setHud(false);
    this.ui.clearBanner();
    this.refreshMenu();
    this.ui.show('menu');
    this.audio.setWind(0);
    this.resetRun();
  }

  /** python reset_game */
  resetRun() {
    this.runId = (this.runId ?? 0) + 1;
    this.score = 0;
    this.missed = 0;
    this.goals = 0;
    this.shots = 0;
    this.kick = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.goalWidth = GOAL.width;
    this.keeperWidth = KEEPER.width;
    this.keeperHeight = KEEPER.height;
    this.shotLimit = RULES.timerMax;
    this.curve = 0;
    this.aim.set(0, 100);
    this.powerup = null;
    this.powerupActive = false;
    this.bossNext = false;
    this.bossIndex = 0;
    this.aimHistory = [];
    this.stats = { perfects: 0, woodwork: 0, unlocks: [] };
    this.replay.stop();

    // python: random shirt colours, kept visually distinct from each other.
    this.kicker.setShirt(pick(KICKER_KITS));
    this.keeperKit = pick(KEEPER_KITS);

    this.ui.setScore(0);
    this.ui.setMisses(0);
    this.ui.setKicks(this.isDaily && this.state === STATE.PLAYING ? 1 : null, DAILY.kicks);
    this.ui.setCurve(0);
    this.ui.setMultiplier(1);
    this.ui.setPowerup(null, 'empty');
    this.spawnShot();
  }

  /** python spawn_player_and_ball */
  spawnShot() {
    // Daily: re-seed per kick so the layout depends only on the date and kick
    // number, not on how many random draws earlier kicks happened to use.
    if (this.isDaily && this.state === STATE.PLAYING) seedRandom(dateSeed(this.dailyDate) * 31 + this.kick * 7919);

    // Boss keeper for this kick?
    this.boss = null;
    if (this.state === STATE.PLAYING) {
      if (this.isDaily && DAILY.bossKicks.includes(this.kick)) {
        this.boss = BOSSES[Math.floor(random() * BOSSES.length)];
      } else if (!this.isDaily && this.bossNext) {
        this.boss = BOSSES[this.bossIndex % BOSSES.length];
        this.bossIndex++;
      }
    }
    this.bossNext = false;

    if (this.goal.width !== this.goalWidth) this.goal.setWidth(this.goalWidth);
    // Boss scaling on top of Keeper Power growth, but never taller than the goal.
    const bossScale = Math.min(this.boss?.scale ?? 1, GOAL.height / this.keeperHeight);
    this.keeper.setSize(this.keeperWidth * bossScale, this.keeperHeight * bossScale);
    this.keeper.setShirt(this.boss?.shirt ?? this.keeperKit);

    for (let i = 0; i < 60; i++) {
      const x = rand(-SPAWN.maxX, SPAWN.maxX);
      const z = rand(SPAWN.minZ, SPAWN.maxZ);
      if (Math.atan2(Math.abs(x), z) <= SPAWN.maxAngle) {
        this.spot.set(x, 0, z);
        break;
      }
    }
    this.ball.place(this.spot.x, this.spot.z);
    this.ball.setGolden(false);
    this.kicker.place(this.ball.position, _v.set(0, 0, 0));
    this.wall.place(this.ball.position, this.goalWidth, this.boss?.wall ?? 4);
    this.keeper.reset(this.spot.x, this.goalWidth);

    this.rollWind();
    this.sweet.center = rand(PERFECT.min, PERFECT.max);
    this.ui.setSweetSpot(this.sweet.center, this.sweet.width);

    if (this.state === STATE.PLAYING && random() < STICKER.chance) {
      const m = 30;
      this.sticker.show(rand(-this.goalWidth / 2 + m, this.goalWidth / 2 - m), rand(m, GOAL.height - m));
    } else {
      this.sticker.hide();
    }

    this.phase = 'aim';
    this.charging = false;
    this.power = 0;
    this.shot = null;
    this.accumulator = 0;
    this.powerupActive = false;
    // Mouse movement during the last kick must not jump the first-person marker.
    this.input?.delta.set(0, 0);
    this.ui.clearBanner();
    this.shotClock = this.shotLimit;
    this.lastTick = Math.ceil(this.shotClock);
    this.clampAim();
    this.goal.showZones(true);
    this.aura.set(this.boss ? this.boss.shirt : null);
    this.ui.setPower(0, false);
    this.ui.setHintVisible(true);
    this.ui.setBoss(this.boss);
    this.ui.setPowerup(this.powerup ? POWERUPS[this.powerup] : null, this.powerup ? 'ready' : 'empty');
    if (this.isDaily && this.state === STATE.PLAYING) this.ui.setKicks(this.kick + 1, DAILY.kicks);
    this.updateInfo();

    if (this.boss) {
      this.ui.showBanner('BOSS KEEPER', `${this.boss.name} · ${this.boss.desc}`, 'boss');
      this.audio.horn();
      this.stadium.cheer(0.5);
      this.ui.flash('rgba(255, 45, 85, 0.6)');
    }
  }

  rollWind() {
    let s = 0;
    if (this.state === STATE.PLAYING) {
      if (this.isDaily) s = this.kick === 0 ? 0 : rand(0.15, 0.85);
      else if (this.goals >= WIND.startGoal) s = Math.min(WIND.max, WIND.perGoal * (this.goals - WIND.startGoal + 1)) * rand(0.5, 1);
    }
    const angle = rand(0, Math.PI * 2);
    this.windStrength = s;
    this.wind.set(Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(s * WIND.maxAccel);
    this.audio.setWind(s);
    if (s > 0.05 && this.progress.firstTime('wind')) {
      this.ui.toast('Wind! It pushes the ball while it is in the air. Check the arrow, top right.', 4000);
    }
  }

  updateInfo() {
    if (this.isDaily) {
      this.ui.setInfo(`Daily · ${dateKey(this.dailyDate)}`);
    } else if (this.mode === MODE.KEEPER_POWER) {
      this.ui.setInfo(`Keeper size ${Math.round((this.keeperHeight / KEEPER.height) * 100)}%`);
    } else if (this.mode === MODE.GOALPOST_REDUCTION) {
      this.ui.setInfo(`Goal width ${this.goalWidth}`);
    } else {
      this.ui.setInfo(`Shot clock ${this.shotLimit}s`);
    }
    this.ui.setTimer(this.mode === MODE.TIME_REDUCTION ? this.shotClock : null, this.shotLimit);
  }

  setPaused(paused) {
    if (this.state !== STATE.PLAYING || this.ui.current === 'help') return;
    this.paused = paused;
    if (paused) this.cancelCharge();
    this.ui.setPaused(paused);
  }

  /** Drop a half-charged shot (pause, help) and reset the meter. */
  cancelCharge() {
    this.charging = false;
    this.power = 0;
    this.ui.setPower(0, false);
    this.audio.setCrowdLevel(0);
  }

  autoPause() {
    if (this.state === STATE.PLAYING && !this.paused) this.setPaused(true);
  }

  openHelp() {
    if (this.state !== STATE.PLAYING || this.ui.current === 'help') return;
    // Remember whether the game was already paused, so closing help goes back to it.
    this.helpFromPause = this.paused;
    this.paused = true;
    this.cancelCharge();
    this.ui.openHelp('game');
  }

  closeHelp() {
    if (this.helpFromPause) {
      this.ui.setPaused(true);
    } else {
      this.paused = false;
      this.ui.setPaused(false);
    }
  }

  toggleCamera() {
    const mode = this.rig.toggleMode();
    this.ui.toast(mode === CAM_FIRST_PERSON ? 'First-person view' : 'Third-person view');
  }

  toggleMute() {
    this.audio.unlock();
    this.audio.setMuted(!this.audio.muted);
    this.ui.setMuted(this.audio.muted);
  }

  /** python end_game */
  endGame() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.GAME_OVER;
    this.paused = false;
    this.ui.setPaused(false);
    this.ui.setReplay(false);
    this.replay.stop();
    if (this.phase === 'replay' || this.phase === 'aim') this.phase = 'result';
    this.cancelCharge();

    let best, newBest, dailyText = '';
    if (this.isDaily) {
      // Only a completed daily run counts towards the streak and the daily best.
      if (this.kick >= DAILY.kicks) {
        const res = this.progress.submitDaily(this.score, this.dailyDate);
        ({ best, newBest } = res);
        dailyText = `🔥 ${res.streak}-day streak · new kicks tomorrow`;
        this.achieve('daily');
      } else {
        best = this.progress.dailyBest(dateKey(this.dailyDate));
        newBest = false;
        dailyText = `Unfinished: play all ${DAILY.kicks} kicks for the run to count`;
      }
    } else {
      newBest = this.progress.submitBest(this.mode, this.score);
      best = this.progress.best(this.mode);
    }
    unseedRandom();

    this.ui.setHud(false);
    this.ui.clearBanner();
    this.refreshMenu();
    this.ui.showGameOver({
      modeName: MODE_INFO[this.mode].name,
      score: this.score,
      best,
      newBest,
      goals: this.goals,
      shots: this.shots,
      streak: this.bestStreak,
      dailyText,
      unlocks: this.stats.unlocks,
    });
    this.audio.whistle(true);
    this.audio.setWind(0);
    this.windStrength = 0;
    this.goal.showZones(false);
    this.aura.set(null);
    this.sticker.hide();
  }

  achieve(id) {
    const def = this.progress.unlock(id);
    if (!def) return;
    this.stats.unlocks.push(def);
    this.ui.achievementToast(def);
    this.audio.achievement();
    this.ui.setTrophyCount(this.progress.unlockedCount, ACHIEVEMENTS.length);
  }

  // ------------------------------------------------------------ input
  get canAim() {
    return this.state === STATE.PLAYING && !this.paused && this.phase === 'aim';
  }

  onKeyDown(code) {
    this.audio.unlock();
    this.checkKonami(code);
    if (code === 'Escape' && this.ui.current === 'help') {
      this.ui.closeHelp();
      return;
    }
    if (this.phase === 'replay' && (code === 'Space' || code === 'Enter')) {
      this.finishReplay();
      return;
    }
    switch (code) {
      case 'Space': this.beginCharge(); break;
      case 'KeyQ': this.adjustCurve(-1); break;
      case 'KeyE': this.adjustCurve(1); break;
      case 'KeyF': this.activatePowerup(); break;
      case 'KeyP':
      case 'Escape': if (this.ui.current !== 'help') this.setPaused(!this.paused); break;
      case 'KeyC': if (this.state === STATE.PLAYING) this.toggleCamera(); break;
      case 'KeyM': this.toggleMute(); break;
      case 'KeyH': this.openHelp(); break;
      default: break;
    }
  }

  onKeyUp(code) {
    if (code === 'Space') this.releaseCharge();
  }

  onPointerDown(button) {
    this.audio.unlock();
    if (this.state !== STATE.PLAYING || this.paused) return;
    if (this.phase === 'replay') {
      this.finishReplay();
      return;
    }
    if (button === 0) {
      this.pointerAimDirty = true;
      this.beginCharge();
    } else if (button === 2) {
      this.toggleCamera(); // python: right mouse button changes point of view
    }
  }

  checkKonami(code) {
    this.konami.push(code);
    if (this.konami.length > KONAMI.length) this.konami.shift();
    if (this.konami.join() !== KONAMI.join()) return;
    this.konami.length = 0;
    this.bigHead = !this.bigHead;
    for (const h of [this.kicker.human, this.keeper.human, ...this.wall.humans]) setBigHead(h, this.bigHead);
    this.ui.toast(this.bigHead ? '🤯 Big head mode!' : 'Heads back to normal');
    this.audio.powerup();
    this.achieve('big_head');
  }

  pollGamepad(dt) {
    const pad = this.input.pollGamepad();
    if (!pad) return;
    if (this.state === STATE.PLAYING && !this.paused) {
      if (this.phase === 'aim') {
        this.aim.x += pad.aimX * SHOT.aimSpeed * 1.3 * dt;
        this.aim.y -= pad.aimY * SHOT.aimSpeed * 1.3 * dt;
      }
      this.rig.rotate(pad.camX * 1.6 * dt, -pad.camY * 1.0 * dt);
      if (pad.charge && !this.padCharging) {
        if (this.phase === 'replay') this.finishReplay();
        else this.beginCharge();
      }
      if (!pad.charge && this.padCharging) this.releaseCharge();
      if (pad.pressed.has(PAD.LB)) this.adjustCurve(-1);
      if (pad.pressed.has(PAD.RB)) this.adjustCurve(1);
      if (pad.pressed.has(PAD.X)) this.activatePowerup();
      if (pad.pressed.has(PAD.Y)) this.toggleCamera();
    }
    if (pad.pressed.has(PAD.START)) this.setPaused(!this.paused);
    this.padCharging = pad.charge;
  }

  adjustCurve(dir) {
    if (!this.canAim) return;
    this.curve = clamp(Math.round((this.curve + dir * SHOT.curveStep) * 100) / 100, -1, 1);
    this.ui.setCurve(this.curve);
    this.audio.tick();
  }

  beginCharge() {
    if (!this.canAim || this.charging) return;
    this.charging = true;
    this.chargeTime = 0;
    this.power = 0;
    this.wasInSweet = false;
  }

  releaseCharge() {
    if (!this.charging) return;
    this.charging = false;
    if (this.canAim) this.shoot();
  }

  get inSweetSpot() {
    return Math.abs(this.power - this.sweet.center) <= this.sweet.width / 2;
  }

  clampAim() {
    const m = SHOT.aimMargin;
    this.aim.x = clamp(this.aim.x, -this.goalWidth / 2 + m, this.goalWidth / 2 - m);
    this.aim.y = clamp(this.aim.y, m, GOAL.height - m);
  }

  updateAim(dt) {
    const k = this.input;
    const speed = SHOT.aimSpeed * dt;
    // python keyboardListener: W/S move the marker up/down, A/D left/right.
    if (k.isDown('KeyW')) this.aim.y += speed;
    if (k.isDown('KeyS')) this.aim.y -= speed;
    if (k.isDown('KeyA')) this.aim.x -= speed;
    if (k.isDown('KeyD')) this.aim.x += speed;

    if (this.pointerAimDirty) {
      this.pointerAimDirty = false;
      if (this.rig.mode === CAM_FIRST_PERSON) {
        // The first-person camera looks at the marker, so use relative movement.
        this.aim.x += k.delta.x * 0.5;
        this.aim.y -= k.delta.y * 0.5;
      } else {
        this.raycaster.setFromCamera(k.pointer, this.camera);
        if (this.raycaster.ray.intersectPlane(this.goalPlane, _v)) this.aim.set(_v.x, _v.y);
      }
    }
    k.delta.set(0, 0);
    this.clampAim();
  }

  // ------------------------------------------------------------ power-ups
  grantPowerup() {
    if (this.powerup) return;
    this.powerup = POWERUP_IDS[Math.floor(random() * POWERUP_IDS.length)];
    const def = POWERUPS[this.powerup];
    this.ui.setPowerup(def, 'ready');
    this.ui.achievementToast(def, 'Power-up earned', '#c6ff3d');
    this.audio.powerup();
    if (this.progress.firstTime('powerup')) this.delayedTip('Press F (or click the slot, bottom left) to use your power-up', 1200);
  }

  activatePowerup() {
    if (!this.canAim || !this.powerup || this.powerupActive) return;
    this.powerupActive = true;
    const def = POWERUPS[this.powerup];
    if (this.powerup === 'mini') this.wall.setSize(0.6);
    if (this.powerup === 'golden') this.ball.setGolden(true);
    if (this.powerup === 'ice') this.aura.set(0x7fd6ff);
    this.ui.setPowerup(def, 'active');
    this.ui.flash('rgba(198, 255, 61, 0.5)');
    this.audio.powerup();
    this.glow.emit({
      position: this.ball.position, count: 30, color: [0xc6ff3d, 0xffffff], speed: [60, 160],
      size: [3, 6], life: [0.4, 0.8], gravity: -60, spread: 2,
    });
    this.achieve('power_player');
  }

  // ------------------------------------------------------------ shooting
  /** python shoot_ball */
  shoot() {
    const power = this.power;
    const perfect = this.inSweetSpot;
    _target.set(this.aim.x, this.aim.y, 0);
    if (!perfect) {
      // Nobody is perfectly accurate: a small scatter that grows with distance,
      // so aiming right into the corner risks the post.
      const scatter = SHOT.baseScatter + this.spot.length() * SHOT.distanceScatter;
      _target.x += (random() + random() - 1) * scatter;
      _target.y += (random() + random() - 1) * scatter;
    }
    if (power > SHOT.overpower) {
      const e = (power - SHOT.overpower) / (1 - SHOT.overpower);
      _target.x += rand(-1, 1) * e * SHOT.overpowerError;
      _target.y += rand(-0.3, 1) * e * SHOT.overpowerError;
    }
    const target = _target.clone();
    const curve = this.curve;
    this.phase = 'runup';
    this.goal.showZones(false);
    this.ui.setHintVisible(false);
    this.audio.setCrowdLevel(0.15);
    this.replay.start();
    this.replayWanted = false;
    this.kicker.kick(() => this.launch(target, power, curve, perfect));
  }

  launch(target, power, curve, perfect) {
    if (this.state !== STATE.PLAYING && this.state !== STATE.MENU) return;
    const flight = computeLaunch(this.ball.position, target, power, curve, _vel, _spin);
    this.ball.launch(_vel, _spin);
    this.ball.wind.copy(this.wind);
    this.shots++;
    this.phase = 'flight';
    const powerup = this.powerupActive ? this.powerup : null;
    this.shot = {
      time: 0, touched: null, resolved: false, power, flight, perfect, curve, powerup,
      clockLeft: this.shotClock, boss: this.boss, hitPost: false, launchAt: this.replay.elapsed,
    };
    if (powerup) {
      this.powerup = null;
      this.powerupActive = false;
      this.ui.setPowerup(null, 'empty');
    }

    this.audio.kick(power);
    this.fx.emit({
      position: this.ball.position, count: 22, color: [0x3d8b37, 0x58a84a, 0x6b4a2b],
      speed: [60, 200], size: [2.5, 5], life: [0.4, 0.9], gravity: 600, drag: 1.5, jitter: 6,
    });
    if (perfect) this.perfectStrike();
    this.wall.jump();

    // Keeper decision. Slow, loopy shots are easier to read.
    const boss = this.boss;
    let reads = {
      [MODE.KEEPER_POWER]: 0.5,
      [MODE.GOALPOST_REDUCTION]: 0.35 + Math.min(0.25, this.goals * 0.03),
      [MODE.TIME_REDUCTION]: 0.4 + Math.min(0.2, this.goals * 0.02),
      [MODE.DAILY]: 0.4 + Math.min(0.2, this.goals * 0.02),
    }[this.mode] + clamp((flight - 0.5) * 0.4, 0, 0.3) + (boss?.readBonus ?? 0);
    let reactionAdd = (boss?.reactionAdd ?? 0) + (perfect ? PERFECT.reactionDelay : 0);
    if (powerup === 'ice') {
      reads = 0;
      reactionAdd += 0.35;
    }

    // Against slow shots the keeper backs towards the line; he aims for where the
    // ball will cross his own plane, not the goal line.
    const keeperZ = clamp(KEEPER.lineOffset - (flight - 0.6) * 80, 12, KEEPER.lineOffset);
    const startZ = this.ball.position.z;
    const arrival = flight * clamp((startZ - keeperZ) / startZ, 0, 1);
    _accel.copy(_spin).add(this.wind);
    let guess;
    const randomGuess = () => _v.set(rand(-this.goalWidth / 2 + 20, this.goalWidth / 2 - 20), rand(20, GOAL.height - 20), keeperZ);
    if (boss?.gambler && powerup !== 'ice') {
      // Commits early to a corner: beaten by anything down the middle.
      const side = random() < 0.5 ? -1 : 1;
      guess = _v.set(side * (this.goalWidth / 2 - 45), rand(40, GOAL.height - 40), keeperZ);
    } else if (boss?.mirror && powerup !== 'ice' && this.aimHistory.length >= 2) {
      const n = this.aimHistory.length;
      const avg = this.aimHistory.reduce((a, p) => a.add(p), new THREE.Vector2()).divideScalar(n);
      guess = _v.set(avg.x + rand(-15, 15), avg.y + rand(-15, 15), keeperZ);
    } else if (random() < reads) {
      guess = trajectoryPoint(this.ball.position, _vel, _accel, arrival, _v);
      guess.x += rand(-18, 18);
      guess.y += rand(-18, 18);
    } else {
      guess = randomGuess();
    }
    this.keeper.react(guess, this.mode, arrival, keeperZ, { reactionAdd, early: !!boss?.gambler && powerup !== 'ice' });

    this.aimHistory.push(new THREE.Vector2(target.x, target.y));
    if (this.aimHistory.length > 5) this.aimHistory.shift();
  }

  perfectStrike() {
    this.stats.perfects++;
    this.hitStop = 0.09;
    this.audio.perfect();
    this.rig.shake(3);
    this.ui.flash('rgba(94, 227, 122, 0.55)');
    this.ui.toast('✨ Perfect Strike', 1200);
    this.glow.emit({
      position: this.ball.position, count: 34, color: [0xffffff, 0x5ee37a, 0xc6ff3d],
      speed: [120, 340], size: [3, 6], life: [0.25, 0.5], gravity: 0, drag: 3, spread: 2,
    });
    this.achieve('perfect');
    if (this.stats.perfects >= 5) this.achieve('pure_striker');
  }

  // ------------------------------------------------------------ physics
  stepPhysics(dt) {
    this.accumulator += dt;
    const h = PHYSICS.substep;
    let steps = 0;
    while (this.accumulator >= h && steps < 24) {
      this.accumulator -= h;
      steps++;
      this.substep(h);
    }
  }

  substep(h) {
    const ball = this.ball, r = ball.radius, cd = this.cooldowns;
    const impact = ball.step(h);
    if (impact > 150 && cd.bounce <= 0) {
      cd.bounce = 0.12;
      this.audio.bounce(Math.min(1, impact / 900));
      this.fx.emit({ position: ball.position, count: 6, color: [0x3d8b37, 0x58a84a], speed: [30, 90], size: [2, 4], life: [0.3, 0.6], gravity: 500 });
    }

    for (const c of this.goal.colliders) {
      const v = sphereVsCapsule(ball.position, ball.velocity, r, c.wa, c.wb, c.wr, 0.7, 0.92, _v);
      if (v > 0) this.onTouch('post', v);
    }
    for (const c of this.keeper.colliders) {
      const v = sphereVsCapsule(ball.position, ball.velocity, r, c.wa, c.wb, c.wr, 0.35, 0.7, _v);
      if (v > 0) this.onTouch('keeper', v);
    }
    for (const c of this.wall.colliders) {
      const v = sphereVsCapsule(ball.position, ball.velocity, r, c.wa, c.wb, c.wr, 0.45, 0.75, _v);
      if (v > 0) this.onTouch('wall', v);
    }
    if (this.goal.collideNet(ball) && cd.net <= 0) {
      cd.net = 0.3;
      this.audio.net();
    }
    if (this.state === STATE.PLAYING && this.sticker.hits(ball.position, r)) this.collectSticker();

    if (this.state === STATE.PLAYING && this.shot && !this.shot.resolved) this.checkResolution();
  }

  onTouch(kind, speed) {
    this.ball.spinActive = false;
    const s = this.shot;
    if (s && !s.resolved) {
      s.touched = kind;
      if (kind === 'post' && !s.hitPost) {
        s.hitPost = true;
        this.stats.woodwork++;
        if (this.stats.woodwork >= 3) this.achieve('postman');
      }
    }
    if (this.cooldowns[kind] > 0) return;
    this.cooldowns[kind] = 0.25;
    const p = this.ball.position;
    if (kind === 'post') {
      this.audio.post();
      this.rig.shake(5);
      this.hitStop = 0.06;
      this.glow.emit({ position: p, count: 26, color: [0xffffff, 0xfff2b0], speed: [80, 260], size: [3, 6], life: [0.2, 0.45], gravity: 200, spread: 2 });
    } else if (kind === 'keeper') {
      this.audio.save();
      this.rig.shake(3);
      this.glow.emit({ position: p, count: 16, color: [0xffffff, 0xc6ff3d], speed: [60, 180], size: [3, 7], life: [0.2, 0.4], gravity: 0, spread: 2 });
    } else {
      this.audio.bounce(Math.min(1, speed / 700));
      this.fx.emit({ position: p, count: 8, color: [0xffffff, 0xdddddd], speed: [40, 120], size: [2, 4], life: [0.2, 0.4], gravity: 300, spread: 2 });
    }
  }

  collectSticker() {
    this.sticker.hide();
    this.score += STICKER.bonus;
    this.ui.setScore(this.score, true);
    this.replayWanted = true;
    this.audio.sticker();
    this.glow.emit({
      position: this.ball.position, count: 50, color: [0xffd23f, 0xffffff, 0xffb000], speed: [100, 300],
      size: [4, 8], life: [0.4, 0.9], gravity: 100, spread: 2,
    });
    const s = this.progress.awardSticker(Math.random);
    if (s) {
      this.ui.achievementToast({ icon: s.icon, name: s.name, desc: `Sticker #${s.id} added to your album · +${STICKER.bonus}` }, 'Sticker found', s.color);
      this.achieve('collector');
      if (this.progress.stickerCount >= STICKERS.length) this.achieve('completionist');
    } else {
      this.ui.toast(`⭐ Golden star +${STICKER.bonus}`);
    }
  }

  /** python move_ball: goal / keeper / wall / out of play checks. */
  checkResolution() {
    const p = this.ball.position, q = this.ball.prev, s = this.shot;

    if (q.z > 0 && p.z <= 0) {
      const t = q.z / (q.z - p.z);
      const x = q.x + (p.x - q.x) * t;
      const y = q.y + (p.y - q.y) * t;
      if (this.goal.isInside(x, y, this.ball.radius)) {
        this.scoreGoal(x, y);
        return;
      }
      // How close was it? Gap between the ball's edge and the frame.
      const r = this.ball.radius, pr = GOAL.postRadius, w = this.goalWidth, h = this.goal.height;
      const gapX = Math.abs(x) - (w / 2 + pr + r);
      const gapY = y - (h + pr + r);
      const over = y > h;
      const gap = over ? (Math.abs(x) < w / 2 ? gapY : Math.max(gapX, gapY)) : gapX;
      const reason = s.touched === 'post' || s.touched === 'keeper' ? s.touched : (over ? 'over' : 'wide');
      this.missShot(reason, gap >= 0 && gap < NEAR_MISS.gap ? { gap, x, y, over } : null);
      return;
    }
    const out = Math.abs(p.x) > GRID_LENGTH + 40 || p.z > FIELD_FRONT + 100 || p.z < -FIELD_BACK || p.y > 900;
    const stopped = s.time > 0.6 && this.ball.speed < 35;
    if (out || stopped || s.time > 6) this.missShot(s.touched || (out ? 'wide' : 'short'));
  }

  resolveShot() {
    this.shot.resolved = true;
    this.shot.resolveAt = this.replay.elapsed;
    this.recordTail = 0.9;
    this.phase = 'result';
    this.kick++;
  }

  /** python score_goal */
  scoreGoal(x, y) {
    const s = this.shot;
    this.resolveShot();
    this.resultTimer = 2.6;
    this.goals++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);

    const base = getGoalPoints(x, y, this.goalWidth, this.goal.height);
    const mult = multiplierFor(this.streak);
    let pts = Math.round(base * mult);
    if (s.powerup === 'golden') pts *= 2;
    const bossBonus = s.boss ? BOSS.bonus : 0;
    this.score += pts + bossBonus;

    // python score_goal mode effects
    let effect = '';
    if (this.mode === MODE.KEEPER_POWER) {
      const before = this.keeperHeight;
      this.keeperHeight = clamp(this.keeperHeight + KEEPER.height * KEEPER.growth, KEEPER.height, GOAL.height * 0.9);
      this.keeperWidth = clamp(this.keeperWidth + KEEPER.width * KEEPER.growth, KEEPER.width, this.goalWidth * 0.8);
      if (this.keeperHeight > before) effect = 'Keeper grows';
    } else if (this.mode === MODE.GOALPOST_REDUCTION) {
      const before = this.goalWidth;
      this.goalWidth = clamp(this.goalWidth - GOAL.shrinkStep, GOAL.minWidth, GOAL.width);
      if (this.goalWidth < before) effect = 'Goal shrinks';
    } else if (this.mode === MODE.TIME_REDUCTION) {
      this.shotLimit = Math.max(RULES.timerMin, this.shotLimit - RULES.timerDec);
      effect = `Shot clock ${this.shotLimit}s`;
    }
    if (!this.isDaily && this.goals % BOSS.every === 0) this.bossNext = true;

    const parts = [`${zoneName(base)} +${base}`];
    if (mult > 1) parts.push(`×${mult} streak`);
    if (s.powerup === 'golden') parts.push('×2 golden');
    if (bossBonus) parts.push(`Boss +${bossBonus}`);
    if (this.streak > 1) parts.push(`${this.streak} in a row`);
    if (effect) parts.push(effect);
    const title = s.boss ? 'BOSS BEATEN!' : s.perfect && base === 9 ? 'GOLAZO!' : 'GOAL!';
    this.ui.showBanner(title, parts.join(' · '), base === 9 || s.boss ? 'goal gold' : 'goal');
    this.ui.setScore(this.score, true);
    this.ui.setMultiplier(multiplierFor(this.streak + 1));
    this.ui.flash(base === 9 ? 'rgba(255, 210, 63, 0.55)' : 'rgba(198, 255, 61, 0.45)');

    this.audio.cheer();
    if (this.streak >= 3) this.audio.chant();
    this.stadium.cheer(1.3);
    this.rig.shake(4);
    this.flashTimer = 2.2;
    const confetti = [0xc6ff3d, 0xffd23f, 0x4fc3ff, 0xff4d5e, 0xffffff, 0xff7ad9];
    for (let i = 0; i < 5; i++) {
      this.fx.emit({
        position: _v.set(rand(-this.goalWidth / 2, this.goalWidth / 2), this.goal.height + 20, rand(-30, 30)),
        count: 50, color: confetti, speed: [150, 420], size: [4, 7], life: [1.6, 2.8],
        gravity: 160, drag: 1.8, flutter: 260, spread: 1,
      });
    }
    this.glow.emit({ position: _v.set(x, y, 0), count: 40, color: [0xffffff, 0xc6ff3d, 0xffd23f], speed: [100, 320], size: [4, 9], life: [0.3, 0.7], gravity: 0, spread: 2 });

    // Rewards
    if (POWERUP_STREAKS.includes(this.streak) || s.boss) this.grantPowerup();
    if (s.boss) {
      this.achieve('giant_killer');
      if (this.progress.beatBoss(s.boss.id) >= BOSSES.length) this.achieve('boss_rush');
    }

    // Achievements
    this.achieve('first_goal');
    if (base === 9) this.achieve('top_bins');
    if (this.streak >= 5) this.achieve('on_fire');
    if (this.streak >= 10) this.achieve('unstoppable');
    if (Math.abs(s.curve) >= 1) this.achieve('bend_it');
    if (s.power < 0.15) this.achieve('chip');
    if (s.power > 0.85) this.achieve('rocket');
    if (s.touched === 'keeper' || s.touched === 'wall') this.achieve('lucky');
    if (this.mode === MODE.TIME_REDUCTION && s.clockLeft < 3) this.achieve('ice_cold');
    if (this.stadium.isNight) this.achieve('night_owl');
    if (this.windStrength >= 0.6) this.achieve('storm');
    if (this.score >= 50) this.achieve('half_century');
    if (this.score >= 100) this.achieve('centurion');

    // Slow-motion replay for the special ones.
    this.replayWanted = this.replayWanted || base === 9 || s.perfect || !!s.boss || !!s.touched
      || Math.abs(s.curve) >= 0.75 || this.streak >= 3;
  }

  /** python missed_goal */
  missShot(reason, near = null) {
    if (this.shot) this.resolveShot();
    this.resultTimer = 2.1;
    this.missed++;
    this.streak = 0;
    this.charging = false;
    this.replayWanted = false;
    const [title, subs] = MISS_TEXT[reason] || MISS_TEXT.short;
    let detail = pick(subs);
    if (near) {
      detail = `Inches! ${Math.max(1, Math.round(near.gap * NEAR_MISS.cmPerUnit))} cm ${near.over ? 'over' : 'wide'}`;
      this.ghost.show(near.x, near.y);
    }
    const left = RULES.maxMiss - this.missed;
    const tail = this.isDaily
      ? `Kick ${this.kick} / ${DAILY.kicks}`
      : (left > 0 ? `${left} ${left === 1 ? 'miss' : 'misses'} left` : 'Final whistle');
    this.ui.showBanner(title, `${detail} · ${tail}`, 'miss');
    if (!this.isDaily) this.ui.setMisses(this.missed);
    this.ui.setMultiplier(1);
    this.goal.showZones(false);
    if (near || reason === 'post') {
      this.audio.ooh();
      this.stadium.cheer(0.3);
    } else {
      this.audio.groan();
    }
    if (reason === 'keeper') this.stadium.cheer(0.4);
  }

  /** After the result (and replay): next kick or game over. */
  nextKick() {
    const over = this.isDaily ? this.kick >= DAILY.kicks : this.missed >= RULES.maxMiss;
    if (over) this.endGame();
    else this.spawnShot();
  }

  // ------------------------------------------------------------ replay
  startReplay() {
    this.replay.stop();
    this.phase = 'replay';
    // Film from the opposite back corner, so the ball flies diagonally towards the lens.
    this.replaySide = this.ball.position.x > 0 ? -1 : 1;
    const s = this.shot;
    this.replayFrom = Math.max(0, s.launchAt - 0.3);
    this.replayTo = Math.min(this.replay.duration, (s.resolveAt ?? this.replay.duration) + 0.7);
    this.replayTime = this.replayFrom;
    this.replay.apply(this.replayTime);
    this.ui.setReplay(true);
    this.rig.cut();
    this.audio.setCrowdLevel(0.6);
  }

  finishReplay() {
    if (this.phase !== 'replay') return;
    this.ui.setReplay(false);
    this.audio.setCrowdLevel(0);
    this.rig.cut();
    this.nextKick();
    this.rig.update(1 / 60, this.cameraContext());
    this.rig.cut();
  }

  // ------------------------------------------------------------ frame update
  cameraContext() {
    let phase = 'menu';
    if (this.state === STATE.PLAYING) phase = this.phase === 'aim' || this.phase === 'runup' ? 'aim' : this.phase;
    return {
      phase,
      ball: this.ball.position,
      spot: this.spot,
      marker: this.marker.position,
      eye: this.kicker.eye(this.eye),
      replaySide: this.replaySide,
    };
  }

  update(dt) {
    this.time += dt;
    const realDt = dt;
    // Hit-stop: a few frames of near-freeze on big impacts.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.08;
    }
    const playing = this.state === STATE.PLAYING;
    const active = playing && !this.paused;

    for (const k in this.cooldowns) this.cooldowns[k] -= dt;
    this.pollGamepad(realDt);

    if (active) {
      const turn = 1.4 * realDt;
      const k = this.input;
      if (k.isDown('ArrowLeft')) this.rig.rotate(-turn, 0);
      if (k.isDown('ArrowRight')) this.rig.rotate(turn, 0);
      if (k.isDown('ArrowUp')) this.rig.rotate(0, turn * 0.6);
      if (k.isDown('ArrowDown')) this.rig.rotate(0, -turn * 0.6);
      this.updatePhase(dt, realDt);
    }
    // Read after updatePhase: a replay that just ended must not re-apply old poses.
    const replaying = this.phase === 'replay' && this.state === STATE.PLAYING;

    if (!this.paused) {
      this.stadium.update(dt, playing);
      if (replaying) {
        this.replay.apply(this.replayTime);
      } else {
        this.kicker.update(dt);
        if (this.phase === 'result' && this.shot?.resolved && this.streak > 0 && playing) this.kicker.celebrate(dt);
        this.keeper.update(dt);
        this.wall.update(dt);
        if (this.ball.moving) {
          this.trailFrom.copy(this.ball.position);
          this.stepPhysics(dt);
          this.ball.spinVisual(dt);
          if (this.phase === 'flight') this.emitTrail();
        }
        if (this.replay.recording) {
          this.replay.capture(dt);
          if (this.shot?.resolved) {
            this.recordTail -= dt;
            if (this.recordTail <= 0) this.replay.stop();
          }
        }
      }
      this.goal.update(dt);
      this.sticker.update(dt);
      this.ghost.update(dt);
      this.aura.update(dt, this.keeper.root.position);
      this.fx.update(dt);
      this.glow.update(dt);
      this.updateFlashes(dt);
      this.updateWindFx(dt);
    }

    if (!(active && this.phase === 'aim')) this.input.delta.set(0, 0);
    this.updateMarker();
    this.updateFov(realDt);
    this.kicker.root.visible = !(this.rig.mode === CAM_FIRST_PERSON && playing && !replaying);
    this.rig.update(realDt, this.cameraContext());
    if (playing) this.updateWindHud();
  }

  updatePhase(dt, realDt) {
    if (this.phase === 'aim') {
      this.updateAim(realDt);
      if (this.charging) {
        // Power bar fills and drains (ping-pong) while the button is held.
        this.chargeTime += realDt;
        const t = (this.chargeTime / SHOT.chargeTime) % 2;
        this.power = t < 1 ? t : 2 - t;
        const sweet = this.inSweetSpot;
        if (sweet && !this.wasInSweet) this.audio.tick();
        this.wasInSweet = sweet;
        this.ui.setPower(this.power, true, sweet);
        this.audio.setCrowdLevel(this.power * 0.35);
      }
      if (this.mode === MODE.TIME_REDUCTION) {
        this.shotClock = Math.max(0, this.shotClock - realDt);
        const sec = Math.ceil(this.shotClock);
        if (sec !== this.lastTick) {
          this.lastTick = sec;
          if (sec <= 5 && sec > 0) this.audio.tick(true);
        }
        this.ui.setTimer(this.shotClock, this.shotLimit);
        if (this.shotClock <= 0) {
          this.shot = { time: 0, touched: null, resolved: false };
          this.missShot('time');
        }
      }
    } else if (this.phase === 'flight' && this.shot) {
      this.shot.time += dt;
    } else if (this.phase === 'result') {
      this.resultTimer -= realDt;
      if (this.resultTimer <= 0) {
        if (this.replayWanted && this.shot?.launchAt !== undefined && this.replay.duration > 0.6) this.startReplay();
        else this.nextKick();
      }
    } else if (this.phase === 'replay') {
      this.replayTime += realDt * REPLAY_SPEED;
      if (this.replayTime >= this.replayTo) this.finishReplay();
    }
  }

  updateMarker() {
    const aiming = this.state === STATE.PLAYING && this.phase === 'aim';
    this.marker.visible = aiming;
    this.preview.visible = aiming;
    if (!aiming) return;

    this.marker.position.set(this.aim.x, this.aim.y, 0.5);
    this.marker.scale.setScalar(1 + Math.sin(this.time * 6) * 0.08);
    this.goal.highlightAt(this.aim.x, this.aim.y);

    // Dotted preview of the first part of the trajectory (all of it with Laser Aim).
    const laser = this.powerupActive && this.powerup === 'laser';
    const dots = laser ? LASER_DOTS : PREVIEW_DOTS;
    const portion = laser ? 1 : 0.4;
    const power = this.charging ? this.power : 0.5;
    const flight = computeLaunch(this.ball.position, _target.set(this.aim.x, this.aim.y, 0), power, this.curve, _vel, _spin);
    _accel.copy(_spin).add(this.wind);
    // Without wind compensation in the launch, show where the ball will really go.
    for (let i = 0; i < dots; i++) {
      trajectoryPoint(this.ball.position, _vel, _accel, ((i + 1) / dots) * flight * portion, _v);
      this.preview.setMatrixAt(i, _mat.makeTranslation(_v.x, _v.y, _v.z));
    }
    this.preview.count = dots;
    this.preview.material.color.set(laser ? 0xff3b3b : 0xffffff);
    this.preview.instanceMatrix.needsUpdate = true;
  }

  /** Slight zoom while charging, tighter during replays. */
  updateFov(dt) {
    let target = this.baseFov;
    if (this.charging) target -= this.power * 6;
    if (this.phase === 'replay') target -= 10;
    const fov = this.camera.fov + (target - this.camera.fov) * Math.min(1, dt * 6);
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.updateParticleScale();
    }
  }

  updateWindHud() {
    if (this.windStrength < 0.05) {
      this.ui.setWind(null);
      return;
    }
    // Arrow relative to where the camera is looking (up = away from the camera).
    this.camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    _fwd.normalize();
    const wx = this.wind.x, wz = this.wind.z;
    const sx = wx * -_fwd.z + wz * _fwd.x;
    const sy = wx * _fwd.x + wz * _fwd.z;
    this.ui.setWind(Math.round(this.windStrength * WIND.kmh), Math.atan2(sx, sy), this.windStrength >= 0.6);
  }

  updateWindFx() {
    if (this.windStrength < 0.3 || Math.random() > this.windStrength * 0.7) return;
    _v.set(this.spot.x + (Math.random() - 0.5) * 700, 20 + Math.random() * 160, this.spot.z * 0.5 + (Math.random() - 0.5) * 600);
    this.glow.emit({
      position: _v, count: 1, color: 0xe8f4ff, direction: _accel.copy(this.wind).normalize(), spread: 0.05,
      speed: [this.windStrength * 380, this.windStrength * 520], size: [2, 3], life: [0.6, 1], gravity: 0, drag: 0,
    });
  }

  emitTrail() {
    const b = this.ball;
    const onFire = multiplierFor(this.streak + 1) > 1 || this.shot?.powerup === 'golden';
    const n = 3;
    for (let i = 0; i < n; i++) {
      _v.lerpVectors(this.trailFrom, b.position, i / n);
      this.glow.emit({
        position: _v, count: 1,
        color: onFire ? [0xff8a2b, 0xffd23f] : this.shot && this.shot.power > 0.7 ? 0xffe9a8 : 0xffffff,
        speed: [0, 4], size: onFire ? [6, 8] : [4, 5.5], life: [0.15, 0.25], gravity: 0, drag: 0,
      });
    }
    if (onFire && Math.random() < 0.6) {
      this.glow.emit({ position: b.position, count: 2, color: [0xff4d1a, 0xff8a2b], speed: [10, 40], size: [4, 7], life: [0.2, 0.35], gravity: -120, spread: 2 });
    }
  }

  updateFlashes(dt) {
    if (this.flashTimer <= 0) return;
    this.flashTimer -= dt;
    const chance = 0.5 + (1 - this.stadium.day) * 0.5;
    if (Math.random() < chance) {
      this.glow.emit({ position: this.stadium.randomSeat(_v), count: 1, color: 0xffffff, speed: [0, 1], size: [26, 36], life: [0.06, 0.12], gravity: 0 });
    }
  }
}
