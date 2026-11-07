// Procedural sound effects, crowd and soundtrack with the Web Audio API, so the game
// needs no audio files.
//
// Mix: three buses into the master, so no layer overpowers the others.
//   sfx    kicks, posts, nets, UI clicks         (front and centre)
//   crowd  ambience murmur and reactions         (around the player)
//   music  generative soundtrack (music.js)      (underneath everything)
// Each screen ("scene") has its own levels; changes always fade.

import { Music } from './music.js';

const STORAGE_KEY = 'footballMania.muted';

// Bus levels per scene. Music sits well under the effects in a match and is muffled
// when paused; the crowd is quieter in menus and fuller on the pitch.
const SCENES = {
  menu: { music: 0.6, crowd: 0.45, cutoff: 18000, mode: 'relaxed' },
  overlay: { music: 0.5, crowd: 0.4, cutoff: 18000, mode: 'relaxed' },
  game: { music: 0.2, crowd: 1, cutoff: 18000, mode: 'groove' },
  paused: { music: 0.22, crowd: 0.3, cutoff: 700, mode: null },
};

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicEnabled = true;
    this.scene = 'menu';
    try { this.muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch { /* storage unavailable */ }
  }

  /** Browsers only allow audio after a user gesture. */
  unlock() {
    if (this.ctx) {
      // A user gesture while we're active also revives a context the browser suspended.
      if (this.ctx.state === 'suspended' && !document.hidden) {
        this.appSuspended = false;
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Buses
    const s = SCENES[this.scene];
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.crowd = ctx.createGain();
    this.crowd.gain.value = s.crowd;
    this.crowd.connect(this.master);
    this.musicLevel = ctx.createGain();      // per-scene level and the Music on/off
    this.musicLevel.gain.value = 0;          // fades in below
    this.musicDuck = ctx.createGain();       // dips under goal cheers
    this.musicTone = ctx.createBiquadFilter(); // muffles when paused
    this.musicTone.type = 'lowpass';
    this.musicTone.frequency.value = s.cutoff;
    this.musicLevel.connect(this.musicDuck).connect(this.musicTone).connect(this.master);

    this.music = new Music(ctx, this.musicLevel, this.noise);
    this.startAmbience();
    if (this.musicEnabled) this.music.start();
    this.applyScene(2.5); // first fade-in is slow and gentle
  }

  // ---------------------------------------------------------------- mix
  /** Move to a scene's mix ('menu' | 'overlay' | 'game' | 'paused'), fading over ~1-2 s. */
  setScene(scene) {
    if (!SCENES[scene] || scene === this.scene) return;
    this.scene = scene;
    if (this.ctx) this.applyScene(0.6);
  }

  applyScene(tau) {
    const s = SCENES[this.scene], t = this.ctx.currentTime;
    this.musicLevel.gain.setTargetAtTime(this.musicEnabled ? s.music : 0, t, tau);
    this.crowd.gain.setTargetAtTime(s.crowd, t, tau);
    this.musicTone.frequency.setTargetAtTime(s.cutoff, t, tau * 0.6);
    if (s.mode) this.music.setMode(s.mode);
  }

  setMusicEnabled(on) {
    this.musicEnabled = on;
    if (!this.ctx) return;
    if (on) this.music.start();
    this.applyScene(0.6);
    // Stop scheduling notes once the fade-out is over (no CPU for silent music).
    clearTimeout(this.musicStopTimer);
    if (!on) this.musicStopTimer = setTimeout(() => { if (!this.musicEnabled) this.music.stop(); }, 3000);
  }

  /** Briefly lower the music so a crowd roar or big moment comes through. */
  duckMusic(amount = 0.45, hold = 1.8) {
    if (!this.musicDuck) return;
    const g = this.musicDuck.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(amount, t, 0.08);
    g.setTargetAtTime(1, t + hold, 0.8);
  }

  /** Rising chord when the intro is skipped with a tap/key (the first moment audio can play). */
  sting() {
    if (this.ready && this.musicEnabled) this.music.sting();
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /**
   * Inactive (tab hidden, window blurred, page backgrounded): suspend the whole audio
   * graph. Looping crowd and wind noise stop with it and no new nodes are created, so
   * nothing piles up across tab switches.
   */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.appSuspended = true;
      this.ctx.suspend().catch(() => {});
    }
  }

  /** Active again: resume only what suspend() paused (never starts audio before a gesture). */
  resume() {
    if (this.ctx && this.appSuspended) {
      this.appSuspended = false;
      this.ctx.resume().catch(() => {});
    }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // ---------------------------------------------------------------- helpers
  noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  envelope(gainNode, t, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  filteredNoise({ type = 'bandpass', freq = 1000, q = 1, attack = 0.01, peak = 0.3, decay = 0.3, freqEnd = null, bus = null }) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = this.noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
    filter.Q.value = q;
    const gain = ctx.createGain();
    this.envelope(gain, t, attack, peak, decay);
    src.connect(filter).connect(gain).connect(bus ?? this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
  }

  tone({ type = 'sine', freq = 440, freqEnd = null, attack = 0.005, peak = 0.3, decay = 0.2, delay = 0, bus = null }) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
    const gain = ctx.createGain();
    this.envelope(gain, t, attack, peak, decay);
    osc.connect(gain).connect(bus ?? this.sfx);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  // ---------------------------------------------------------------- ambience
  /**
   * Stadium murmur: two softly filtered layers (low chatter left, brighter voices right)
   * that drift up and down independently every couple of seconds, like a real crowd,
   * instead of one steady hiss. A third layer swells with excitement (setCrowdLevel).
   */
  startAmbience() {
    const ctx = this.ctx;
    const layer = (freq, q, level, pan) => {
      const src = this.noiseSource();
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = freq;
      band.Q.value = q;
      const soft = ctx.createBiquadFilter();
      soft.type = 'lowpass';
      soft.frequency.value = 2200;
      const gain = ctx.createGain();
      gain.gain.value = level;
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) panner.pan.value = pan;
      src.connect(band).connect(soft).connect(gain);
      (panner ? gain.connect(panner) : gain).connect(this.crowd);
      src.start(0, Math.random() * 1.5);
      return { gain, level };
    };
    this.murmur = [layer(420, 0.7, 0.12, -0.35), layer(1150, 1.1, 0.065, 0.35)];
    this.excite = layer(850, 0.6, 0.0001, 0).gain;
    // Gentle random drift (a few times a second would sound nervous; every ~2 s is calm).
    this.driftTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      for (const m of this.murmur) m.gain.gain.setTargetAtTime(m.level * (0.65 + Math.random() * 0.7), t, 1.4);
    }, 2100);
  }

  /** Crowd excitement on top of the murmur: 0 = calm, 1 = roaring. */
  setCrowdLevel(level) {
    if (!this.excite) return;
    this.excite.gain.setTargetAtTime(0.0001 + level * 0.1, this.ctx.currentTime, 0.4);
  }

  // ---------------------------------------------------------------- effects
  kick(power = 0.5) {
    this.tone({ freq: 150, freqEnd: 45, peak: 0.6 + power * 0.4, decay: 0.16 });
    this.filteredNoise({ type: 'highpass', freq: 1800, peak: 0.25 + power * 0.25, attack: 0.002, decay: 0.05 });
  }

  bounce(strength = 0.5) {
    this.tone({ freq: 120, freqEnd: 55, peak: Math.min(0.5, 0.1 + strength * 0.4), decay: 0.1 });
    this.filteredNoise({ type: 'lowpass', freq: 900, peak: strength * 0.12, attack: 0.002, decay: 0.06 });
  }

  post() {
    for (const [f, p] of [[523, 0.22], [1316, 0.15], [2154, 0.1], [3260, 0.06]]) {
      this.tone({ type: 'sine', freq: f, freqEnd: f * 0.985, peak: p, decay: 0.9 });
    }
    this.filteredNoise({ type: 'highpass', freq: 2500, peak: 0.3, attack: 0.001, decay: 0.04 });
  }

  net() {
    this.filteredNoise({ type: 'bandpass', freq: 3200, q: 0.6, attack: 0.02, peak: 0.25, decay: 0.4, freqEnd: 1600 });
  }

  save() {
    this.tone({ freq: 95, freqEnd: 40, peak: 0.55, decay: 0.18 });
    this.filteredNoise({ type: 'bandpass', freq: 1400, q: 0.8, peak: 0.35, attack: 0.002, decay: 0.1 });
  }

  whistle(long = false) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = long ? 0.9 : 0.3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
    gain.gain.setValueAtTime(0.12, t + dur - 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const trem = ctx.createGain();
    trem.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 28;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.4;
    lfo.connect(lfoGain).connect(trem.gain);
    for (const f of [2750, 2790]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f;
      osc.connect(trem);
      osc.start(t);
      osc.stop(t + dur);
    }
    trem.connect(gain).connect(this.sfx);
    lfo.start(t);
    lfo.stop(t + dur);
  }

  cheer() {
    const bus = this.crowd;
    this.duckMusic(0.4, 2);
    this.filteredNoise({ type: 'bandpass', freq: 900, q: 0.7, attack: 0.25, peak: 0.5, decay: 2.8, bus });
    this.filteredNoise({ type: 'bandpass', freq: 2300, q: 1.2, attack: 0.35, peak: 0.2, decay: 2.2, bus });
    this.setCrowdLevel(1);
    setTimeout(() => this.setCrowdLevel(0), 2500);
  }

  groan() {
    this.filteredNoise({ type: 'lowpass', freq: 750, q: 1.5, attack: 0.2, peak: 0.36, decay: 1.3, freqEnd: 260, bus: this.crowd });
  }

  click() {
    this.tone({ type: 'triangle', freq: 880, freqEnd: 660, peak: 0.12, decay: 0.06 });
  }

  tick(urgent = false) {
    this.tone({ type: 'square', freq: urgent ? 1400 : 1000, peak: 0.05, decay: 0.05 });
  }

  charge(power) {
    this.tone({ type: 'sine', freq: 300 + power * 420, peak: 0.022, decay: 0.04 });
  }

  /** Bright ping layered on the kick for a Perfect Strike. */
  perfect() {
    this.tone({ type: 'triangle', freq: 1320, freqEnd: 1760, peak: 0.18, decay: 0.35 });
    this.tone({ type: 'sine', freq: 2640, peak: 0.08, decay: 0.5, delay: 0.03 });
    this.filteredNoise({ type: 'highpass', freq: 5000, peak: 0.12, attack: 0.002, decay: 0.15 });
  }

  /** Crowd "oooh" for near misses. */
  ooh() {
    this.duckMusic(0.6, 1);
    this.filteredNoise({ type: 'bandpass', freq: 450, q: 4, attack: 0.15, peak: 0.42, decay: 1.2, freqEnd: 320, bus: this.crowd });
    this.filteredNoise({ type: 'bandpass', freq: 900, q: 5, attack: 0.15, peak: 0.18, decay: 1.0, freqEnd: 650, bus: this.crowd });
  }

  /** Three rhythmic claps and a roar while a streak is on. */
  chant() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.filteredNoise({ type: 'bandpass', freq: 1800, q: 1.2, peak: 0.26, attack: 0.002, decay: 0.08, bus: this.crowd }), i * 260);
    }
    setTimeout(() => this.filteredNoise({ type: 'bandpass', freq: 700, q: 0.8, attack: 0.1, peak: 0.3, decay: 0.7, bus: this.crowd }), 820);
  }

  /** Low stadium horn for a boss keeper entrance. */
  horn() {
    this.tone({ type: 'sawtooth', freq: 110, peak: 0.12, attack: 0.08, decay: 1.3 });
    this.tone({ type: 'sawtooth', freq: 165, peak: 0.08, attack: 0.08, decay: 1.3 });
    this.tone({ type: 'sine', freq: 55, peak: 0.25, attack: 0.05, decay: 1.4 });
  }

  /** Sparkly arpeggio for collecting a sticker. */
  sticker() {
    [1046, 1318, 1568, 2093].forEach((f, i) => this.tone({ type: 'triangle', freq: f, peak: 0.12, decay: 0.3, delay: i * 0.07 }));
  }

  powerup() {
    this.tone({ type: 'sawtooth', freq: 220, freqEnd: 880, peak: 0.07, attack: 0.02, decay: 0.35 });
    this.tone({ type: 'sine', freq: 440, freqEnd: 1760, peak: 0.1, attack: 0.02, decay: 0.4 });
  }

  achievement() {
    this.tone({ type: 'triangle', freq: 784, peak: 0.12, decay: 0.25 });
    this.tone({ type: 'triangle', freq: 1175, peak: 0.12, decay: 0.45, delay: 0.12 });
  }

  /** Continuous wind noise, 0..1. */
  setWind(level) {
    if (!this.ready) return;
    if (!this.windGain) {
      const src = this.noiseSource();
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 420;
      hp.Q.value = 0.4;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      src.connect(hp).connect(this.windGain).connect(this.crowd);
      src.start();
    }
    this.windGain.gain.setTargetAtTime(level * 0.06, this.ctx.currentTime, 0.5);
  }
}
