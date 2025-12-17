'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadAutopilotActivity } from '@/lib/storage';
import { AutopilotActivityEntry } from '@/lib/types';
import { autopilotEvents } from '@/lib/autopilot-events';

/**
 * Hook to get the last autopilot activity for a chat
 * Uses event-based updates + polling fallback for real-time status
 */
export function useLastActivity(
  chatId: string | null,
  pollInterval: number = 2000 // Reduced from 500ms since events handle most updates
): AutopilotActivityEntry | null {
  const [lastActivity, setLastActivity] = useState<AutopilotActivityEntry | null>(null);

  const loadLatest = useCallback(() => {
    if (!chatId) {
      setLastActivity(null);
      return;
    }

    const activities = loadAutopilotActivity()
      .filter((a) => a.chatId === chatId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const latest = activities[0] || null;

    // Only update state if the activity actually changed
    setLastActivity((prev) => {
      if (!prev && !latest) return prev;
      if (!prev || !latest) return latest;
      if (prev.id === latest.id && prev.timestamp === latest.timestamp) return prev;
      return latest;
    });
  }, [chatId]);

  useEffect(() => {
    // Load immediately
    loadLatest();

    // Subscribe to activity events for instant updates
    const unsubscribe = autopilotEvents.on('activity-added', (event) => {
      if (event.chatId === chatId) {
        loadLatest();
      }
    });

    // Poll for updates as fallback (in case events are missed)
    const interval = setInterval(loadLatest, pollInterval);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [loadLatest, pollInterval, chatId]);

  return lastActivity;
}
