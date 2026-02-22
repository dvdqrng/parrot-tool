'use client';

/**
 * AI Matrix Button — WebGL2 Shader-Rendered
 *
 * 3 concentric rings of dots (6 + 10 + 14 = 30) + center dot,
 * entirely rendered by a GLSL fragment shader on the GPU.
 *
 * State transitions smoothly interpolate all uniforms over 400ms.
 * Framer-motion is only used for button hover/tap interaction.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { OrbState } from '@/hooks/use-orb-state';
import {
  VERT_SRC,
  FRAG_SRC,
  SIZE_CONFIG,
  STATE_UNIFORM_CONFIGS,
  type UniformValues,
  type UniformLocations,
} from './ai-matrix-button-shaders';

// ============================================
// CONSTANTS
// ============================================

const TRANSITION_DURATION = 0.4; // seconds

// ============================================
// WEBGL HELPERS
// ============================================

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error('[AiMatrix] Failed to create shader object');
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    const typeName = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
    console.error(`[AiMatrix] ${typeName} shader compile error:`, log || '(no log)');
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[AiMatrix] Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  // Shaders can be deleted after linking
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

function createQuadVAO(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): WebGLVertexArrayObject | null {
  const vao = gl.createVertexArray();
  if (!vao) return null;
  gl.bindVertexArray(vao);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // Fullscreen quad as triangle strip: 4 vertices
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const loc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  return vao;
}

function getUniformLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): UniformLocations {
  // Build locations object by querying each uniform
  return {
    u_time: gl.getUniformLocation(program, 'u_time'),
    u_resolution: gl.getUniformLocation(program, 'u_resolution'),
    u_rotateSpeed: gl.getUniformLocation(program, 'u_rotateSpeed'),
    u_rotateDir: gl.getUniformLocation(program, 'u_rotateDir'),
    u_oscillate: gl.getUniformLocation(program, 'u_oscillate'),
    u_dotColor: gl.getUniformLocation(program, 'u_dotColor'),
    u_litColor: gl.getUniformLocation(program, 'u_litColor'),
    u_pulseSpeed: gl.getUniformLocation(program, 'u_pulseSpeed'),
    u_pulsePattern: gl.getUniformLocation(program, 'u_pulsePattern'),
    u_peakScale: gl.getUniformLocation(program, 'u_peakScale'),
    u_opacity: gl.getUniformLocation(program, 'u_opacity'),
    u_centerColor: gl.getUniformLocation(program, 'u_centerColor'),
    u_centerAlpha: gl.getUniformLocation(program, 'u_centerAlpha'),
    u_centerPulse: gl.getUniformLocation(program, 'u_centerPulse'),
    u_centerPulseSpeed: gl.getUniformLocation(program, 'u_centerPulseSpeed'),
    u_glowColor: gl.getUniformLocation(program, 'u_glowColor'),
    u_glowOpacity: gl.getUniformLocation(program, 'u_glowOpacity'),
  };
}

function uploadUniforms(
  gl: WebGL2RenderingContext,
  locs: UniformLocations,
  v: UniformValues,
  time: number,
  resolution: number,
): void {
  gl.uniform1f(locs.u_time, time);
  gl.uniform1f(locs.u_resolution, resolution);
  gl.uniform1f(locs.u_rotateSpeed, v.rotateSpeed);
  gl.uniform1f(locs.u_rotateDir, v.rotateDir);
  gl.uniform1f(locs.u_oscillate, v.oscillate);
  gl.uniform3f(locs.u_dotColor, v.dotColor[0], v.dotColor[1], v.dotColor[2]);
  gl.uniform3f(locs.u_litColor, v.litColor[0], v.litColor[1], v.litColor[2]);
  gl.uniform1f(locs.u_pulseSpeed, v.pulseSpeed);
  gl.uniform1i(locs.u_pulsePattern, v.pulsePattern);
  gl.uniform1f(locs.u_peakScale, v.peakScale);
  gl.uniform2f(locs.u_opacity, v.opacityMin, v.opacityMax);
  gl.uniform3f(locs.u_centerColor, v.centerColor[0], v.centerColor[1], v.centerColor[2]);
  gl.uniform1f(locs.u_centerAlpha, v.centerAlpha);
  gl.uniform1f(locs.u_centerPulse, v.centerPulse);
  gl.uniform1f(locs.u_centerPulseSpeed, v.centerPulseSpeed);
  gl.uniform3f(locs.u_glowColor, v.glowColor[0], v.glowColor[1], v.glowColor[2]);
  gl.uniform1f(locs.u_glowOpacity, v.glowOpacity);
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  cssSize: number,
): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const pixelSize = Math.round(cssSize * dpr);
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  gl.viewport(0, 0, pixelSize, pixelSize);
  return pixelSize;
}

// ============================================
// INTERPOLATION
// ============================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function cloneUniforms(src: UniformValues): UniformValues {
  return {
    ...src,
    dotColor: [...src.dotColor],
    litColor: [...src.litColor],
    centerColor: [...src.centerColor],
    glowColor: [...src.glowColor],
  };
}

/**
 * Interpolate from a frozen snapshot (start) toward target.
 * Writes result into `current`. This avoids cumulative drift from
 * repeatedly lerping a mutated value toward its target.
 */
