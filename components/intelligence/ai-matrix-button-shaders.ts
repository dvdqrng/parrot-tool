/**
 * AI Matrix Button — Shader Sources & State Configs
 *
 * GLSL vertex/fragment shaders and pre-computed uniform values
 * for each OrbState. The fragment shader renders 3 concentric
 * rings of SDF circles + center dot + glow, all on the GPU.
 */

import { OrbState } from '@/hooks/use-orb-state';

// ============================================
// TYPES
// ============================================

export interface UniformValues {
  rotateSpeed: number;     // rad/s (0 = static)
  rotateDir: number;       // 1.0 or -1.0
  oscillate: number;       // 0.0 or 1.0 (error state)
  dotColor: [number, number, number];
  litColor: [number, number, number];
  pulseSpeed: number;      // cycles/s
  pulsePattern: number;    // 0=none,1=chase,2=sync,3=ripple,4=pairs,5=breathe
  peakScale: number;
  opacityMin: number;
  opacityMax: number;
  centerColor: [number, number, number];
  centerAlpha: number;     // 0 = no center dot
  centerPulse: number;     // 0 or 1
  centerPulseSpeed: number;
  glowColor: [number, number, number];
  glowOpacity: number;
}

export interface UniformLocations {
  u_time: WebGLUniformLocation | null;
  u_resolution: WebGLUniformLocation | null;
  u_rotateSpeed: WebGLUniformLocation | null;
  u_rotateDir: WebGLUniformLocation | null;
  u_oscillate: WebGLUniformLocation | null;
  u_dotColor: WebGLUniformLocation | null;
  u_litColor: WebGLUniformLocation | null;
  u_pulseSpeed: WebGLUniformLocation | null;
  u_pulsePattern: WebGLUniformLocation | null;
  u_peakScale: WebGLUniformLocation | null;
  u_opacity: WebGLUniformLocation | null;
  u_centerColor: WebGLUniformLocation | null;
  u_centerAlpha: WebGLUniformLocation | null;
  u_centerPulse: WebGLUniformLocation | null;
  u_centerPulseSpeed: WebGLUniformLocation | null;
  u_glowColor: WebGLUniformLocation | null;
  u_glowOpacity: WebGLUniformLocation | null;
}

// ============================================
// SIZE CONFIG
// ============================================

export const SIZE_CONFIG = {
  sm: { total: 24, maxRadius: 10, dotSize: 1.5, centerDot: 2 },
  md: { total: 30, maxRadius: 13, dotSize: 2, centerDot: 2.5 },
  lg: { total: 38, maxRadius: 17, dotSize: 2.5, centerDot: 3 },
};

// ============================================
// HEX → RGB UTILITY
// ============================================

export function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// ============================================
// PULSE PATTERN ENUM
// ============================================

const PULSE = {
  none: 0,
  chase: 1,
  sync: 2,
  ripple: 3,
  pairs: 4,
  breathe: 5,
} as const;

// ============================================
// STATE UNIFORM CONFIGS
// ============================================

