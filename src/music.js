// Generative soundtrack, synthesised live with the Web Audio API (no audio files).
//
// Designed for long sessions: a warm pad, soft bass, a gentle plucked arpeggio and light
// drums at a relaxed 100 BPM in D major. Progressions, arpeggio patterns, register and
// arrangement change every few bars, so it never repeats a loop note for note.
//
//   'relaxed' (menus):  slow harmony (2 bars per chord); ambient sections alternate with
//                       sections that add a soft beat, so it stays calm but motivating.
//   'groove'  (matches): a chord per bar and a steady, quiet beat under the action.

const BPM = 100;
const STEP = 60 / BPM / 4;          // one 16th note, in seconds
const LOOKAHEAD = 0.3;              // schedule this far ahead of currentTime
const ROOT = 62;                    // D4

// Diatonic triads in D major, as semitones above the root.
const CHORDS = {
  I: [0, 4, 7], ii: [2, 5, 9], iii: [4, 7, 11], IV: [5, 9, 12], V: [7, 11, 14], vi: [9, 12, 16],
};
const PROGRESSIONS = [
  ['I', 'V', 'vi', 'IV'], ['vi', 'IV', 'I', 'V'], ['IV', 'I', 'V', 'vi'],
  ['I', 'vi', 'IV', 'V'], ['ii', 'V', 'I', 'vi'], ['I', 'iii', 'IV', 'V'],
];
// 16-step arpeggio patterns: index into the chord tones, -1 = rest.
const ARPS = [
  [0, -1, 1, -1, 2, -1, 1, -1, 0, -1, 1, -1, 3, -1, 2, -1],
  [0, -1, -1, 2, -1, -1, 1, -1, 3, -1, -1, 2, -1, 1, -1, -1],
  [2, -1, 1, -1, 0, -1, 1, -1, 2, -1, 3, -1, 1, -1, -1, -1],
  [0, -1, 2, 1, -1, -1, 3, -1, 0, -1, 2, -1, 1, -1, -1, -1],
];

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
const pick = (list) => list[(Math.random() * list.length) | 0];

export class Music {
  /** @param {AudioContext} ctx  @param {AudioNode} out  @param {AudioBuffer} noise */
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.noise = noise;
    this.mode = 'relaxed';
    this.playing = false;

