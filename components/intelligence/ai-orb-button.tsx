'use client';

/**
 * AI Orb Button
 *
 * A minimalist orb that toggles AI on/off and visually communicates
 * what the intelligence layer is doing in the background.
 *
 * Visual states:
 * - off:       Gray, static — AI disabled
 * - idle:      Soft purple, slow drift — enabled, nothing happening
 * - listening: Purple, gentle pulse — processing new messages
 * - thinking:  Purple-blue, fast rotation + ring — LLM call in flight
 * - learning:  Purple-gold shimmer — just extracted new knowledge
 * - ready:     Purple + green glow — has draft/insight for user
 * - error:     Red flash — API/extraction failure
 */

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { OrbState } from '@/hooks/use-orb-state';

// ============================================
// VISUAL CONFIGS PER STATE
// ============================================

interface OrbVisualConfig {
  gradient: string;
  backgroundSize: string;
  glowColor: string;
  glowOpacity: number;
  animateBg: Record<string, string[]> | false;
  bgDuration: number;
  innerShadow: string;
}

const VISUAL_CONFIGS: Record<OrbState, OrbVisualConfig> = {
  off: {
    gradient: 'linear-gradient(135deg, #71717A 0%, #52525B 50%, #3F3F46 100%)',
    backgroundSize: '100% 100%',
    glowColor: 'transparent',
    glowOpacity: 0,
    animateBg: false,
    bgDuration: 0,
    innerShadow: 'inset 0 -1px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.05)',
  },
  idle: {
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #8B5CF6 100%)',
    backgroundSize: '200% 200%',
    glowColor: '#8B5CF6',
    glowOpacity: 0.25,
    animateBg: { backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] },
    bgDuration: 8,
    innerShadow: 'inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.1)',
  },
  listening: {
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 40%, #C084FC 70%, #8B5CF6 100%)',
    backgroundSize: '200% 200%',
    glowColor: '#A855F7',
    glowOpacity: 0.35,
    animateBg: { backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] },
    bgDuration: 3,
    innerShadow: 'inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.15)',
  },
  thinking: {
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 30%, #3B82F6 60%, #7C3AED 100%)',
    backgroundSize: '300% 300%',
    glowColor: '#6366F1',
    glowOpacity: 0.5,
    animateBg: { backgroundPosition: ['0% 0%', '50% 100%', '100% 0%', '0% 0%'] },
    bgDuration: 1.5,
    innerShadow: 'inset 0 -2px 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.2)',
  },
  learning: {
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 25%, #F59E0B 50%, #FBBF24 75%, #8B5CF6 100%)',
    backgroundSize: '300% 300%',
    glowColor: '#F59E0B',
    glowOpacity: 0.45,
    animateBg: { backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] },
    bgDuration: 1.2,
    innerShadow: 'inset 0 -2px 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.2)',
  },
  ready: {
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #8B5CF6 100%)',
    backgroundSize: '200% 200%',
    glowColor: '#34D399',
    glowOpacity: 0.5,
    animateBg: { backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] },
    bgDuration: 4,
    innerShadow: 'inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.1)',
  },
  error: {
    gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 50%, #B91C1C 100%)',
    backgroundSize: '100% 100%',
    glowColor: '#EF4444',
    glowOpacity: 0.5,
    animateBg: false,
    bgDuration: 0,
    innerShadow: 'inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.1)',
  },
};

// ============================================
// PROPS
// ============================================

interface AiOrbButtonProps {
  orbState: OrbState;
  orbLabel?: string;
  onToggleEnabled: () => void;
  size?: 'sm' | 'md' | 'lg';
  badgeCount?: number; // Number of chats needing attention
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function AiOrbButton({
  orbState,
  orbLabel,
  onToggleEnabled,
  size = 'md',
  badgeCount = 0,
  className,
}: AiOrbButtonProps) {
  const sizeConfig = {
    sm: { orb: 'w-6 h-6', glow: 2, ring: 10 },
    md: { orb: 'w-7 h-7', glow: 3, ring: 12 },
    lg: { orb: 'w-9 h-9', glow: 4, ring: 16 },
  };

  const config = sizeConfig[size];
  const visual = VISUAL_CONFIGS[orbState];
  const isOn = orbState !== 'off';

  return (
    <motion.button
      onClick={onToggleEnabled}
      className={cn(
        'relative rounded-full cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
        config.orb,
        className
      )}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      title={orbLabel || (isOn ? 'Turn AI Off' : 'Turn AI On')}
    >
      {/* Outer glow — color and intensity driven by state */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ filter: `blur(${config.glow}px)` }}
        animate={{
          background: visual.glowColor !== 'transparent'
            ? visual.glowColor
            : 'rgba(0,0,0,0)',
          opacity: visual.glowOpacity,
        }}
        transition={{ duration: 0.4 }}
      />

      {/* Ready state: breathing green glow ring */}
      <AnimatePresence>
        {orbState === 'ready' && (
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: -3,
              border: '1.5px solid',
              borderColor: '#34D399',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: [0.4, 0.8, 0.4],
              scale: [0.97, 1.03, 0.97],
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </AnimatePresence>

      {/* Thinking state: orbiting ring */}
      <AnimatePresence>
        {orbState === 'thinking' && (
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: -2,
              border: '1.5px solid transparent',
              borderTopColor: '#60A5FA',
              borderRightColor: '#818CF8',
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 0.8,
              rotate: [0, 360],
            }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.2 },
              rotate: { duration: 1, repeat: Infinity, ease: 'linear' },
            }}
          />
        )}
      </AnimatePresence>

      {/* Main orb with gradient — smoothly transitions between states */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: visual.gradient,
          backgroundSize: visual.backgroundSize,
        }}
        animate={visual.animateBg || {}}
        transition={{
          duration: visual.bgDuration,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Listening state: scale pulse */}
      {orbState === 'listening' && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            scale: [1, 1.06, 1],
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Learning state: shimmer sweep */}
      <AnimatePresence>
        {orbState === 'learning' && (
          <motion.div
            className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              style={{
                position: 'absolute',
                top: 0,
                width: '50%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)',
              }}
              animate={{ left: ['-50%', '150%'] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glass highlight — top left reflection (always present) */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          top: '10%',
          left: '10%',
          width: '40%',
          height: '40%',
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.5) 0%, transparent 70%)',
        }}
      />

      {/* Inner shadow for depth — varies by state */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: visual.innerShadow }}
      />

      {/* Attention badge — shows count of chats needing attention */}
      <AnimatePresence>
        {badgeCount > 0 && isOn && (
          <motion.div
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-red-500 flex items-center justify-center pointer-events-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <span className="text-[9px] font-bold text-white leading-none px-1">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
