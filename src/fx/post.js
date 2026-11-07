import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { damp } from '../config.js';

// Broadcast-style colour grade, applied after tone mapping (display space):
// navy-tinted shadows, warm highlights, a soft S-curve, vignette and fine film grain.
// Replaces non-finite or negative colours with black and caps runaway highlights.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // Test the IEEE bit pattern (exponent all ones = NaN or Inf). Unlike isnan(), which
      // compilers may assume can never be true and fold away, this can't be optimised out.
      uvec3 bits = floatBitsToUint(c) & uvec3(0x7fffffffu);
      if (any(greaterThanEqual(bits, uvec3(0x7f800000u)))) c = vec3(0.0);
      // Negative colours and runaway highlights also break bloom: keep a sane range.
      c = min(max(c, vec3(0.0)), vec3(64.0));
      gl_FragColor = vec4(c, 1.0);
    }`,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.3 },
    uSaturation: { value: 1.08 },
    uGrain: { value: 0.018 },
    uTint: { value: 1 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uSaturation, uGrain, uTint;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      // Split tone
      float shadow = 1.0 - smoothstep(0.0, 0.45, l);
      float high = smoothstep(0.55, 1.0, l);
      col += vec3(-0.010, 0.006, 0.040) * shadow * uTint;
      col *= mix(vec3(1.0), vec3(1.035, 1.0, 0.95), high * uTint);
      // Gentle S-curve for contrast
      col = clamp(col, 0.0, 1.0);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);
      // Vignette
      vec2 d = (vUv - 0.5) * vec2(1.15, 1.0);
      col *= mix(1.0 - uVignette, 1.0, 1.0 - smoothstep(0.18, 0.82, length(d))); // edges in order: reversed smoothstep is undefined
      // Grain
      float n = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * uGrain;
      gl_FragColor = vec4(col, tex.a);
    }`,
};

/**
 * Post-processing chain. Quality:
 *  - low:    plain render, no post
 *  - medium: bloom + colour grade (+ depth of field on the menu)
 *  - high:   medium + ground-truth ambient occlusion
 */
export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = 'high';
    this.menu = 0;          // 0..1 blend of the cinematic menu look
    this.menuTarget = 0;
    this.focus = 900;
    this.time = 0;

    const size = renderer.getSize(new THREE.Vector2());
    const composer = new EffectComposer(renderer);
    this.composer = composer;

    this.renderPass = new RenderPass(scene, camera);
    composer.addPass(this.renderPass);

    // Firewall between the scene and the effects: any NaN / Inf / negative pixel a shader
    // produces (mobile GPUs differ from desktop on edge cases) is neutralised here, before
    // AO, depth of field and especially bloom, whose mip chain would grow one bad pixel
    // into large black rectangles.
    this.sanitize = new ShaderPass(SanitizeShader);
    composer.addPass(this.sanitize);

    this.gtao = new GTAOPass(scene, camera, size.x, size.y);
    this.gtao.blendIntensity = 0.85;
    this.gtao.updateGtaoMaterial({
      radius: 26, distanceExponent: 1.4, thickness: 18, scale: 1.1, samples: 12, distanceFallOff: 0.6,
    });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    composer.addPass(this.gtao);

    this.bokeh = new BokehPass(scene, camera, { focus: 900, aperture: 0.000006, maxblur: 0.0065 });
    composer.addPass(this.bokeh);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.55, 0.92);
    composer.addPass(this.bloom);

    composer.addPass(new OutputPass());

    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);

    // AO and depth of field re-render the scene with an override material, which would
    // turn light shafts, haze, sprites and particles into solid geometry. Hide everything
    // that doesn't write depth while those passes draw.
    const hidden = [];
    const wrap = (pass) => {
      const render = pass.render.bind(pass);
      pass.render = (...args) => {
        scene.traverseVisible((o) => {
          const m = o.material;
          if (m && !Array.isArray(m) && m.depthWrite === false) hidden.push(o);
        });
        for (const o of hidden) o.visible = false;
        try {
          render(...args);
        } finally {
          for (const o of hidden) o.visible = true;
          hidden.length = 0;
        }
      };
    };
    wrap(this.gtao);
    wrap(this.bokeh);

    this.setQuality('high');
  }

  setQuality(q) {
    this.quality = q;
    this.gtao.enabled = q === 'high' && !this.powerSave;
  }

  /** Battery saver: skip ambient occlusion (an extra full scene pass every frame). */
  setPowerSave(on) {
    this.powerSave = on;
    this.setQuality(this.quality);
  }

  /** Blend towards (or away from) the menu look: depth of field, deeper vignette, stronger bloom. */
  setMenu(on) {
    this.menuTarget = on ? 1 : 0;
  }

  setFocus(distance) {
    this.focus = distance;
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
  }

  setPixelRatio(r) {
    this.composer.setPixelRatio(r);
  }

  render(dt) {
    if (this.quality === 'low') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.time += dt;
    this.menu += (this.menuTarget - this.menu) * damp(2.2, dt);
    const m = this.menu;

    this.bokeh.enabled = m > 0.02;
    const u = this.bokeh.uniforms;
    u.focus.value = this.focus;
    u.aperture.value = 0.0000032 * m;
    u.maxblur.value = 0.0042 * m;

    this.bloom.strength = 0.36 + m * 0.24;
    this.bloom.threshold = 0.9 - m * 0.12;

    const g = this.grade.uniforms;
    g.uTime.value = this.time % 100;
    g.uVignette.value = 0.22 + m * 0.2;
    g.uTint.value = 0.7 + m * 0.3;

    this.composer.render(dt);
  }
}
