'use client';

/**
 * AI Orb Button
 *
 * A refined, minimalist orb that toggles AI on/off.
 * No icon - just a beautiful gradient sphere with subtle animation.
 *
 * Visual states:
 * - Disabled: Subtle gray gradient, dormant
 * - Enabled: Vibrant gradient with gentle rotation
 * - Activity: Small pulse indicator
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AiOrbButtonProps {
  isEnabled: boolean;
  isPanelOpen?: boolean;
  hasActivity?: boolean;
  onToggleEnabled: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AiOrbButton({
  isEnabled,
  isPanelOpen = false,
  hasActivity = false,
  onToggleEnabled,
  size = 'md',
  className,
}: AiOrbButtonProps) {
  const sizeConfig = {
    sm: { orb: 'w-6 h-6', glow: 2, dot: 'w-1.5 h-1.5' },
    md: { orb: 'w-7 h-7', glow: 3, dot: 'w-2 h-2' },
    lg: { orb: 'w-9 h-9', glow: 4, dot: 'w-2.5 h-2.5' },
  };

  const config = sizeConfig[size];

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
      title={isEnabled ? 'Turn AI Off' : 'Turn AI On'}
    >
      {/* Subtle glow - only when enabled */}
      {isEnabled && (
        <div
          className="absolute inset-0 rounded-full opacity-40"
          style={{
            background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
            filter: `blur(${config.glow}px)`,
          }}
        />
      )}

      {/* Main orb with gradient */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: isEnabled
            ? 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 25%, #EC4899 50%, #F472B6 75%, #8B5CF6 100%)'
            : 'linear-gradient(135deg, #71717A 0%, #52525B 50%, #3F3F46 100%)',
          backgroundSize: isEnabled ? '200% 200%' : '100% 100%',
        }}
        animate={
          isEnabled
            ? {
                backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
              }
            : {}
        }
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Glass highlight - top left reflection */}
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

      {/* Inner shadow for depth */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          boxShadow: isEnabled
            ? 'inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.1)'
            : 'inset 0 -1px 3px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.05)',
        }}
      />

      {/* Activity indicator - small dot */}
      {hasActivity && isEnabled && !isPanelOpen && (
        <motion.div
          className={cn(
            'absolute -top-0.5 -right-0.5 rounded-full',
            'bg-emerald-400 border border-background',
            config.dot
          )}
          animate={{
            opacity: [1, 0.6, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.button>
  );
}
