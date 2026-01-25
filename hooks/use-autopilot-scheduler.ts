'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ScheduledAutopilotAction,
  AgentBehaviorSettings,
} from '@/lib/types';
import {
  loadScheduledActions,
  addScheduledAction,
  updateScheduledAction,
  deleteScheduledAction,
  getNextPendingAction,
  cancelActionsForChat,
  cleanupCompletedActions,
  generateId,
  loadSettings,
} from '@/lib/storage';
import { emitActionExecuting, emitActionCompleted, emitActionFailed } from '@/lib/autopilot-events';
import { AUTOPILOT } from '@/lib/ai-constants';
import { logger } from '@/lib/logger';

interface UseAutopilotSchedulerOptions {
  pollInterval?: number; // ms between checks for pending actions
  onActionExecute?: (action: ScheduledAutopilotAction) => Promise<void>;
  onActionComplete?: (action: ScheduledAutopilotAction) => void;
  onActionError?: (action: ScheduledAutopilotAction, error: Error) => void;
}

// Utility functions for timing calculations
export function calculateReplyDelay(
  behavior: AgentBehaviorSettings,
  lastMessageTime?: Date,
  conversationStartTime?: Date
): number {
  const { replyDelayMin, replyDelayMax, replyDelayContextAware } = behavior;

  // Base delay: random between min and max
  let delay = replyDelayMin + Math.random() * (replyDelayMax - replyDelayMin);

  if (replyDelayContextAware && lastMessageTime) {
    const timeSinceLastMessage = Date.now() - lastMessageTime.getTime();
    const conversationAge = conversationStartTime
      ? Date.now() - conversationStartTime.getTime()
      : Infinity;

    // If message was recent (within 5 minutes), respond faster
    if (timeSinceLastMessage < 5 * 60 * 1000) {
      delay = delay * 0.3; // 30% of normal delay
    }
    // If conversation just started (within 30 minutes), slightly faster
    else if (conversationAge < 30 * 60 * 1000) {
      delay = delay * 0.6; // 60% of normal delay
    }
  }

  // Ensure minimum delay of 5 seconds
  return Math.max(5, delay);
}

export function isWithinActivityHours(behavior: AgentBehaviorSettings): boolean {
  if (!behavior.activityHoursEnabled) return true;

  const { activityHoursStart, activityHoursEnd, activityHoursTimezone } = behavior;

  try {
    // Get current hour in configured timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: activityHoursTimezone,
    });
    const currentHour = parseInt(formatter.format(new Date()), 10);

    // Handle overnight ranges (e.g., 22:00 - 06:00)
    if (activityHoursStart <= activityHoursEnd) {
      return currentHour >= activityHoursStart && currentHour < activityHoursEnd;
    } else {
      return currentHour >= activityHoursStart || currentHour < activityHoursEnd;
    }
  } catch {
    // If timezone is invalid, allow activity
    return true;
  }
}

export function calculateTypingDuration(
  messageText: string,
  typingSpeedWpm: number
): number {
  const wordCount = messageText.split(/\s+/).length;
  const minutesToType = wordCount / typingSpeedWpm;
  const secondsToType = minutesToType * 60;

  // Add randomness (+/- 20%)
  const variance = secondsToType * 0.2;
  const finalDuration = secondsToType + (Math.random() * variance * 2 - variance);

  // Minimum 1 second, maximum 30 seconds
  return Math.max(1, Math.min(30, finalDuration));
}

export function calculateReadReceiptDelay(behavior: AgentBehaviorSettings): number {
  if (!behavior.readReceiptEnabled) return 0;

  const { readReceiptDelayMin, readReceiptDelayMax } = behavior;
  return readReceiptDelayMin + Math.random() * (readReceiptDelayMax - readReceiptDelayMin);
}

export function calculateMultiMessageDelay(behavior: AgentBehaviorSettings): number {
  if (!behavior.multiMessageEnabled) return 0;

  const { multiMessageDelayMin, multiMessageDelayMax } = behavior;
  return multiMessageDelayMin + Math.random() * (multiMessageDelayMax - multiMessageDelayMin);
}