export const STATE_UNIFORM_CONFIGS: Record<OrbState, UniformValues> = {
  // ── OFF: Dormant constellation — theme-aware colors set at runtime ──
  // dotColor/litColor/centerColor are overridden by the component:
  //   light mode → black dots, dark mode → white dots
  off: {
    rotateSpeed: 0,
    rotateDir: 1,
    oscillate: 0,
    dotColor: [0, 0, 0],                 // placeholder — overridden by theme
    litColor: [0, 0, 0],                 // placeholder — overridden by theme
    pulseSpeed: 0,
    pulsePattern: PULSE.none,
    peakScale: 1.0,
    opacityMin: 0.7,                     // strong visibility
    opacityMax: 0.7,
    centerColor: [0, 0, 0],             // placeholder — overridden by theme
    centerAlpha: 1.0,                    // fully opaque center dot
    centerPulse: 0,
    centerPulseSpeed: 0,
    glowColor: [0, 0, 0],
    glowOpacity: 0,
  },

  // ── IDLE: Calm eye — alive, watching, not demanding attention ──
  idle: {
    rotateSpeed: (2 * Math.PI) / 18,    // 18s per revolution — barely perceptible
    rotateDir: 1,
    oscillate: 0,
    dotColor: hexToVec3('#7C3AED'),      // purple-600
    litColor: hexToVec3('#A78BFA'),      // purple-400
    pulseSpeed: 1 / 4,                   // 4s cycle — slow organic breathing
    pulsePattern: PULSE.breathe,
    peakScale: 1.15,                     // subtle size variation
    opacityMin: 0.35,
    opacityMax: 0.65,
    centerColor: hexToVec3('#8B5CF6'),   // purple-500
    centerAlpha: 0.8,                    // solid anchor
    centerPulse: 0,
    centerPulseSpeed: 0,
    glowColor: [0, 0, 0],
    glowOpacity: 0,
  },

  // ── LISTENING: Intake mode — receiving & scanning messages ──
  listening: {
    rotateSpeed: (2 * Math.PI) / 8,     // 8s per revolution — noticeable
    rotateDir: 1,
    oscillate: 0,
    dotColor: hexToVec3('#8B5CF6'),      // violet-500
    litColor: hexToVec3('#C084FC'),      // violet-300
    pulseSpeed: 1 / 1.8,                // waves radiating outward
    pulsePattern: PULSE.ripple,
    peakScale: 1.3,
    opacityMin: 0.25,
    opacityMax: 0.9,
    centerColor: hexToVec3('#A855F7'),   // violet-500
    centerAlpha: 1,
    centerPulse: 1,
    centerPulseSpeed: 1 / 1.5,
    glowColor: hexToVec3('#A855F7'),
    glowOpacity: 0.08,
  },

  // ── THINKING: Active computation — LLM extraction or drafting ──
  thinking: {
    rotateSpeed: (2 * Math.PI) / 3,     // 3s per revolution — fast
    rotateDir: 1,
    oscillate: 0,
    dotColor: hexToVec3('#6366F1'),      // indigo-500
    litColor: hexToVec3('#60A5FA'),      // blue-400
    pulseSpeed: 1 / 0.9,                // rapid chase spiral
    pulsePattern: PULSE.chase,
    peakScale: 1.4,
    opacityMin: 0.2,
    opacityMax: 1.0,
    centerColor: hexToVec3('#818CF8'),   // indigo-400
    centerAlpha: 1,
    centerPulse: 1,
    centerPulseSpeed: 1 / 0.7,          // fast heartbeat
    glowColor: hexToVec3('#6366F1'),
    glowOpacity: 0.15,
  },

  // ── LEARNING: Eureka — new knowledge discovered ──
  learning: {
    rotateSpeed: (2 * Math.PI) / 6,     // 6s per revolution
    rotateDir: -1,                        // REVERSE — signals something new
    oscillate: 0,
    dotColor: hexToVec3('#A855F7'),      // purple-500
    litColor: hexToVec3('#FBBF24'),      // amber-400 — gold = discovery
    pulseSpeed: 1 / 1.3,                // knowledge radiating outward
    pulsePattern: PULSE.ripple,
    peakScale: 1.4,
    opacityMin: 0.3,
    opacityMax: 1.0,
    centerColor: hexToVec3('#F59E0B'),   // amber-500 — golden core
    centerAlpha: 1,
    centerPulse: 1,
    centerPulseSpeed: 1 / 1.2,
    glowColor: hexToVec3('#F59E0B'),
    glowOpacity: 0.12,
  },

  // ── READY: Active beacon — "Look at me, I have something for you!" ──
  ready: {
    rotateSpeed: (2 * Math.PI) / 5,     // 5s per revolution — energetic, draws attention
    rotateDir: -1,
    oscillate: 0,
    dotColor: hexToVec3('#6366F1'),      // indigo-500 — contrast base
    litColor: hexToVec3('#34D399'),      // emerald-400 — green chase lights
    pulseSpeed: 1 / 1.2,                // fast chase — urgent "look at me"
    pulsePattern: PULSE.chase,
    peakScale: 1.45,                     // large scale pops
    opacityMin: 0.2,
    opacityMax: 1.0,                     // full dynamic range
    centerColor: hexToVec3('#10B981'),   // emerald-500 — bright green beacon
    centerAlpha: 1,
    centerPulse: 1,
    centerPulseSpeed: 1 / 1.0,          // fast center heartbeat
    glowColor: hexToVec3('#34D399'),
    glowOpacity: 0.22,                   // strong glow — "something's here"
  },

  // ── ERROR: Red shake — something went wrong ──
  error: {
    rotateSpeed: (2 * Math.PI) / 0.5,   // very fast oscillation
    rotateDir: 1,
    oscillate: 1,                         // ±20° shake
    dotColor: hexToVec3('#EF4444'),      // red-500
    litColor: hexToVec3('#FCA5A5'),      // red-300
    pulseSpeed: 1 / 0.4,                // all dots flash together
    pulsePattern: PULSE.sync,
    peakScale: 1.25,
    opacityMin: 0.5,
    opacityMax: 1.0,
    centerColor: hexToVec3('#EF4444'),
    centerAlpha: 1,
    centerPulse: 1,
    centerPulseSpeed: 1 / 0.35,
    glowColor: hexToVec3('#EF4444'),
    glowOpacity: 0.18,
  },
};

// ============================================
// VERTEX SHADER
// ============================================

export const VERT_SRC = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// ============================================
// FRAGMENT SHADER
// ============================================

export const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform float u_resolution;       // canvas pixel size (physical pixels)
uniform float u_rotateSpeed;
uniform float u_rotateDir;
uniform float u_oscillate;
uniform vec3  u_dotColor;
uniform vec3  u_litColor;
uniform float u_pulseSpeed;
uniform int   u_pulsePattern;
uniform float u_peakScale;
uniform vec2  u_opacity;
uniform vec3  u_centerColor;
uniform float u_centerAlpha;
uniform float u_centerPulse;
uniform float u_centerPulseSpeed;
uniform vec3  u_glowColor;
uniform float u_glowOpacity;