function interpolateUniforms(
  current: UniformValues,
  start: UniformValues,
  target: UniformValues,
  now: number,
  transitionStart: number,
): void {
  const elapsed = now - transitionStart;
  const t = Math.min(elapsed / TRANSITION_DURATION, 1.0);
  // Cubic ease-out
  const ease = 1 - Math.pow(1 - t, 3);

  current.rotateSpeed = lerp(start.rotateSpeed, target.rotateSpeed, ease);
  current.rotateDir = lerp(start.rotateDir, target.rotateDir, ease);
  current.oscillate = lerp(start.oscillate, target.oscillate, ease);
  current.peakScale = lerp(start.peakScale, target.peakScale, ease);
  current.opacityMin = lerp(start.opacityMin, target.opacityMin, ease);
  current.opacityMax = lerp(start.opacityMax, target.opacityMax, ease);
  current.pulseSpeed = lerp(start.pulseSpeed, target.pulseSpeed, ease);
  current.centerAlpha = lerp(start.centerAlpha, target.centerAlpha, ease);
  current.centerPulse = lerp(start.centerPulse, target.centerPulse, ease);
  current.centerPulseSpeed = lerp(start.centerPulseSpeed, target.centerPulseSpeed, ease);
  current.glowOpacity = lerp(start.glowOpacity, target.glowOpacity, ease);

  current.dotColor[0] = lerp(start.dotColor[0], target.dotColor[0], ease);
  current.dotColor[1] = lerp(start.dotColor[1], target.dotColor[1], ease);
  current.dotColor[2] = lerp(start.dotColor[2], target.dotColor[2], ease);
  current.litColor[0] = lerp(start.litColor[0], target.litColor[0], ease);
  current.litColor[1] = lerp(start.litColor[1], target.litColor[1], ease);
  current.litColor[2] = lerp(start.litColor[2], target.litColor[2], ease);
  current.centerColor[0] = lerp(start.centerColor[0], target.centerColor[0], ease);
  current.centerColor[1] = lerp(start.centerColor[1], target.centerColor[1], ease);
  current.centerColor[2] = lerp(start.centerColor[2], target.centerColor[2], ease);
  current.glowColor[0] = lerp(start.glowColor[0], target.glowColor[0], ease);
  current.glowColor[1] = lerp(start.glowColor[1], target.glowColor[1], ease);
  current.glowColor[2] = lerp(start.glowColor[2], target.glowColor[2], ease);

  // Integer: snap immediately
  current.pulsePattern = target.pulsePattern;
}

// ============================================
// FALLBACK (no WebGL)
// ============================================

const FALLBACK_COLORS: Record<OrbState, string> = {
  off: '#52525B',
  idle: '#8B5CF6',
  listening: '#A855F7',
  thinking: '#6366F1',
  learning: '#F59E0B',
  ready: '#34D399',
  error: '#EF4444',
};

function FallbackDot({ orbState, size }: { orbState: OrbState; size: 'sm' | 'md' | 'lg' }) {
  const sz = SIZE_CONFIG[size];
  return (
    <div
      style={{
        width: sz.total,
        height: sz.total,
        borderRadius: '50%',
        backgroundColor: FALLBACK_COLORS[orbState],
        opacity: orbState === 'off' ? 0.3 : 0.8,
        transition: 'background-color 0.4s, opacity 0.4s',
      }}
    />
  );
}

// ============================================
// COMPONENT
// ============================================

