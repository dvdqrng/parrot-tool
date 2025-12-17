'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedGradientSphereProps {
  className?: string;
}

const colors = [
  '#3b82f6', // blue-500
  '#0ea5e9', // sky-500
  '#22d3ee', // cyan-400
  '#67e8f9', // cyan-300
  '#a78bfa', // violet-400
];

const AnimatedGradientSphere: React.FC<AnimatedGradientSphereProps> = ({ className }) => {
  return (
    <div className={cn("relative h-4 w-4 rounded-full bg-black overflow-hidden", className)}>
      <motion.div
        className="absolute h-full w-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} // Even faster rotation
      >
        {colors.map((color, i) => {
          return (
            <motion.div
              key={i}
              className="absolute h-full w-full rounded-full"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${color}, transparent 70%)`,
                scale: 1.8, // Even bigger inner circles
              }}
              animate={{
                scale: [1, 1.4, 1, 0.7, 1], // More extreme scaling
                x: [`${Math.sin(i * 1.2) * 40}%`, `${Math.cos(i * 1.2) * 40}%`, `${-Math.sin(i * 1.2) * 40}%`, `${-Math.cos(i * 1.2) * 40}%`, `${Math.sin(i * 1.2) * 40}%`], // Max movement
                y: [`${Math.cos(i * 1.2) * 40}%`, `${-Math.sin(i * 1.2) * 40}%`, `${-Math.cos(i * 1.2) * 40}%`, `${Math.sin(i * 1.2) * 40}%`, `${Math.cos(i * 1.2) * 40}%`], // Max movement
                opacity: [0.6, 0.9, 0.5, 0.8, 0.6], // Opacity animation
                rotate: [0, 360],
              }}
              transition={{
                duration: 3 + Math.random() * 3, // More random duration
                repeat: Infinity,
                ease: 'easeInOut',
                repeatType: 'loop',
                delay: i * (Math.random() * 0.5), // More random delay
              }}
            />
          );
        })}
      </motion.div>
    </div>
  );
};

export { AnimatedGradientSphere };