    // Bus: instruments → (dry + reverb + echo) → out
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(out);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.4);
    const rvGain = ctx.createGain();
    rvGain.gain.value = 0.32;
    this.reverb.connect(rvGain).connect(this.bus);
    // Dotted-8th echo for the arpeggio shimmer.
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = STEP * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.35;
    this.echo.connect(fb).connect(this.echo);
    this.echo.connect(echoOut).connect(this.bus);

    // Pad filter (opens a little in matches for energy).
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 1100;
    this.padFilter.Q.value = 0.4;
    this.padFilter.connect(this.bus);
    this.padFilter.connect(this.reverb);
  }

  makeImpulse(seconds) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    return buf;
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.bar = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.newSection();
    this.timer = setInterval(() => this.schedule(), 60);
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.padFilter.frequency.setTargetAtTime(mode === 'groove' ? 1500 : 1100, this.ctx.currentTime, 1.5);
  }

  /** A new 8-bar section: progression, arpeggio pattern, register and whether drums play. */
  newSection() {
    this.progression = pick(PROGRESSIONS);
    this.arp = pick(ARPS);
    this.arpOctave = Math.random() < 0.6 ? 12 : 24;
    this.sectionIndex = (this.sectionIndex ?? -1) + 1;
    // Menus alternate an ambient section with a gently driven one; matches keep the beat.
    this.beat = this.mode === 'groove' ? true : this.sectionIndex % 2 === 1;
    this.colour = Math.random() < 0.5; // add a 9th to the pad for colour
  }

  /** Called on a timer; schedules every 16th note that falls inside the lookahead window. */
  schedule() {
    if (!this.playing || this.ctx.state !== 'running') return;
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    // After a long stall (tab suspended), jump forward instead of bursting old notes.
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < horizon) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step++;
      if (this.step % 16 === 0) {
        this.bar++;
        if (this.bar % 8 === 0) this.newSection();
      }
    }
  }

  playStep(step, t) {
    const s16 = step % 16;
    const barsPerChord = this.mode === 'groove' ? 1 : 2;
    const chordIndex = Math.floor(this.bar / barsPerChord) % this.progression.length;
    const chord = CHORDS[this.progression[chordIndex]];
    const chordStart = s16 === 0 && this.bar % barsPerChord === 0;

    if (chordStart) {
      const dur = barsPerChord * 16 * STEP;
      this.pad(chord, t, dur);
      this.bass(chord[0], t, dur);
    }
    // Arpeggio: sparse and soft; a little randomness keeps it alive.
    const idx = this.arp[s16];
    if (idx >= 0 && Math.random() < (this.mode === 'groove' ? 0.7 : 0.85)) {
      const tones = [...chord, chord[0] + 12];
      this.pluck(ROOT + tones[idx % tones.length] + this.arpOctave - 12, t);
    }
    // Drums only in "beat" sections, always gentle.
    if (this.beat) {
      if (s16 === 0 || (this.mode === 'groove' && s16 === 8)) this.kick(t);
      if (s16 % 4 === 2) this.hat(t, s16 === 14 ? 0.035 : 0.025);
      if (this.mode === 'groove' && (s16 === 4 || s16 === 12)) this.clap(t);
    }
  }

  // ---------------------------------------------------------------- instruments
  pad(chord, t, dur) {
    const ctx = this.ctx;
    const notes = this.colour ? [...chord, chord[0] + 14] : chord;
    for (const n of notes) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midiHz(ROOT + n - 12);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.03, t + 1.2);           // slow swell
        g.gain.setValueAtTime(0.03, t + dur - 0.2);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.6);   // long release overlaps the next chord
        osc.connect(g).connect(this.padFilter);
        osc.start(t);
        osc.stop(t + dur + 1.7);
      }
    }
  }

  bass(n, t, dur) {
    const ctx = this.ctx;
    const hits = this.mode === 'groove' ? [0, 0.5] : [0];
    for (const h of hits) {
      const start = t + h * dur;
      const len = (this.mode === 'groove' ? 0.5 : 1) * dur;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midiHz(ROOT + n - 24);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.11, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.05, start + 0.4);
      g.gain.setValueAtTime(0.05, start + len - 0.15);
      g.gain.linearRampToValueAtTime(0.0001, start + len);
      osc.connect(g).connect(this.bus);
      osc.start(start);
      osc.stop(start + len + 0.05);
    }
  }

  pluck(m, t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiHz(m);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.3);
    const g = ctx.createGain();
    const peak = this.mode === 'groove' ? 0.035 : 0.045;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(f).connect(g);
    g.connect(this.bus);
    g.connect(this.echo);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  kick(t) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(this.mode === 'groove' ? 0.16 : 0.11, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  noiseHit(t, { type, freq, q = 0.8, peak, decay }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + decay + 0.02);
  }

  hat(t, peak) {
    this.noiseHit(t, { type: 'highpass', freq: 7000, peak, decay: 0.05 });
  }

  clap(t) {
    this.noiseHit(t, { type: 'bandpass', freq: 1600, q: 1.1, peak: 0.05, decay: 0.12 });
  }

  /** Short rising sting for the intro (played once when audio unlocks on the splash). */
  sting() {
    const ctx = this.ctx, t = ctx.currentTime + 0.02;
    [0, 4, 7, 12].forEach((n, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiHz(ROOT + n);
      const g = ctx.createGain();
      const start = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.06, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
      osc.connect(g);
      g.connect(this.bus);
      g.connect(this.reverb);
      osc.start(start);
      osc.stop(start + 1.5);
    });
  }
}
