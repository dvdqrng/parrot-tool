/**
 * Intelligence Event Bus
 *
 * Central event system that enables reactive behaviors across the intelligence layer.
 * When messages arrive, multiple listeners can respond: trigger scheduler, proactive engine,
 * extraction pipeline, activity log, etc.
 */

import { BeeperMessage } from '@/lib/types';
import { ContactFact } from './knowledge/types';
import { UserIntelligence } from './user-state/types';
import { ProactiveAction } from './proactive-engine';
import { AttentionScore } from './attention-model';

// ============================================
// EVENT TYPES
// ============================================

export type IntelligenceEvent =
  // Message events
  | { type: 'message_received'; message: BeeperMessage; chatId: string }
  | { type: 'message_sent'; message: BeeperMessage; chatId: string }
  | { type: 'messages_loaded'; chatId: string; count: number }

  // Chat events
  | { type: 'chat_opened'; chatId: string; contactName?: string; platform?: string }
  | { type: 'chat_closed'; chatId: string }

  // Companion events
  | { type: 'companion_opened'; chatId: string; contactName?: string; platform?: string }
  | { type: 'companion_closed'; chatId: string }
  | { type: 'ai_enabled'; chatId: string; contactName?: string; platform?: string }
  | { type: 'ai_disabled'; chatId: string }
  | { type: 'draft_requested'; chatId: string; intent?: string }
  | { type: 'draft_accepted'; chatId: string; draft: string }
  | { type: 'draft_rejected'; chatId: string; draft: string }

  // Extraction events
  | { type: 'extraction_queued'; chatId: string; priority: string }
  | { type: 'extraction_started'; chatId: string }
  | { type: 'extraction_complete'; chatId: string; facts: ContactFact[] }
  | { type: 'extraction_failed'; chatId: string; error: string }

  // User state events
  | { type: 'user_state_updated'; updates: Partial<UserIntelligence> }
  | { type: 'ambient_processing_complete'; topicsFound: number }

  // Proactive events
  | { type: 'proactive_action_triggered'; action: ProactiveAction; chatId?: string }
  | { type: 'proactive_action_dismissed'; actionType: string; chatId?: string }

  // Trigger events
  | { type: 'trigger_fired'; triggerId: string; triggerName: string; actionType?: string; data?: Record<string, unknown> }
  | { type: 'trigger_created'; triggerId: string }
  | { type: 'trigger_deleted'; triggerId: string }

  // Agent events
  | { type: 'agent_spawned'; agentId: string; agentType: string; contextId?: string }
  | { type: 'agent_activated'; agentId: string }
  | { type: 'agent_deactivated'; agentId: string; newLifecycle: string }

  // Global attention events
  | { type: 'global_attention_update'; scores: AttentionScore[]; timestamp: string }

  // Soul events
  | { type: 'soul_updated'; traitCount: number; newTraits: number }

  // System events
  | { type: 'worker_started' }
  | { type: 'worker_stopped' }
  | { type: 'worker_tick'; tickNumber: number }
  | { type: 'error'; source: string; message: string; error?: unknown };

// ============================================
// EVENT HANDLER TYPE
// ============================================

export type EventHandler<T extends IntelligenceEvent = IntelligenceEvent> =
  (event: T) => void | Promise<void>;

// ============================================
// EVENT BUS CLASS
// ============================================

class IntelligenceEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private eventHistory: Array<{ event: IntelligenceEvent; timestamp: string }> = [];
  private readonly MAX_HISTORY = 100;
  private isDebugMode = false;

  /**
   * Subscribe to events of a specific type
   * Returns an unsubscribe function
   */
  on<T extends IntelligenceEvent['type']>(
    eventType: T | '*',
    handler: EventHandler<Extract<IntelligenceEvent, { type: T }>>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler);
    };
  }

  /**
   * Subscribe to events only once
   */
  once<T extends IntelligenceEvent['type']>(
    eventType: T,
    handler: EventHandler<Extract<IntelligenceEvent, { type: T }>>
  ): () => void {
    const wrappedHandler: EventHandler = (event) => {
      this.handlers.get(eventType)?.delete(wrappedHandler);
      return handler(event as Extract<IntelligenceEvent, { type: T }>);
    };

    return this.on(eventType, wrappedHandler as any);
  }

  /**
   * Emit an event to all registered handlers
   */
  emit(event: IntelligenceEvent): void {
    const timestamp = new Date().toISOString();

    // Store in history
    this.eventHistory.push({ event, timestamp });
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory.shift();
    }

    // Debug logging
    if (this.isDebugMode) {
      console.log(`[EventBus] ${event.type}`, event);
    }

    // Call type-specific handlers
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          const result = handler(event);
          // Handle async handlers
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error(`[EventBus] Async handler error for ${event.type}:`, error);
              this.emit({
                type: 'error',
                source: 'event_handler',
                message: `Handler for ${event.type} failed`,
                error,
              });
            });
          }
        } catch (error) {
          console.error(`[EventBus] Handler error for ${event.type}:`, error);
          // Emit error event (but don't recurse if it's already an error event)
          if (event.type !== 'error') {
            this.emit({
              type: 'error',
              source: 'event_handler',
              message: `Handler for ${event.type} failed`,
              error,
            });
          }
        }
      }
    }

    // Call global '*' handlers
    const globalHandlers = this.handlers.get('*');
    if (globalHandlers) {
      for (const handler of globalHandlers) {
        try {
          const result = handler(event);
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error('[EventBus] Global handler error:', error);
            });
          }
        } catch (error) {
          console.error('[EventBus] Global handler error:', error);
        }
      }
    }
  }

  /**
   * Get recent event history
   */
  getHistory(limit?: number): Array<{ event: IntelligenceEvent; timestamp: string }> {
    const history = [...this.eventHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get history filtered by event type
   */
  getHistoryByType(eventType: IntelligenceEvent['type'], limit?: number): Array<{ event: IntelligenceEvent; timestamp: string }> {
    const filtered = this.eventHistory
      .filter(h => h.event.type === eventType)
      .reverse();
    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clearAllHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled;
    console.log(`[EventBus] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get handler count for debugging
   */
  getHandlerCount(eventType?: string): number {
    if (eventType) {
      return this.handlers.get(eventType)?.size || 0;
    }
    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.size;
    }
    return total;
  }

  /**
   * Get all registered event types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const eventBus = new IntelligenceEventBus();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Emit a message received event
 */
export function emitMessageReceived(message: BeeperMessage): void {
  eventBus.emit({
    type: 'message_received',
    message,
    chatId: message.chatId,
  });
}

/**
 * Emit a message sent event
 */
export function emitMessageSent(message: BeeperMessage): void {
  eventBus.emit({
    type: 'message_sent',
    message,
    chatId: message.chatId,
  });
}

/**
 * Emit companion opened event
 */
export function emitCompanionOpened(chatId: string, contactName?: string, platform?: string): void {
  eventBus.emit({
    type: 'companion_opened',
    chatId,
    contactName,
    platform,
  });
}

/**
 * Emit AI enabled event - triggers full history loading and extraction
 */
export function emitAiEnabled(chatId: string, contactName?: string, platform?: string): void {
  eventBus.emit({
    type: 'ai_enabled',
    chatId,
    contactName,
    platform,
  });
}

/**
 * Emit AI disabled event
 */
export function emitAiDisabled(chatId: string): void {
  eventBus.emit({
    type: 'ai_disabled',
    chatId,
  });
}

/**
 * Emit error event
 */
export function emitError(source: string, message: string, error?: unknown): void {
  eventBus.emit({
    type: 'error',
    source,
    message,
    error,
  });
}

// ============================================
// DEBUG HELPERS
// ============================================

/**
 * Log all events to console (for debugging)
 */
export function enableEventLogging(): () => void {
  return eventBus.on('*', (event) => {
    console.log(`[EventBus:LOG] ${event.type}`, event);
  });
}

/**
 * Count events by type over a time window
 */
export function getEventStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const { event } of eventBus.getHistory()) {
    stats[event.type] = (stats[event.type] || 0) + 1;
  }
  return stats;
}