// Ring layout: 3 rings with 6, 10, 14 dots
// Work in pixel coordinates centered at (0,0) for clarity.
// MAX_R is the outermost ring radius in pixels — set as fraction of canvas.
const int   RING_COUNTS[3]  = int[3](6, 10, 14);
const float RING_RADII[3]   = float[3](0.30, 0.60, 0.92);
const float TAU             = 6.283185307;

float computePulsePhase(int pattern, int ring, int idx, int count) {
  float t = u_time * u_pulseSpeed;
  float fi = float(idx) / float(count);
  float fr = float(ring) / 3.0;

  // 0 = none
  if (pattern == 0) return 0.0;

  // 1 = chase: sequential spiral
  if (pattern == 1) {
    float delay = fr * 0.15 + fi * 0.85;
    return 0.5 + 0.5 * sin((t - delay) * TAU);
  }

  // 2 = sync: all together
  if (pattern == 2) {
    return 0.5 + 0.5 * sin(t * TAU);
  }

  // 3 = ripple: inner to outer
  if (pattern == 3) {
    return 0.5 + 0.5 * sin((t - fr) * TAU);
  }

  // 4 = pairs: opposite dots synchronized
  if (pattern == 4) {
    int hc = count / 2;
    float delay = fr * 0.2 + float(idx - (idx / hc) * hc) / float(hc) * 0.8;
    return 0.5 + 0.5 * sin((t - delay) * TAU);
  }

  // 5 = breathe: organic pseudo-random offsets
  if (pattern == 5) {
    float pseudo = mod(float(ring * 7 + idx * 13 + 3), 17.0) / 17.0 * 0.3;
    return 0.5 + 0.5 * sin((t - pseudo) * TAU);
  }

  return 0.0;
}

void main() {
  // Convert UV (0..1) to pixel coordinates centered at origin
  float res = u_resolution;
  vec2 px = (v_uv - 0.5) * res;  // range: -res/2 .. +res/2

  // Layout sizes in physical pixels
  float maxR = res * 0.43;       // outermost ring radius
  float dotR = res * 0.038;      // base dot radius (~2.3px at 60px canvas)
  float centerR = res * 0.038;   // center dot — same size as ring dots for consistency

  // Anti-aliasing: 1 pixel edge softness
  float aaWidth = 1.0;

  float distCenter = length(px);

  // All compositing in premultiplied alpha space:
  //   rgb stores color * alpha, a stores alpha.
  //   Porter-Duff over: dst = src + dst * (1 - srcA)

  // Background glow (soft, large radius)
  float glowFalloff = smoothstep(maxR * 1.2, 0.0, distCenter);
  float glowPulse = 0.7 + 0.3 * sin(u_time * u_pulseSpeed * TAU * 0.5);
  float glowA = glowFalloff * u_glowOpacity * glowPulse;
  vec4 color = vec4(u_glowColor * glowA, glowA);

  // Compute rotation angle
  float angle;
  if (u_oscillate > 0.5) {
    angle = sin(u_time * u_rotateSpeed) * 0.349;
  } else {
    angle = u_time * u_rotateSpeed * u_rotateDir;
  }

  float ca = cos(angle);
  float sa = sin(angle);
  mat2 rot = mat2(ca, -sa, sa, ca);

  // Render ring dots
  for (int ring = 0; ring < 3; ring++) {
    int count = RING_COUNTS[ring];
    float ringR = RING_RADII[ring] * maxR;

    for (int i = 0; i < 14; i++) {
      if (i >= count) break;

      float theta = float(i) / float(count) * TAU - TAU * 0.25;
      vec2 localPos = vec2(cos(theta), sin(theta)) * ringR;
      vec2 dotPos = rot * localPos;

      float phase = computePulsePhase(u_pulsePattern, ring, i, count);

      float sizeScale = mix(1.0, u_peakScale, phase);
      float r = dotR * sizeScale;
      float op = mix(u_opacity.x, u_opacity.y, phase);
      vec3 col = mix(u_dotColor, u_litColor, phase);

      // SDF circle — distance in pixels, 1px AA
      float d = length(px - dotPos) - r;
      float mask = 1.0 - smoothstep(-aaWidth, aaWidth, d);

      // Premultiplied over composite
      float a = mask * op;
      color = color * (1.0 - a) + vec4(col * a, a);
    }
  }

  // Center dot — matches ring dot style, with optional pulse overlay
  if (u_centerAlpha > 0.01) {
    float cPhase = u_centerPulse > 0.5
      ? 0.5 + 0.5 * sin(u_time * u_centerPulseSpeed * TAU)
      : 0.0;
    float cSize = centerR * mix(1.0, 1.4, cPhase);
    float cOp = mix(u_opacity.x, u_opacity.y, cPhase) * u_centerAlpha;
    vec3 cCol = mix(u_centerColor, u_litColor, cPhase * 0.5);

    float d = length(px) - cSize;
    float mask = 1.0 - smoothstep(-aaWidth, aaWidth, d);

    float a = mask * cOp;
    color = color * (1.0 - a) + vec4(cCol * a, a);
  }

  // Already premultiplied — output directly
  fragColor = color;
}
`;
