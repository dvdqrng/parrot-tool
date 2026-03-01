/**
 * AI Matrix Button — Shader Sources & State Configs
 *
 * GLSL vertex/fragment shaders and pre-computed uniform values
 * for each OrbState. The fragment shader renders 3 concentric
 * rings of SDF circles + center dot + glow, all on the GPU.
 */

// ============================================
// TYPES
// ============================================

export type OrbState =
  | 'off'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'learning'
  | 'ready'
  | 'error';

export interface UniformValues {
  rotateSpeed: number;
  rotateDir: number;
  oscillate: number;
  dotColor: [number, number, number];
  litColor: [number, number, number];
  pulseSpeed: number;
  pulsePattern: number;
  peakScale: number;
  opacityMin: number;
  opacityMax: number;
  centerColor: [number, number, number];
  centerAlpha: number;
  centerPulse: number;
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
  off: {
    rotateSpeed: 0,
    rotateDir: 1,
    oscillate: 0,
    dotColor: [0, 0, 0],
    litColor: [0, 0, 0],
    pulseSpeed: 0,
    pulsePattern: PULSE.none,
    peakScale: 1.0,
    opacityMin: 0.7,
    opacityMax: 0.7,
    centerColor: [0, 0, 0],
    centerAlpha: 1.0,
    centerPulse: 0,
    centerPulseSpeed: 0,
    glowColor: [0, 0, 0],
    glowOpacity: 0,
  },

  idle: {
    rotateSpeed: (2 * Math.PI) / 18,
    rotateDir: 1,
    oscillate: 0,
    dotColor: hexToVec3('#7C3AED'),
    litColor: hexToVec3('#A78BFA'),
    pulseSpeed: 1 / 4,
    pulsePattern: PULSE.breathe,
    peakScale: 1.15,
    opacityMin: 0.35,
    opacityMax: 0.65,
    centerColor: hexToVec3('#8B5CF6'),
    centerAlpha: 0.8,
    centerPulse: 0,
    centerPulseSpeed: 0,
    glowColor: [0, 0, 0],
    glowOpacity: 0,
  },

  listening: {
    rotateSpeed: (2 * Math.PI) / 8,
    rotateDir: 1,
    oscillate: 0,
    dotColor: hexToVec3('#8B5CF6'),
    litColor: hexToVec3('#C084FC'),
    pulseSpeed: 1 / 1.8,
    pulsePattern: PULSE.ripple,
    peakScale: 1.3,
    opacityMin: 0.25,
    opacityMax: 0.9,
    centerColor: hexToVec3('#A855F7'),
    centerAlpha: 1,
    centerPulse: 1,
    centerPulseSpeed: 1 / 1.5,
    glowColor: hexToVec3('#A855F7'),
    glowOpacity: 0.08,
  },

  thinking: {
    rotateSpeed: (2 * Math.PI) / 3,
    rotateDir: 1,
    oscillate: 0,
    dotColor: hexToVec3('#6366F1'),
    litColor: hexToVec3('#60A5FA'),
    pulseSpeed: 1 / 0.9,
    pulsePattern: PULSE.chase,
    peakScale: 1.4,
    opacityMin: 0.2,
    opacityMax: 1.0,
    centerColor: hexToVec3('#818CF8'),
    centerAlpha: 1,
    centerPulse: 1,
    centerPulseSpeed: 1 / 0.7,
    glowColor: hexToVec3('#6366F1'),
    glowOpacity: 0.15,
  },

  learning: {
    rotateSpeed: (2 * Math.PI) / 6,
    rotateDir: -1,
    oscillate: 0,
    dotColor: hexToVec3('#A855F7'),
    litColor: hexToVec3('#FBBF24'),
    pulseSpeed: 1 / 1.3,
    pulsePattern: PULSE.ripple,
    peakScale: 1.4,
    opacityMin: 0.3,
    opacityMax: 1.0,
    centerColor: hexToVec3('#F59E0B'),
    centerAlpha: 1,
    centerPulse: 1,
    centerPulseSpeed: 1 / 1.2,
    glowColor: hexToVec3('#F59E0B'),
    glowOpacity: 0.12,
  },

  ready: {
    rotateSpeed: (2 * Math.PI) / 5,
    rotateDir: -1,
    oscillate: 0,
    dotColor: hexToVec3('#6366F1'),
    litColor: hexToVec3('#34D399'),
    pulseSpeed: 1 / 1.2,
    pulsePattern: PULSE.chase,
    peakScale: 1.45,
    opacityMin: 0.2,
    opacityMax: 1.0,
    centerColor: hexToVec3('#10B981'),
    centerAlpha: 1,
    centerPulse: 1,
    centerPulseSpeed: 1 / 1.0,
    glowColor: hexToVec3('#34D399'),
    glowOpacity: 0.22,
  },

  error: {
    rotateSpeed: (2 * Math.PI) / 0.5,
    rotateDir: 1,
    oscillate: 1,
    dotColor: hexToVec3('#EF4444'),
    litColor: hexToVec3('#FCA5A5'),
    pulseSpeed: 1 / 0.4,
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
uniform float u_resolution;
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

const int   RING_COUNTS[3]  = int[3](6, 10, 14);
const float RING_RADII[3]   = float[3](0.30, 0.60, 0.92);
const float TAU             = 6.283185307;

float computePulsePhase(int pattern, int ring, int idx, int count) {
  float t = u_time * u_pulseSpeed;
  float fi = float(idx) / float(count);
  float fr = float(ring) / 3.0;

  if (pattern == 0) return 0.0;

  if (pattern == 1) {
    float delay = fr * 0.15 + fi * 0.85;
    return 0.5 + 0.5 * sin((t - delay) * TAU);
  }

  if (pattern == 2) {
    return 0.5 + 0.5 * sin(t * TAU);
  }

  if (pattern == 3) {
    return 0.5 + 0.5 * sin((t - fr) * TAU);
  }

  if (pattern == 4) {
    int hc = count / 2;
    float delay = fr * 0.2 + float(idx - (idx / hc) * hc) / float(hc) * 0.8;
    return 0.5 + 0.5 * sin((t - delay) * TAU);
  }

  if (pattern == 5) {
    float pseudo = mod(float(ring * 7 + idx * 13 + 3), 17.0) / 17.0 * 0.3;
    return 0.5 + 0.5 * sin((t - pseudo) * TAU);
  }

  return 0.0;
}

void main() {
  float res = u_resolution;
  vec2 px = (v_uv - 0.5) * res;

  float maxR = res * 0.43;
  float dotR = res * 0.038;
  float centerR = res * 0.038;

  float aaWidth = 1.0;

  float distCenter = length(px);

  float glowFalloff = smoothstep(maxR * 1.2, 0.0, distCenter);
  float glowPulse = 0.7 + 0.3 * sin(u_time * u_pulseSpeed * TAU * 0.5);
  float glowA = glowFalloff * u_glowOpacity * glowPulse;
  vec4 color = vec4(u_glowColor * glowA, glowA);

  float angle;
  if (u_oscillate > 0.5) {
    angle = sin(u_time * u_rotateSpeed) * 0.349;
  } else {
    angle = u_time * u_rotateSpeed * u_rotateDir;
  }

  float ca = cos(angle);
  float sa = sin(angle);
  mat2 rot = mat2(ca, -sa, sa, ca);

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

      float d = length(px - dotPos) - r;
      float mask = 1.0 - smoothstep(-aaWidth, aaWidth, d);

      float a = mask * op;
      color = color * (1.0 - a) + vec4(col * a, a);
    }
  }

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

  fragColor = color;
}
`;
