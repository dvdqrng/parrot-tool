'use client';

import { useState, useEffect, useCallback } from 'react';
import { autopilotEvents, AutopilotEvent, AutopilotEventType } from '@/lib/autopilot-events';

/**
 * Hook to subscribe to autopilot events for a specific chat
 * Returns the latest event and a trigger to force UI updates
 */
export function useAutopilotEvents(
  chatId: string | null,
  eventTypes?: AutopilotEventType[]
): {
  lastEvent: AutopilotEvent | null;
  eventCount: number;
} {
  const [lastEvent, setLastEvent] = useState<AutopilotEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    if (!chatId) return;

    const handleEvent = (event: AutopilotEvent) => {
      // Only handle events for this chat
      if (event.chatId !== chatId) return;

      // Filter by event type if specified
      if (eventTypes && !eventTypes.includes(event.type)) return;

      setLastEvent(event);
      setEventCount(c => c + 1);
    };

    // Subscribe to all events
    const unsubscribe = autopilotEvents.onAny(handleEvent);

    return () => {
      unsubscribe();
    };
  }, [chatId, eventTypes]);

  return { lastEvent, eventCount };
}

/**
 * Hook that triggers a callback when autopilot events occur
 * Useful for forcing re-fetches or refreshes
 */
export function useAutopilotEventTrigger(
  chatId: string | null,
  callback: () => void,
  eventTypes?: AutopilotEventType[]
): void {
  useEffect(() => {
    if (!chatId) return;

    const handleEvent = (event: AutopilotEvent) => {
      // Only handle events for this chat
      if (event.chatId !== chatId) return;

      // Filter by event type if specified
      if (eventTypes && !eventTypes.includes(event.type)) return;

      callback();
    };

    const unsubscribe = autopilotEvents.onAny(handleEvent);

    return () => {
      unsubscribe();
    };
  }, [chatId, callback, eventTypes]);
}

/**
 * Hook to get a refresh trigger that increments on events
 * Pass this as a dependency to force re-computation
 */
export function useAutopilotRefreshTrigger(chatId: string | null): number {
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!chatId) return;

    const handleEvent = (event: AutopilotEvent) => {
      // Handle both chat-specific and global events
      if (event.chatId && event.chatId !== chatId) return;
      setTrigger(t => t + 1);
    };

    const unsubscribe = autopilotEvents.onAny(handleEvent);

    return () => {
      unsubscribe();
    };
  }, [chatId]);

  return trigger;
}
