/**
 * Simple event bus for autopilot real-time updates
 * Allows components to subscribe to events without polling
 */

import { logger } from './logger';

export type AutopilotEventType =
  | 'activity-added'
  | 'action-scheduled'
  | 'action-executing'
  | 'action-completed'
  | 'action-failed'
  | 'config-changed';

export interface AutopilotEvent {
  type: AutopilotEventType;
  chatId?: string;
  data?: unknown;
  timestamp: number;
}

type EventCallback = (event: AutopilotEvent) => void;

class AutopilotEventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private globalListeners: Set<EventCallback> = new Set();

  /**
   * Subscribe to a specific event type
   */
  on(eventType: AutopilotEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Subscribe to all events
   */
  onAny(callback: EventCallback): () => void {
    this.globalListeners.add(callback);
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  /**
   * Emit an event
   */
  emit(type: AutopilotEventType, chatId?: string, data?: unknown): void {
    const event: AutopilotEvent = {
      type,
      chatId,
      data,
      timestamp: Date.now(),
    };

    // Notify specific listeners
    this.listeners.get(type)?.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        logger.error('[AutopilotEventBus] Error in event handler:', error instanceof Error ? error : String(error));
      }
    });

    // Notify global listeners
    this.globalListeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        logger.error('[AutopilotEventBus] Error in global handler:', error instanceof Error ? error : String(error));
      }
    });
  }

  /**
   * Clear all listeners (for testing/cleanup)
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

// Singleton instance
export const autopilotEvents = new AutopilotEventBus();

// Helper functions for emitting common events
export function emitActivityAdded(chatId: string, activityType: string): void {
  autopilotEvents.emit('activity-added', chatId, { activityType });
}

export function emitActionScheduled(chatId: string, actionId: string, scheduledFor: string): void {
  autopilotEvents.emit('action-scheduled', chatId, { actionId, scheduledFor });
}

export function emitActionExecuting(chatId: string, actionId: string): void {
  autopilotEvents.emit('action-executing', chatId, { actionId });
}

export function emitActionCompleted(chatId: string, actionId: string): void {
  autopilotEvents.emit('action-completed', chatId, { actionId });
}

export function emitActionFailed(chatId: string, actionId: string, error: string): void {
  autopilotEvents.emit('action-failed', chatId, { actionId, error });
}

export function emitConfigChanged(chatId: string): void {
  autopilotEvents.emit('config-changed', chatId);
}
