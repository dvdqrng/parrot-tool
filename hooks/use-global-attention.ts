'use client';

/**
 * useGlobalAttention Hook
 * Subscribes to global_attention_update events from the background worker.
 * Exposes attention scores for UI components (e.g., orb badge count).
 */

import { useState, useEffect } from 'react';
import { eventBus } from '@/lib/intelligence/event-bus';
import { AttentionScore } from '@/lib/intelligence/attention-model';

interface UseGlobalAttentionReturn {
  /** All scored chats, sorted by score descending */
  scores: AttentionScore[];
  /** Chats with score >= 60 (high/critical urgency) */
  needsAttention: AttentionScore[];
  /** Count of high-attention chats */
  badgeCount: number;
  /** When the last scan completed */
  lastUpdated: string | null;
}

export function useGlobalAttention(): UseGlobalAttentionReturn {
  const [scores, setScores] = useState<AttentionScore[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = eventBus.on('global_attention_update', (event) => {
      if (event.type !== 'global_attention_update') return;
      setScores(event.scores);
      setLastUpdated(event.timestamp);
    });

    return unsubscribe;
  }, []);

  const needsAttention = scores.filter(s => s.score >= 60);

  return {
    scores,
    needsAttention,
    badgeCount: needsAttention.length,
    lastUpdated,
  };
}
