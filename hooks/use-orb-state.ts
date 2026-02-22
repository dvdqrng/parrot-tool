'use client';

/**
 * useOrbState Hook
 *
 * Subscribes to the intelligence event bus and derives a visual state
 * for the AI orb button. Maps background intelligence activity
 * (extraction, drafting, learning, errors) into distinct visual states.
 *
 * States (by priority, highest wins):
 *   error > thinking > learning > listening > ready > idle > off
 *
 * Transient states auto-decay back to idle after a timeout.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { eventBus, IntelligenceEvent } from '@/lib/intelligence/event-bus';

// ============================================
// TYPES
// ============================================

export type OrbState =
  | 'off'        // AI disabled — gray, static
  | 'idle'       // Enabled, nothing happening — soft purple, slow drift
  | 'listening'  // Processing new messages — purple pulse
  | 'thinking'   // LLM API call in flight — purple-blue, fast rotation
  | 'learning'   // Just extracted knowledge — purple-gold shimmer
  | 'ready'      // Has draft/insight for user — purple + green glow
  | 'error';     // API/extraction failure — red flash

export interface OrbStateResult {
  orbState: OrbState;
  orbLabel: string;
}

// ============================================
// PRIORITY & DECAY CONFIG
// ============================================

const STATE_PRIORITY: Record<OrbState, number> = {
  off: 0,
  idle: 1,
  ready: 2,
  listening: 3,
  learning: 4,
  thinking: 5,
  error: 6,
};

/** Transient states auto-decay back to idle after this many ms */
const DECAY_MS: Partial<Record<OrbState, number>> = {
  listening: 2000,
  learning: 3000,
  error: 2000,
};

// ============================================
// LABELS
// ============================================

const DEFAULT_LABELS: Record<OrbState, string> = {
  off: 'Turn AI On',
  idle: 'AI is on',
  listening: 'Processing messages...',
  thinking: 'Thinking...',
  learning: 'Learned something new',
  ready: 'Has something to show you',
  error: 'Something went wrong',
};

// ============================================
// HOOK
// ============================================

export function useOrbState(
  chatId: string | null,
  isEnabled: boolean,
  hasActivity: boolean,
): OrbStateResult {
  const [activeStates, setActiveStates] = useState<Map<OrbState, string>>(new Map());
  const decayTimers = useRef<Map<OrbState, NodeJS.Timeout>>(new Map());
  const labelOverrides = useRef<Map<OrbState, string>>(new Map());

  /**
   * Push a state into the active set, optionally with a custom label.
   * If the state has a decay timeout, it will auto-remove after that duration.
   */
  const pushState = useCallback((state: OrbState, label?: string) => {
    // Store label override if provided
    if (label) {
      labelOverrides.current.set(state, label);
    }

    setActiveStates(prev => {
      const next = new Map(prev);
      next.set(state, label || DEFAULT_LABELS[state]);
      return next;
    });

    // Set up auto-decay if applicable
    const decayMs = DECAY_MS[state];
    if (decayMs) {
      // Clear any existing timer for this state
      const existing = decayTimers.current.get(state);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        setActiveStates(prev => {
          const next = new Map(prev);
          next.delete(state);
          return next;
        });
        labelOverrides.current.delete(state);
        decayTimers.current.delete(state);
      }, decayMs);

      decayTimers.current.set(state, timer);
    }
  }, []);

  /**
   * Remove a state from the active set immediately.
   */
  const clearState = useCallback((state: OrbState) => {
    setActiveStates(prev => {
      const next = new Map(prev);
      next.delete(state);
      return next;
    });
    labelOverrides.current.delete(state);

    const timer = decayTimers.current.get(state);
    if (timer) {
      clearTimeout(timer);
      decayTimers.current.delete(state);
    }
  }, []);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of decayTimers.current.values()) {
        clearTimeout(timer);
      }
      decayTimers.current.clear();
    };
  }, []);

  // Subscribe to event bus
  useEffect(() => {
    if (!isEnabled || !chatId) return;

    const handleEvent = (event: IntelligenceEvent) => {
      // Filter events by chatId where applicable
      const eventChatId = 'chatId' in event ? (event as any).chatId : null;

      switch (event.type) {
        // Listening — new message being processed
        case 'message_received':
          if (eventChatId === chatId) {
            pushState('listening', 'Processing new message...');
          }
          break;

        // Thinking — LLM work in progress
        case 'extraction_started':
          if (eventChatId === chatId) {
            pushState('thinking', 'Extracting knowledge...');
          }
          break;
        case 'draft_requested':
          if (eventChatId === chatId) {
            pushState('thinking', 'Drafting reply...');
          }
          break;

        // Learning — just learned new facts
        case 'extraction_complete':
          if (eventChatId === chatId) {
            clearState('thinking');
            const factsCount = (event as any).facts?.length || 0;
            pushState('learning', factsCount > 0
              ? `Learned ${factsCount} new fact${factsCount !== 1 ? 's' : ''}`
              : 'Finished processing'
            );
          }
          break;

        // Ambient processing complete
        case 'ambient_processing_complete':
          pushState('learning', 'Updated your context');
          break;

        // Error states
        case 'extraction_failed':
          if (eventChatId === chatId) {
            clearState('thinking');
            pushState('error', 'Extraction failed');
          }
          break;
        case 'error':
          // Only show error if it seems related to this chat
          pushState('error', (event as any).message?.slice(0, 40) || 'Something went wrong');
          break;

        // Draft completed (clears thinking)
        case 'draft_accepted':
        case 'draft_rejected':
          if (eventChatId === chatId) {
            clearState('thinking');
          }
          break;
      }
    };

    const unsubscribe = eventBus.on('*', handleEvent);
    return unsubscribe;
  }, [chatId, isEnabled, pushState, clearState]);

  // Sync hasActivity → ready state
  useEffect(() => {
    if (isEnabled && hasActivity) {
      pushState('ready');
    } else {
      clearState('ready');
    }
  }, [isEnabled, hasActivity, pushState, clearState]);

  // Resolve final state from active states by priority
  const resolvedState: OrbState = (() => {
    if (!isEnabled) return 'off';

    let highest: OrbState = 'idle';
    let highestPriority = STATE_PRIORITY.idle;

    for (const [state] of activeStates) {
      const priority = STATE_PRIORITY[state];
      if (priority > highestPriority) {
        highest = state;
        highestPriority = priority;
      }
    }

    return highest;
  })();

  const resolvedLabel = activeStates.get(resolvedState) || DEFAULT_LABELS[resolvedState];

  return {
    orbState: resolvedState,
    orbLabel: resolvedLabel,
  };
}
