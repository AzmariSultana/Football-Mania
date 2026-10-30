import * as THREE from 'three';

/**
 * Keyboard and pointer state (replaces the python GLUT keyboard/special/mouse listeners).
 * Discrete actions are forwarded through `handlers`; held keys are polled with isDown().
 */
export class Input {
  constructor(canvas, handlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.keys = new Set();
    this.pointer = new THREE.Vector2();
    this.pointerActive = false;
    this.delta = new THREE.Vector2(); // accumulated movement in pixels, consumed by the game

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) handlers.onKeyDown?.(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      handlers.onKeyUp?.(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      handlers.onBlur?.();
    });

    canvas.addEventListener('pointermove', (e) => {
      this.updatePointer(e);
      this.delta.x += e.movementX || 0;
      this.delta.y += e.movementY || 0;
      this.pointerActive = true;
      handlers.onPointerMove?.();
    });
    canvas.addEventListener('pointerdown', (e) => {
      this.updatePointer(e);
      canvas.setPointerCapture?.(e.pointerId);
      handlers.onPointerDown?.(e.button);
    });
    canvas.addEventListener('pointerup', (e) => {
      handlers.onPointerUp?.(e.button);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      handlers.onWheel?.(Math.sign(e.deltaY));
    }, { passive: false });
  }

  updatePointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /**
   * Poll the first connected gamepad (standard mapping). Returns null when none.
   * `pressed` holds buttons that went down since the last poll.
   */
  pollGamepad() {
    if (!navigator.getGamepads) return null;
    let pad = null;
    for (const p of navigator.getGamepads()) {
      if (p && p.connected) { pad = p; break; }
    }
    if (!pad) return null;
    // Reuse the same objects every frame (this runs at the display refresh rate).
    const s = this.padState ??= { aimX: 0, aimY: 0, camX: 0, camY: 0, charge: false, pressed: new Set(), prev: [] };
    s.pressed.clear();
    for (let i = 0; i < pad.buttons.length; i++) {
      const b = pad.buttons[i];
      const down = b.pressed || b.value > 0.5;
      if (down && !s.prev[i]) s.pressed.add(i);
      s.prev[i] = down;
    }
    const dead = (v = 0) => (Math.abs(v) < 0.15 ? 0 : v);
    s.aimX = dead(pad.axes[0]);
    s.aimY = dead(pad.axes[1]);
    s.camX = dead(pad.axes[2]);
    s.camY = dead(pad.axes[3]);
    s.charge = !!(s.prev[7] || s.prev[0]); // RT or A
    return s;
  }
}

// Standard gamepad button indices.
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, RT: 7, START: 9 };
