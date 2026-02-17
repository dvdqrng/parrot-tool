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
  MessageCountParams,
  TimeBasedParams,
} from './types';
import { triggerStore } from './store';
import { getOrchestrator } from '../agents/orchestrator';

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
    // This would need access to message history
    // For now, return false (would be checked by scheduler separately)
    return false;
  },

  context_change: (condition, context) => {
    if (!context.event || context.event.type !== 'context_change') return false;
    // Would check specific context changes
    return true;
  },

  action_due: (condition, context) => {
    // This would need access to action items
    // For now, return false (would be checked by scheduler separately)
    return false;
  },

  message_count: (condition, context) => {
    // This would need access to message counts
    // For now, return false
    return false;
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
    console.log(`[Trigger] Notification: ${params.title} - ${params.message}`);
    // Would integrate with notification system
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
    // Would generate summary
    console.log(`[Trigger] Summarize ${params.scope} for ${params.contactId || 'all'}`);
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
    console.log(`[Trigger] Surface insight: ${params.insightType} - ${params.content}`);
    // Would surface to companion UI
    return { success: true, output: { surfaced: true } };
  },

  reminder: async (action, trigger) => {
    const params = action.params as any;
    console.log(`[Trigger] Reminder: ${params.content}`);
    // Would create reminder
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

    for (const trigger of dueTriggers.slice(0, this.config.maxTriggersPerCheck)) {
      const result = await this.fireTrigger(trigger);
      if (result) {
        firedEvents.push(result);
      }
    }

    // Cleanup expired triggers periodically
    if (Math.random() < 0.1) {
      await triggerStore.cleanup();
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
 * Start the global trigger scheduler
 */
export function startTriggerScheduler(): void {
  getTriggerScheduler().start();
}

/**
 * Stop the global trigger scheduler
 */
export function stopTriggerScheduler(): void {
  getTriggerScheduler().stop();
}
