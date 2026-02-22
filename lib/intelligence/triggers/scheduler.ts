/**
 * Trigger Scheduler
 * Manages trigger evaluation and execution
 */

import { BeeperMessage } from '@/lib/types';
import {
  Trigger,
  TriggerCondition,
  TriggerAction,
  TriggerEvent,
  ConditionType,
  KeywordParams,
  MessageFromParams,
  NoContactParams,
  ActionDueParams,
  MessageCountParams,
  TimeBasedParams,
} from './types';
import { triggerStore } from './store';
import { getOrchestrator } from '../agents/orchestrator';
import { loadCachedMessages } from '@/lib/storage';
import { contactStore } from '../knowledge/store';
import { eventBus } from '../event-bus';
import { aiLog } from '../activity-log';

// ============================================
// SCHEDULER CONFIG
// ============================================

export interface SchedulerConfig {
  checkIntervalMs: number;
  maxTriggersPerCheck: number;
  enableEventTriggers: boolean;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  checkIntervalMs: 60000, // 1 minute
  maxTriggersPerCheck: 10,
  enableEventTriggers: true,
};

// ============================================
// CONDITION EVALUATORS
// ============================================

type ConditionEvaluator = (
  condition: TriggerCondition,
  context: EvaluationContext
) => boolean;

export interface EvaluationContext {
  message?: BeeperMessage;
  contactId?: string;
  chatId?: string;
  event?: {
    type: string;
    data: unknown;
  };
}

