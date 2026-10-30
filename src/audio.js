// Procedural sound effects with the Web Audio API, so the game needs no audio files.

const STORAGE_KEY = 'footballMania.muted';

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem(STORAGE_KEY) === '1'; } catch { /* storage unavailable */ }
  }

  /** Browsers only allow audio after a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
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

    this.startAmbience();
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
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

  filteredNoise({ type = 'bandpass', freq = 1000, q = 1, attack = 0.01, peak = 0.3, decay = 0.3, freqEnd = null }) {
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
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
  }

  tone({ type = 'sine', freq = 440, freqEnd = null, attack = 0.005, peak = 0.3, decay = 0.2, delay = 0 }) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
    const gain = ctx.createGain();
    this.envelope(gain, t, attack, peak, decay);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  // ---------------------------------------------------------------- ambience
  startAmbience() {
    const ctx = this.ctx;
    const src = this.noiseSource();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 650;
    band.Q.value = 0.5;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1800;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.23;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain).connect(this.ambientGain.gain);
    src.connect(band).connect(low).connect(this.ambientGain).connect(this.master);
    src.start();
    lfo.start();
  }

  /** 0 = calm, 1 = roaring. */
  setCrowdLevel(level) {
    if (!this.ambientGain) return;
    this.ambientGain.gain.setTargetAtTime(0.04 + level * 0.12, this.ctx.currentTime, 0.4);
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
    trem.connect(gain).connect(this.master);
    lfo.start(t);
    lfo.stop(t + dur);
  }

  cheer() {
    this.filteredNoise({ type: 'bandpass', freq: 900, q: 0.7, attack: 0.25, peak: 0.55, decay: 2.8 });
    this.filteredNoise({ type: 'bandpass', freq: 2300, q: 1.2, attack: 0.35, peak: 0.25, decay: 2.2 });
    this.setCrowdLevel(1);
    setTimeout(() => this.setCrowdLevel(0), 2500);
  }

  groan() {
    this.filteredNoise({ type: 'lowpass', freq: 750, q: 1.5, attack: 0.2, peak: 0.4, decay: 1.3, freqEnd: 260 });
  }

  click() {
    this.tone({ type: 'triangle', freq: 880, freqEnd: 660, peak: 0.12, decay: 0.06 });
  }

  tick(urgent = false) {
    this.tone({ type: 'square', freq: urgent ? 1400 : 1000, peak: 0.05, decay: 0.05 });
  }

  charge(power) {
    this.tone({ type: 'sine', freq: 300 + power * 500, peak: 0.03, decay: 0.04 });
  }

  /** Bright ping layered on the kick for a Perfect Strike. */
  perfect() {
    this.tone({ type: 'triangle', freq: 1320, freqEnd: 1760, peak: 0.18, decay: 0.35 });
    this.tone({ type: 'sine', freq: 2640, peak: 0.08, decay: 0.5, delay: 0.03 });
    this.filteredNoise({ type: 'highpass', freq: 5000, peak: 0.12, attack: 0.002, decay: 0.15 });
  }

  /** Crowd "oooh" for near misses. */
  ooh() {
    this.filteredNoise({ type: 'bandpass', freq: 450, q: 4, attack: 0.15, peak: 0.45, decay: 1.2, freqEnd: 320 });
    this.filteredNoise({ type: 'bandpass', freq: 900, q: 5, attack: 0.15, peak: 0.2, decay: 1.0, freqEnd: 650 });
  }

  /** Three rhythmic claps and a roar while a streak is on. */
  chant() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.filteredNoise({ type: 'bandpass', freq: 1800, q: 1.2, peak: 0.3, attack: 0.002, decay: 0.08 }), i * 260);
    }
    setTimeout(() => this.filteredNoise({ type: 'bandpass', freq: 700, q: 0.8, attack: 0.1, peak: 0.35, decay: 0.7 }), 820);
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
      src.connect(hp).connect(this.windGain).connect(this.master);
      src.start();
    }
    this.windGain.gain.setTargetAtTime(level * 0.06, this.ctx.currentTime, 0.5);
  }
}
