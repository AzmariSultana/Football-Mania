import * as THREE from 'three';

const STRIDE = 7;          // position xyz + quaternion xyzw
const SAMPLE_RATE = 60;    // samples per second, independent of the display refresh rate
const MAX_SECONDS = 10;    // longest kick: run-up + 6 s flight timeout + tail
const MAX_FRAMES = SAMPLE_RATE * MAX_SECONDS;
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();

/**
 * Records the transforms of a fixed set of objects during a kick and plays
 * them back with interpolation, for slow-motion goal replays. Samples at a
 * fixed rate into one preallocated buffer, so there is no per-frame allocation
 * and the recording length doesn't depend on the monitor's refresh rate.
 */
export class Replay {
  constructor(objects) {
    this.objects = objects;
    this.frameSize = objects.length * STRIDE;
    this.buffer = new Float32Array(MAX_FRAMES * this.frameSize);
    this.times = new Float32Array(MAX_FRAMES);
    this.count = 0;
    this.recording = false;
    this.elapsed = 0;
  }

  start() {
    this.count = 0;
    this.elapsed = 0;
    this.nextSample = 0;
    this.recording = true;
    this.capture(0);
  }

  stop() {
    this.recording = false;
  }

  /** Advance the recording clock and take a sample when one is due. */
  capture(dt) {
    if (!this.recording) return;
    this.elapsed += dt;
    if (this.elapsed < this.nextSample || this.count >= MAX_FRAMES) return;
    this.nextSample = this.elapsed + 1 / SAMPLE_RATE;
    const base = this.count * this.frameSize;
    for (let i = 0; i < this.objects.length; i++) {
      const o = this.objects[i];
      o.position.toArray(this.buffer, base + i * STRIDE);
      o.quaternion.toArray(this.buffer, base + i * STRIDE + 3);
    }
    this.times[this.count] = this.elapsed;
    this.count++;
  }

  get duration() {
    return this.count ? this.times[this.count - 1] : 0;
  }

  apply(time) {
    const n = this.count;
    if (n < 2) return;
    let i = 0;
    while (i < n - 2 && this.times[i + 1] < time) i++;
    const t0 = this.times[i], t1 = this.times[i + 1];
    const k = Math.min(1, Math.max(0, (time - t0) / Math.max(1e-5, t1 - t0)));
    const a = i * this.frameSize, b = (i + 1) * this.frameSize, buf = this.buffer;
    for (let j = 0; j < this.objects.length; j++) {
      const o = this.objects[j];
      const p = j * STRIDE;
      o.position.set(
        buf[a + p] + (buf[b + p] - buf[a + p]) * k,
        buf[a + p + 1] + (buf[b + p + 1] - buf[a + p + 1]) * k,
        buf[a + p + 2] + (buf[b + p + 2] - buf[a + p + 2]) * k,
      );
      _qa.fromArray(buf, a + p + 3);
      _qb.fromArray(buf, b + p + 3);
      o.quaternion.slerpQuaternions(_qa, _qb, k);
    }
  }
}