const conditionEvaluators: Record<ConditionType, ConditionEvaluator> = {
  message_from: (condition, context) => {
    if (!context.message) return false;
    const params = condition.params as MessageFromParams;

    // Check if message is from the specified contact
    if (context.message.chatId !== params.contactId) return false;
    if (params.platform && context.message.platform !== params.platform) return false;

    return true;
  },

  keyword: (condition, context) => {
    if (!context.message?.text) return false;
    const params = condition.params as KeywordParams;
    const text = params.caseSensitive
      ? context.message.text
      : context.message.text.toLowerCase();

    const keywords = params.caseSensitive
      ? params.keywords
      : params.keywords.map(k => k.toLowerCase());

    if (params.matchMode === 'all') {
      return keywords.every(k => text.includes(k));
    } else {
      return keywords.some(k => text.includes(k));
    }
  },

  no_contact: (condition, context) => {
    const params = condition.params as NoContactParams;
    const allMessages = loadCachedMessages();
    const chatMessages = allMessages.filter(m => m.chatId === params.contactId);

    if (chatMessages.length === 0) {
      console.log(`[TriggerScheduler] no_contact: no messages found for ${params.contactId} → TRUE`);
      return true;
    }

    // Find the most recent message
    const mostRecent = chatMessages.reduce((latest, msg) => {
      const t = new Date(msg.timestamp).getTime();
      return t > latest ? t : latest;
    }, 0);

    const daysSinceContact = (Date.now() - mostRecent) / (24 * 60 * 60 * 1000);
    const result = daysSinceContact >= params.days;
    console.log(`[TriggerScheduler] no_contact: ${params.contactId} last contact ${daysSinceContact.toFixed(1)} days ago (threshold: ${params.days}) → ${result}`);
    return result;
  },

  context_change: (condition, context) => {
    if (!context.event || context.event.type !== 'context_change') return false;
    return true;
  },

  action_due: (condition, context) => {
    const params = condition.params as ActionDueParams;
    // This runs async but condition evaluators are sync - we check cached data
    // The scheduler's checkTriggers will handle async action_due separately
    // For event-based evaluation, check if there's a due action item in the event data
    if (context.event?.type === 'extraction_complete' || context.event?.type === 'worker_tick') {
      // Signal that we should check action items - actual check happens in scheduler
      return true;
    }
    return false;
  },

  message_count: (condition, context) => {
    const params = condition.params as MessageCountParams;
    const allMessages = loadCachedMessages();
    const chatMessages = allMessages
      .filter(m => m.chatId === params.contactId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Count consecutive messages from specified direction without a reply
    let count = 0;
    for (const msg of chatMessages) {
      const isFromContact = !msg.isFromMe;
      if (params.direction === 'from_contact' && isFromContact) {
        count++;
      } else if (params.direction === 'from_me' && msg.isFromMe) {
        count++;
      } else {
        break; // Reply found, stop counting
      }
    }

    const result = count >= params.count;
    console.log(`[TriggerScheduler] message_count: ${count} consecutive ${params.direction} messages for ${params.contactId} (threshold: ${params.count}) → ${result}`);
    return result;
  },

  time_based: (condition, context) => {
    const params = condition.params as TimeBasedParams;
    const now = new Date();

    if (now.getHours() !== params.hour) return false;
    if (params.minute !== undefined && now.getMinutes() !== params.minute) return false;

    if (params.days && params.days.length > 0) {
      const dayNames: Record<number, string> = {
        0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
      };
      const today = dayNames[now.getDay()];
      if (!params.days.includes(today as any)) return false;
    }

    return true;
  },
};

// ============================================
// ACTION EXECUTORS
// ============================================

type ActionExecutor = (
  action: TriggerAction,
  trigger: Trigger,
  context?: EvaluationContext
) => Promise<{ success: boolean; output?: unknown; error?: string }>;

const actionExecutors: Record<string, ActionExecutor> = {
  notify: async (action, trigger) => {
    const params = action.params as any;
    aiLog.action('trigger', `Notification: ${params.title} - ${params.message}`);
    eventBus.emit({
      type: 'trigger_fired',
      triggerName: trigger.name,
      triggerId: trigger.id,
      actionType: 'notify',
      data: { title: params.title, message: params.message, priority: params.priority },
    });
    return { success: true, output: { notified: true } };
  },

  draft: async (action, trigger) => {
    const params = action.params as any;
    const orchestrator = getOrchestrator();

    const agent = await orchestrator.route({
      type: 'conversation',
      contextId: params.contactId,
      platform: params.platform,
      priority: 'normal',
      payload: { intent: params.intent },
    });

    return { success: true, output: { agentId: agent.id } };
  },

  summarize: async (action, trigger) => {
    const params = action.params as any;
    aiLog.action('trigger', `Summarize ${params.scope} for ${params.contactId || 'all'}`);
    eventBus.emit({
      type: 'trigger_fired',
      triggerName: trigger.name,
      triggerId: trigger.id,
      actionType: 'summarize',
      data: { scope: params.scope, contactId: params.contactId },
    });
    return { success: true, output: { summary: 'Summary would be generated' } };
  },

  execute_agent: async (action, trigger) => {
    const params = action.params as any;
    const orchestrator = getOrchestrator();

    const agent = await orchestrator.route({
      type: params.agentType,
      contextId: params.contextId,
      priority: 'normal',
      payload: params.payload || {},
    });

    return { success: true, output: { agentId: agent.id } };
  },

  surface_insight: async (action, trigger) => {
    const params = action.params as any;
    aiLog.action('trigger', `Surface insight: ${params.insightType} - ${params.content}`);
    eventBus.emit({
      type: 'trigger_fired',
      triggerName: trigger.name,
      triggerId: trigger.id,
      actionType: 'surface_insight',
      data: { insightType: params.insightType, content: params.content, contactId: params.contactId },
    });
    return { success: true, output: { surfaced: true } };
  },

  reminder: async (action, trigger) => {
    const params = action.params as any;
    aiLog.action('trigger', `Reminder: ${params.content}`);
    eventBus.emit({
      type: 'trigger_fired',
      triggerName: trigger.name,
      triggerId: trigger.id,
      actionType: 'reminder',
      data: { content: params.content, contactId: params.contactId },
    });
    return { success: true, output: { reminded: true } };
  },
};

// ============================================
// SCHEDULER CLASS
// ============================================

export class TriggerScheduler {
  private config: SchedulerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.intervalId = setInterval(
      () => this.checkTriggers(),
      this.config.checkIntervalMs
    );

    console.log('[TriggerScheduler] Started');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[TriggerScheduler] Stopped');
  }

  /**
   * Check and fire due triggers
   */
  async checkTriggers(): Promise<TriggerEvent[]> {
    const firedEvents: TriggerEvent[] = [];

    // Get scheduled triggers that are due
    const dueTriggers = await triggerStore.getDue();

    if (dueTriggers.length > 0) {
      console.log(`[TriggerScheduler] checkTriggers: ${dueTriggers.length} triggers due`, dueTriggers.map(t => `${t.name} (${t.type})`));
    }

    for (const trigger of dueTriggers.slice(0, this.config.maxTriggersPerCheck)) {
      const result = await this.fireTrigger(trigger);
      if (result) {
        firedEvents.push(result);
      }
    }

    // Cleanup expired triggers periodically
    if (Math.random() < 0.1) {
      const cleaned = await triggerStore.cleanup();
      if (cleaned > 0) {
        console.log(`[TriggerScheduler] Cleaned up ${cleaned} expired triggers`);
      }
    }

    return firedEvents;
  }

  /**
   * Evaluate triggers against an event
   */
  async evaluateEvent(context: EvaluationContext): Promise<TriggerEvent[]> {
    if (!this.config.enableEventTriggers) return [];

    const firedEvents: TriggerEvent[] = [];

    // Get all enabled conditional/pattern/event triggers
    const triggers = await triggerStore.getByStatus('enabled');
    const eventTriggers = triggers.filter(t =>
      ['conditional', 'pattern', 'event'].includes(t.type)
    );

    if (eventTriggers.length > 0) {
      console.log(`[TriggerScheduler] evaluateEvent: checking ${eventTriggers.length} event triggers`, {
        messageId: context.message?.id,
        chatId: context.chatId,
        eventType: context.event?.type,
      });
    }

    for (const trigger of eventTriggers) {
      if (this.evaluateConditions(trigger, context)) {
        // Check cooldown
        if (trigger.cooldownMinutes && trigger.lastFired) {
          const cooldownEnd = new Date(trigger.lastFired);
          cooldownEnd.setMinutes(cooldownEnd.getMinutes() + trigger.cooldownMinutes);
          if (new Date() < cooldownEnd) {
            continue;
          }
        }

        const result = await this.fireTrigger(trigger, context);
        if (result) {
          firedEvents.push(result);
        }
      }
    }

    return firedEvents;
  }

  /**
   * Evaluate trigger conditions
   */
  private evaluateConditions(
    trigger: Trigger,
    context: EvaluationContext
  ): boolean {
    if (!trigger.conditions || trigger.conditions.length === 0) {
      return true; // No conditions = always matches
    }

    const mode = trigger.conditionMode || 'all';
    const results = trigger.conditions.map(condition => {
      const evaluator = conditionEvaluators[condition.type];
      return evaluator ? evaluator(condition, context) : false;
    });

    if (mode === 'all') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  /**
   * Fire a trigger
   */
  async fireTrigger(
    trigger: Trigger,
    context?: EvaluationContext
  ): Promise<TriggerEvent | null> {
    try {
      const executor = actionExecutors[trigger.action.type];
      if (!executor) {
        console.error(`[TriggerScheduler] Unknown action type: ${trigger.action.type}`);
        return null;
      }

      const result = await executor(trigger.action, trigger, context);

      // Record the fire event
      const event = await triggerStore.recordFire(trigger.id, {
        triggerId: trigger.id,
        condition: context
          ? trigger.conditions?.[0]
          : undefined,
        actionTaken: trigger.action,
        result,
      });

      console.log(
        `[TriggerScheduler] Fired trigger ${trigger.name} (${trigger.id}):`,
        result.success ? 'success' : `failed: ${result.error}`
      );

      return event;
    } catch (error) {
      console.error(`[TriggerScheduler] Error firing trigger ${trigger.id}:`, error);

      await triggerStore.recordFire(trigger.id, {
        triggerId: trigger.id,
        actionTaken: trigger.action,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      return null;
    }
  }

  /**
   * Handle incoming message (for message-based triggers)
   */
  async onMessage(message: BeeperMessage): Promise<TriggerEvent[]> {
    return this.evaluateEvent({
      message,
      contactId: message.chatId,
      chatId: message.chatId,
    });
  }

  /**
   * Handle system event
   */
  async onEvent(eventType: string, data: unknown): Promise<TriggerEvent[]> {
    return this.evaluateEvent({
      event: { type: eventType, data },
    });
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    config: SchedulerConfig;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let scheduler: TriggerScheduler | null = null;

export function getTriggerScheduler(): TriggerScheduler {
  if (!scheduler) {
    scheduler = new TriggerScheduler();
  }
  return scheduler;
}

/**
 * Register default system triggers
 * These are created once on startup if they don't already exist
 */
async function registerDefaultTriggers(): Promise<void> {
  const existing = await triggerStore.getAll();
  if (existing.length > 0) {
    // Already have triggers registered
    return;
  }

  console.log('[TriggerScheduler] ✓ Registering default triggers (first-time setup)...');

  // 1. Daily relationship check - find contacts you haven't talked to in 7+ days
  await triggerStore.create({
    type: 'recurring',
    name: 'Stale Contact Check',
    description: 'Check for contacts with no recent activity',
    schedule: {
      rrule: { freq: 'daily', byHour: 10, byMinute: 0 },
    },
    action: {
      type: 'surface_insight',
      params: {
        insightType: 'suggestion',
        content: 'Review contacts you haven\'t talked to recently',
      },
    },
    cooldownMinutes: 60 * 23, // Once per day max
  });

  // 2. Action item reminder - check for upcoming due dates
  await triggerStore.create({
    type: 'recurring',
    name: 'Action Item Reminder',
    description: 'Remind about pending action items',
    schedule: {
      rrule: { freq: 'daily', byHour: 9, byMinute: 0 },
    },
    action: {
      type: 'notify',
      params: {
        title: 'Pending Action Items',
        message: 'You have action items that may need attention',
        priority: 'normal',
      },
    },
    cooldownMinutes: 60 * 23,
  });

  // 3. Weekly relationship summary
  await triggerStore.create({
    type: 'recurring',
    name: 'Weekly Relationship Summary',
    description: 'Generate weekly summary of communication patterns',
    schedule: {
      rrule: { freq: 'weekly', byDay: ['MO'], byHour: 9, byMinute: 0 },
    },
    action: {
      type: 'summarize',
      params: {
        scope: 'week',
      },
    },
    cooldownMinutes: 60 * 24 * 6, // Once per week max
  });

  const stats = await triggerStore.getStats();
  console.log('[TriggerScheduler] ✓ Default triggers registered', {
    total: stats.total,
    byType: stats.byType,
  });
}

/**
 * Start the global trigger scheduler
 */
export function startTriggerScheduler(): void {
  getTriggerScheduler().start();
  // Register defaults async (non-blocking)
  registerDefaultTriggers().catch(err =>
    console.error('[TriggerScheduler] Failed to register defaults:', err)
  );
}

/**
 * Stop the global trigger scheduler
 */
export function stopTriggerScheduler(): void {
  getTriggerScheduler().stop();
}
