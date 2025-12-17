'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadScheduledActions, getPendingActionsForChat } from '@/lib/storage';
import { ScheduledAutopilotAction } from '@/lib/types';
import { autopilotEvents } from '@/lib/autopilot-events';

export interface SchedulerStatus {
  // Global scheduler state
  totalPending: number;
  totalExecuting: number;

  // Chat-specific state
  chatPendingActions: ScheduledAutopilotAction[];
  chatExecutingAction: ScheduledAutopilotAction | null;

  // Next action timing
  nextActionTime: Date | null;
  secondsUntilNextAction: number | null;

  // Current phase
  phase: 'idle' | 'waiting' | 'executing' | 'composing';
}

/**
 * Hook to get real-time scheduler status for display in UI
 * Uses event-based updates + polling for countdown updates
 */
export function useSchedulerStatus(
  chatId: string | null,
  pollInterval: number = 500
): SchedulerStatus {
  const [status, setStatus] = useState<SchedulerStatus>({
    totalPending: 0,
    totalExecuting: 0,
    chatPendingActions: [],
    chatExecutingAction: null,
    nextActionTime: null,
    secondsUntilNextAction: null,
    phase: 'idle',
  });

  const updateStatus = useCallback(() => {
    const allActions = loadScheduledActions();
    const pending = allActions.filter(a => a.status === 'pending');
    const executing = allActions.filter(a => a.status === 'executing');

    // Chat-specific actions
    const chatPending = chatId
      ? pending.filter(a => a.chatId === chatId).sort((a, b) =>
          new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
        )
      : [];
    const chatExecuting = chatId
      ? executing.find(a => a.chatId === chatId) || null
      : null;

    // Calculate next action time for this chat
    const nextAction = chatPending[0];
    const nextActionTime = nextAction ? new Date(nextAction.scheduledFor) : null;
    const now = Date.now();
    const secondsUntilNextAction = nextActionTime
      ? Math.max(0, Math.round((nextActionTime.getTime() - now) / 1000))
      : null;

    // Determine phase
    let phase: SchedulerStatus['phase'] = 'idle';
    if (chatExecuting) {
      phase = 'executing';
    } else if (chatPending.length > 0) {
      // Check if action is imminent (within 5 seconds) or far future (manual approval)
      if (secondsUntilNextAction !== null) {
        if (secondsUntilNextAction > 60 * 60) {
          // Far future = waiting for approval
          phase = 'waiting';
        } else if (secondsUntilNextAction <= 5) {
          phase = 'executing';
        } else {
          phase = 'waiting';
        }
      }
    }

    setStatus(prev => {
      // Only update if something changed to prevent unnecessary re-renders
      if (
        prev.totalPending === pending.length &&
        prev.totalExecuting === executing.length &&
        prev.chatPendingActions.length === chatPending.length &&
        prev.secondsUntilNextAction === secondsUntilNextAction &&
        prev.phase === phase &&
        prev.chatExecutingAction?.id === chatExecuting?.id
      ) {
        return prev;
      }

      return {
        totalPending: pending.length,
        totalExecuting: executing.length,
        chatPendingActions: chatPending,
        chatExecutingAction: chatExecuting,
        nextActionTime,
        secondsUntilNextAction,
        phase,
      };
    });
  }, [chatId]);

  useEffect(() => {
    updateStatus();

    // Subscribe to action events for instant updates
    const unsubscribeScheduled = autopilotEvents.on('action-scheduled', (event) => {
      if (!chatId || event.chatId === chatId) {
        updateStatus();
      }
    });

    const unsubscribeExecuting = autopilotEvents.on('action-executing', (event) => {
      if (!chatId || event.chatId === chatId) {
        updateStatus();
      }
    });

    const unsubscribeCompleted = autopilotEvents.on('action-completed', (event) => {
      if (!chatId || event.chatId === chatId) {
        updateStatus();
      }
    });

    const unsubscribeFailed = autopilotEvents.on('action-failed', (event) => {
      if (!chatId || event.chatId === chatId) {
        updateStatus();
      }
    });

    // Poll for countdown updates (needed to update "Sending in 30s" -> "Sending in 29s")
    const interval = setInterval(updateStatus, pollInterval);

    return () => {
      unsubscribeScheduled();
      unsubscribeExecuting();
      unsubscribeCompleted();
      unsubscribeFailed();
      clearInterval(interval);
    };
  }, [updateStatus, pollInterval, chatId]);

  return status;
}

/**
 * Format seconds into human-readable countdown
 */
export function formatCountdown(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds <= 0) return 'now';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