export function useAutopilotScheduler(options: UseAutopilotSchedulerOptions = {}) {
  const {
    pollInterval = 1000,
    onActionExecute,
    onActionComplete,
    onActionError,
  } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const processingRef = useRef(false);

  // Process the next pending action
  const processNextAction = useCallback(async () => {
    if (processingRef.current) {
      return;
    }

    const allActions = loadScheduledActions();
    const pendingActions = allActions.filter(a => a.status === 'pending');
    const now = new Date().toISOString();
    const dueActions = pendingActions.filter(a => a.scheduledFor <= now);

    if (pendingActions.length > 0) {
      logger.scheduler('Checking actions', {
        totalActions: allActions.length,
        pendingCount: pendingActions.length,
        dueCount: dueActions.length,
        now,
        nextScheduledFor: pendingActions[0]?.scheduledFor
      });
    }

    const action = getNextPendingAction();
    if (!action) return;

    logger.scheduler('Processing action', { actionId: action.id, type: action.type, chatId: action.chatId });
    processingRef.current = true;

    // Emit executing event for real-time UI updates
    emitActionExecuting(action.chatId, action.id);

    try {
      // Mark as executing
      updateScheduledAction(action.id, { status: 'executing' });

      // Execute the action
      if (onActionExecute) {
        await onActionExecute(action);
      } else {
        // Default execution based on action type
        const settings = loadSettings();

        if (action.type === 'send-message' && action.messageText) {
          logger.scheduler('Sending message via API', { chatId: action.chatId, text: action.messageText?.slice(0, 50) });

          // Skip typing simulation for now - it adds delay without visible benefit
          // (Beeper API doesn't support typing indicators anyway)

          const response = await fetch('/api/beeper/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-beeper-token': settings.beeperAccessToken || '',
            },
            body: JSON.stringify({
              chatId: action.chatId,
              text: action.messageText,
            }),
          });

          const result = await response.json();
          logger.scheduler('Send response', { ok: response.ok, result });

          if (!response.ok) {
            throw new Error(result.error || 'Failed to send message');
          }
        }
        // Note: Beeper Desktop API doesn't currently support typing indicators or read receipts
        // When supported, we can implement 'typing-indicator' and 'send-read-receipt' action types
      }

      // Mark as completed
      updateScheduledAction(action.id, { status: 'completed' });
      emitActionCompleted(action.chatId, action.id);
      onActionComplete?.(action);
    } catch (error) {
      logger.error('Error executing scheduled action', error instanceof Error ? error : String(error));
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      updateScheduledAction(action.id, {
        status: 'failed',
        attempts: action.attempts + 1,
        lastError: errorMsg,
      });
      emitActionFailed(action.chatId, action.id, errorMsg);
      onActionError?.(action, error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      processingRef.current = false;
    }
  }, [onActionExecute, onActionComplete, onActionError]);

  // Update pending count
  const updatePendingCount = useCallback(() => {
    const actions = loadScheduledActions();
    const pending = actions.filter(a => a.status === 'pending').length;
    setPendingCount(pending);
  }, []);

  // Start the scheduler
  const start = useCallback(() => {
    if (isRunning) return;

    logger.scheduler('Starting scheduler');
    setIsRunning(true);
    updatePendingCount();

    // Process actions on an interval
    intervalRef.current = setInterval(() => {
      processNextAction();
      updatePendingCount();
    }, pollInterval);

    // Also do cleanup periodically
    cleanupCompletedActions();
  }, [isRunning, pollInterval, processNextAction, updatePendingCount]);

  // Stop the scheduler
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  // Schedule a new action
  const schedule = useCallback((
    action: Omit<ScheduledAutopilotAction, 'id' | 'createdAt' | 'status' | 'attempts'>
  ): string => {
    const id = generateId();
    const fullAction: ScheduledAutopilotAction = {
      ...action,
      id,
      createdAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };
    addScheduledAction(fullAction);
    updatePendingCount();
    return id;
  }, [updatePendingCount]);

  // Schedule a message send with delay
  const scheduleMessage = useCallback((
    chatId: string,
    agentId: string,
    messageText: string,
    delaySeconds: number,
    messageId?: string
  ): string => {
    const scheduledFor = new Date(Date.now() + delaySeconds * 1000).toISOString();
    logger.scheduler('Scheduling message', { chatId, agentId, delaySeconds, scheduledFor, text: messageText?.slice(0, 50) });
    return schedule({
      chatId,
      agentId,
      type: 'send-message',
      scheduledFor,
      messageText,
      messageId,
    });
  }, [schedule]);

  // Schedule multiple messages with delays between them
  const scheduleMessages = useCallback((
    chatId: string,
    agentId: string,
    messages: string[],
    initialDelaySeconds: number,
    delayBetweenSeconds: number,
    messageId?: string
  ): string[] => {
    const ids: string[] = [];
    let currentDelay = initialDelaySeconds;

    for (const messageText of messages) {
      ids.push(scheduleMessage(chatId, agentId, messageText, currentDelay, messageId));
      currentDelay += delayBetweenSeconds;
    }

    return ids;
  }, [scheduleMessage]);

  // Cancel a specific action
  const cancelAction = useCallback((id: string) => {
    updateScheduledAction(id, { status: 'cancelled' });
    updatePendingCount();
  }, [updatePendingCount]);

  // Cancel all actions for a chat
  const cancelChat = useCallback((chatId: string) => {
    cancelActionsForChat(chatId);
    updatePendingCount();
  }, [updatePendingCount]);

  // Get actions for a specific chat
  const getActionsForChat = useCallback((chatId: string): ScheduledAutopilotAction[] => {
    const actions = loadScheduledActions();
    return actions.filter(a => a.chatId === chatId);
  }, []);

  // Handle visibility change - pause when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - we could pause, but for autopilot we want to keep running
        // Just noting the behavior here
      } else {
        // Tab is visible again - process any pending actions
        if (isRunning) {
          processNextAction();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, processNextAction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isRunning,
    pendingCount,
    start,
    stop,
    schedule,
    scheduleMessage,
    scheduleMessages,
    cancelAction,
    cancelChat,
    getActionsForChat,
    // Utility exports for use elsewhere
    calculateReplyDelay,
    isWithinActivityHours,
    calculateTypingDuration,
    calculateReadReceiptDelay,
    calculateMultiMessageDelay,
  };
}