interface AiMatrixButtonProps {
  orbState: OrbState;
  orbLabel?: string;
  onToggleEnabled: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Theme-aware off state colors: black dots on light, white dots on dark
// All three color channels match so every dot (including center) looks identical
const OFF_COLORS = {
  dark: {
    dotColor: [1.0, 1.0, 1.0] as [number, number, number],
    litColor: [1.0, 1.0, 1.0] as [number, number, number],
    centerColor: [1.0, 1.0, 1.0] as [number, number, number],
  },
  light: {
    dotColor: [0.0, 0.0, 0.0] as [number, number, number],
    litColor: [0.0, 0.0, 0.0] as [number, number, number],
    centerColor: [0.0, 0.0, 0.0] as [number, number, number],
  },
} as const;

export function AiMatrixButton({
  orbState,
  orbLabel,
  onToggleEnabled,
  size = 'md',
  className,
}: AiMatrixButtonProps) {
  const sz = SIZE_CONFIG[size];
  const isOn = orbState !== 'off';
  const { resolvedTheme } = useTheme();

  // Refs for WebGL state (never trigger re-renders)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const vaoRef = useRef<WebGLVertexArrayObject | null>(null);
  const uniformLocsRef = useRef<UniformLocations | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Interpolation state
  const currentUniformsRef = useRef<UniformValues>(cloneUniforms(STATE_UNIFORM_CONFIGS[orbState]));
  const startUniformsRef = useRef<UniformValues>(cloneUniforms(STATE_UNIFORM_CONFIGS[orbState]));
  const targetUniformsRef = useRef<UniformValues>(cloneUniforms(STATE_UNIFORM_CONFIGS[orbState]));
  const transitionStartRef = useRef<number>(0);

  const resolutionRef = useRef<number>(60); // physical pixel size of canvas

  const [webglFailed, setWebglFailed] = useState(false);

  // Stable render loop function ref
  const renderLoopRef = useRef<(() => void) | null>(null);

  // Initialize WebGL on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });

    if (!gl) {
      setWebglFailed(true);
      return;
    }

    const program = createProgram(gl, VERT_SRC, FRAG_SRC);
    if (!program) {
      setWebglFailed(true);
      return;
    }

    const vao = createQuadVAO(gl, program);
    if (!vao) {
      setWebglFailed(true);
      return;
    }

    const locs = getUniformLocations(gl, program);

    glRef.current = gl;
    programRef.current = program;
    vaoRef.current = vao;
    uniformLocsRef.current = locs;

    resolutionRef.current = resizeCanvas(canvas, gl, sz.total);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    startTimeRef.current = performance.now() / 1000;
    lastFrameTimeRef.current = startTimeRef.current;

    const render = () => {
      const now = performance.now() / 1000;
      const elapsed = now - startTimeRef.current;
      lastFrameTimeRef.current = now;

      interpolateUniforms(
        currentUniformsRef.current,
        startUniformsRef.current,
        targetUniformsRef.current,
        now,
        transitionStartRef.current,
      );

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      uploadUniforms(gl, locs, currentUniformsRef.current, elapsed, resolutionRef.current);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(render);
    };

    renderLoopRef.current = render;
    rafRef.current = requestAnimationFrame(render);

    // Tab visibility handling
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = performance.now() / 1000;
        const gap = now - lastFrameTimeRef.current;
        startTimeRef.current += gap;
        lastFrameTimeRef.current = now;
        // Restart render loop if it was paused
        if (renderLoopRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(renderLoopRef.current);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Context loss handling
    const onContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
    };
    const onContextRestored = () => {
      // Re-initialize
      const newProgram = createProgram(gl, VERT_SRC, FRAG_SRC);
      if (!newProgram) return;
      const newVao = createQuadVAO(gl, newProgram);
      if (!newVao) return;
      const newLocs = getUniformLocations(gl, newProgram);

      programRef.current = newProgram;
      vaoRef.current = newVao;
      uniformLocsRef.current = newLocs;

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(newProgram);
      gl.bindVertexArray(newVao);
      resolutionRef.current = resizeCanvas(canvas, gl, sz.total);

      startTimeRef.current = performance.now() / 1000;
      if (renderLoopRef.current) {
        rafRef.current = requestAnimationFrame(renderLoopRef.current);
      }
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      // Don't call loseContext() — it permanently kills the context on this canvas,
      // breaking React strict mode's double-mount. GC handles cleanup.
      glRef.current = null;
      programRef.current = null;
      vaoRef.current = null;
      uniformLocsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update target uniforms when orbState or theme changes
  useEffect(() => {
    const target = cloneUniforms(STATE_UNIFORM_CONFIGS[orbState]);

    // Override off-state colors based on current theme
    if (orbState === 'off') {
      const isDark = resolvedTheme === 'dark';
      const colors = isDark ? OFF_COLORS.dark : OFF_COLORS.light;
      target.dotColor = [...colors.dotColor];
      target.litColor = [...colors.litColor];
      target.centerColor = [...colors.centerColor];
    }

    // Snapshot current values as the transition start point
    startUniformsRef.current = cloneUniforms(currentUniformsRef.current);
    targetUniformsRef.current = target;
    transitionStartRef.current = performance.now() / 1000;
  }, [orbState, resolvedTheme]);

  // Handle size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!canvas || !gl) return;
    resolutionRef.current = resizeCanvas(canvas, gl, sz.total);
  }, [sz.total]);

  return (
    <motion.button
      onClick={onToggleEnabled}
      className={cn(
        'relative cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
        'rounded-full',
        className,
      )}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      title={orbLabel || (isOn ? 'Turn AI Off' : 'Turn AI On')}
      style={{ width: sz.total, height: sz.total }}
    >
      {webglFailed ? (
        <FallbackDot orbState={orbState} size={size} />
      ) : (
        <canvas
          ref={canvasRef}
          style={{
            width: sz.total,
            height: sz.total,
            borderRadius: '50%',
          }}
        />
      )}
    </motion.button>
  );
}
