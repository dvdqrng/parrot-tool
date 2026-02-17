/**
 * Intelligence Background Worker
 *
 * The "heartbeat" of the intelligence layer. Runs continuously in the background,
 * processing queues, checking for proactive opportunities, and maintaining agent lifecycles.
 *
 * This solves Mistake #1: Components built but never started.
 */

import { eventBus, emitError, IntelligenceEvent } from './event-bus';
import { extractionQueueStore, contactStore, agentStore } from './knowledge/store';
import { aiLog } from './activity-log';
import { getTriggerScheduler, startTriggerScheduler, stopTriggerScheduler } from './triggers/scheduler';
import { getOrchestrator } from './agents/orchestrator';
import {
  determineProactiveAction,
  ProactiveContext,
  ProactiveTrigger,
  generateProactiveInsight,
  analyzeConversationContext,
} from './proactive-engine';
import { processAmbientStream } from './user-state/ambient-processor';
import { extractTier2, Tier2ExtractionRequest } from './extraction/tier2-llm';
import { metrics } from './instrumentation/metrics';
import { hasApiKey } from '@/lib/intelligence-settings';
import { getMessagesByIds, getMessagesByChatId, getCrmContactByChatId, loadCachedMessages } from '@/lib/storage';
import { createDefaultContactIntelligence, ContactIntelligence } from './knowledge/types';

// ============================================
// LOGGING
// ============================================

const LOG_PREFIX = '[BackgroundWorker]';

function log(method: string, message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${method}: ${message}`, data !== undefined ? data : '');
}

function logError(method: string, message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ${method}: ${message}`, error);
}

// ============================================
// WORKER CONFIGURATION
// ============================================

export interface WorkerConfig {
  tickIntervalMs: number;
  extractionBatchSize: number;
  ambientProcessingIntervalMs: number;
  agentMaintenanceIntervalMs: number;
  proactiveCheckIntervalMs: number;
  maxExtractionRetries: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  tickIntervalMs: 30000, // 30 seconds
  extractionBatchSize: 5,
  ambientProcessingIntervalMs: 5 * 60 * 1000, // 5 minutes
  agentMaintenanceIntervalMs: 10 * 60 * 1000, // 10 minutes
  proactiveCheckIntervalMs: 60 * 1000, // 1 minute
  maxExtractionRetries: 3,
};

// Only process chats with activity in the last 7 days
const RECENCY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================
// WORKER STATE
// ============================================

interface WorkerState {
  isRunning: boolean;
  tickCount: number;
  lastAmbientProcessing: number;
  lastAgentMaintenance: number;
  lastProactiveCheck: number;
  activeChats: Set<string>; // chatIds currently being viewed
  pendingExtractionMessages: Map<string, string[]>; // chatId -> messageIds pending extraction
  errors: Array<{ timestamp: string; source: string; message: string }>;
}

// ============================================
// BACKGROUND WORKER CLASS
// ============================================

export class IntelligenceBackgroundWorker {
  private config: WorkerConfig;
  private state: WorkerState;
  private intervalId: NodeJS.Timeout | null = null;
  private eventUnsubscribers: Array<() => void> = [];

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isRunning: false,
      tickCount: 0,
      lastAmbientProcessing: 0,
      lastAgentMaintenance: 0,
      lastProactiveCheck: 0,
      activeChats: new Set(),
      pendingExtractionMessages: new Map(),
      errors: [],
    };
  }

  /**
   * Start the background worker
   */
  start(): void {
    if (this.state.isRunning) {
      log('start', 'Already running, skipping');
      return;
    }

    log('start', 'Starting intelligence background worker...', {
      config: this.config,
    });

    this.state.isRunning = true;

    // Start the trigger scheduler
    startTriggerScheduler();

    // Set up event listeners
    this.setupEventListeners();

    // Start the main processing loop
    this.intervalId = setInterval(() => this.tick(), this.config.tickIntervalMs);

    // Run immediately
    this.tick();

    // Emit worker started event
    eventBus.emit({ type: 'worker_started' });

    log('start', 'Background worker started successfully');
  }

  /**
   * Stop the background worker
   */
  stop(): void {
    if (!this.state.isRunning) {
      log('stop', 'Not running, skipping');
      return;
    }

    log('stop', 'Stopping background worker...');

    this.state.isRunning = false;

    // Stop the interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop trigger scheduler
    stopTriggerScheduler();

    // Unsubscribe from all events
    for (const unsubscribe of this.eventUnsubscribers) {
      unsubscribe();
    }
    this.eventUnsubscribers = [];

    // Emit worker stopped event
    eventBus.emit({ type: 'worker_stopped' });

    log('stop', 'Background worker stopped');
  }

  /**
   * Main tick - runs every tickIntervalMs
   */
  private async tick(): Promise<void> {
    if (!this.state.isRunning) return;

    this.state.tickCount++;
    const now = Date.now();

    log('tick', `Tick #${this.state.tickCount}`, {
      activeChats: this.state.activeChats.size,
      hasApiKey: hasApiKey(),
    });

    eventBus.emit({ type: 'worker_tick', tickNumber: this.state.tickCount });

    try {
      // 1. Flush pending messages to extraction queue, then process
      await this.flushPendingExtractions();
      await this.processExtractionQueue();

      // 2. Run ambient processing if due
      if (now - this.state.lastAmbientProcessing >= this.config.ambientProcessingIntervalMs) {
        await this.runAmbientProcessing();
        this.state.lastAmbientProcessing = now;
      }

      // 3. Check for proactive opportunities if due
      if (now - this.state.lastProactiveCheck >= this.config.proactiveCheckIntervalMs) {
        await this.checkProactiveOpportunities();
        this.state.lastProactiveCheck = now;
      }

      // 4. Run agent lifecycle maintenance if due
      if (now - this.state.lastAgentMaintenance >= this.config.agentMaintenanceIntervalMs) {
        await this.runAgentMaintenance();
        this.state.lastAgentMaintenance = now;
      }

    } catch (error) {
      logError('tick', 'Tick failed', error);
      this.recordError('tick', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Set up event listeners for reactive behaviors
   */
  private setupEventListeners(): void {
    const scheduler = getTriggerScheduler();

    // When message received, evaluate triggers and queue for extraction
    this.eventUnsubscribers.push(
      eventBus.on('message_received', async (event) => {
        if (event.type !== 'message_received') return;

        log('onMessageReceived', 'Processing message', {
          chatId: event.chatId,
          messageId: event.message.id,
        });

        try {
          // Queue message for extraction (batched per chat)
          this.queueMessageForExtraction(event.chatId, event.message.id);

          // Evaluate message-based triggers
          const firedTriggers = await scheduler.onMessage(event.message);

          if (firedTriggers.length > 0) {
            log('onMessageReceived', `Fired ${firedTriggers.length} triggers`);
          }

          // Check if this chat is active and needs proactive action
          if (this.state.activeChats.has(event.chatId)) {
            await this.checkProactiveForChat(event.chatId, 'new_message_received');
          }
        } catch (error) {
          logError('onMessageReceived', 'Failed to process message', error);
        }
      })
    );

    // When companion opened, run proactive analysis
    this.eventUnsubscribers.push(
      eventBus.on('companion_opened', async (event) => {
        if (event.type !== 'companion_opened') return;

        log('onCompanionOpened', 'Companion opened', { chatId: event.chatId });

        this.state.activeChats.add(event.chatId);
        await this.checkProactiveForChat(event.chatId, 'panel_opened');
      })
    );

    // When companion closed, remove from active chats
    this.eventUnsubscribers.push(
      eventBus.on('companion_closed', (event) => {
        if (event.type !== 'companion_closed') return;

        log('onCompanionClosed', 'Companion closed', { chatId: event.chatId });
        this.state.activeChats.delete(event.chatId);
      })
    );

    // When AI is enabled for a chat, queue full history extraction
    this.eventUnsubscribers.push(
      eventBus.on('ai_enabled', async (event) => {
        if (event.type !== 'ai_enabled') return;

        log('onAiEnabled', 'AI enabled for chat - queueing full history extraction', {
          chatId: event.chatId,
          contactName: event.contactName,
        });

        // Add to active chats
        this.state.activeChats.add(event.chatId);

        // Queue the chat for high-priority extraction (full history)
        await this.queueFullHistoryExtraction(event.chatId, event.contactName);
      })
    );

    // When AI is disabled, remove from active chats
    this.eventUnsubscribers.push(
      eventBus.on('ai_disabled', (event) => {
        if (event.type !== 'ai_disabled') return;

        log('onAiDisabled', 'AI disabled for chat', { chatId: event.chatId });
        this.state.activeChats.delete(event.chatId);
      })
    );

    // When messages are loaded (e.g., during auto-load), queue for extraction if AI is enabled
    this.eventUnsubscribers.push(
      eventBus.on('messages_loaded', async (event) => {
        if (event.type !== 'messages_loaded') return;

        // Only queue extraction if this is an active (AI-enabled) chat
        if (!this.state.activeChats.has(event.chatId)) {
          log('onMessagesLoaded', `Messages loaded but AI not enabled for ${event.chatId}, skipping extraction`);
          return;
        }

        log('onMessagesLoaded', `History loaded for AI-enabled chat - queueing extraction`, {
          chatId: event.chatId,
          count: event.count,
        });

        // Queue the full history for extraction now that messages are cached
        await this.queueFullHistoryExtraction(event.chatId);
      })
    );

    // Track extraction events for metrics
    this.eventUnsubscribers.push(
      eventBus.on('extraction_complete', (event) => {
        if (event.type !== 'extraction_complete') return;
        metrics.tier2Extraction();
        log('onExtractionComplete', 'Extraction complete', {
          chatId: event.chatId,
          factsCount: event.facts.length,
        });
      })
    );

    // Log errors
    this.eventUnsubscribers.push(
      eventBus.on('error', (event) => {
        if (event.type !== 'error') return;
        this.recordError(event.source, event.message);
      })
    );

    // Bridge ALL events to the activity log for stream of consciousness visibility
    this.eventUnsubscribers.push(
      eventBus.on('*', (event) => {
        this.logEventToActivity(event);
      })
    );

    log('setupEventListeners', 'Event listeners configured', {
      listenerCount: this.eventUnsubscribers.length,
    });
  }

  /**
   * Log events to the activity log for stream of consciousness visibility
   */
  private logEventToActivity(event: IntelligenceEvent): void {
    // Skip worker_tick to reduce noise (already logged separately)
    if (event.type === 'worker_tick') return;

    const chatId = 'chatId' in event ? (event as any).chatId : undefined;

    switch (event.type) {
      case 'message_received':
        aiLog.observation('worker', `New message received`, chatId);
        break;
      case 'message_sent':
        aiLog.observation('worker', `Message sent`, chatId);
        break;
      case 'extraction_queued':
        aiLog.thought('knowledge', `Queued for extraction (${(event as any).priority})`, chatId);
        break;
      case 'extraction_started':
        aiLog.action('knowledge', `Starting knowledge extraction`, chatId);
        break;
      case 'extraction_complete':
        const factsCount = (event as any).facts?.length || 0;
        aiLog.knowledge(`Extracted ${factsCount} facts`, chatId || '', undefined, { factsCount });
        break;
      case 'extraction_failed':
        aiLog.error('knowledge', `Extraction failed: ${(event as any).error}`, chatId);
        break;
      case 'companion_opened':
        aiLog.action('companion', `Companion opened for ${(event as any).contactName || 'chat'}`, chatId);
        break;
      case 'companion_closed':
        aiLog.action('companion', `Companion closed`, chatId);
        break;
      case 'draft_requested':
        aiLog.action('drafter', `Draft requested`, chatId);
        break;
      case 'draft_accepted':
        aiLog.action('drafter', `Draft accepted by user`, chatId);
        break;
      case 'draft_rejected':
        aiLog.observation('drafter', `Draft rejected by user`, chatId);
        break;
      case 'agent_spawned':
        aiLog.action('orchestrator', `Spawned ${(event as any).agentType} agent`, (event as any).contextId);
        break;
      case 'agent_activated':
        aiLog.action('orchestrator', `Agent ${(event as any).agentId} activated`);
        break;
      case 'agent_deactivated':
        aiLog.observation('orchestrator', `Agent ${(event as any).agentId} → ${(event as any).newLifecycle}`);
        break;
      case 'proactive_action_triggered':
        const action = (event as any).action;
        aiLog.decision('proactive', `Triggered: ${action?.type} (${action?.priority})`, chatId);
        break;
      case 'trigger_fired':
        aiLog.action('trigger', `Trigger fired: ${(event as any).triggerName}`);
        break;
      case 'ai_enabled':
        aiLog.action('companion', `AI enabled for ${(event as any).contactName || 'chat'} - loading full history`, chatId);
        break;
      case 'ai_disabled':
        aiLog.action('companion', `AI disabled`, chatId);
        break;
      case 'messages_loaded':
        aiLog.observation('worker', `Loaded ${(event as any).count} messages from history`, chatId);
        break;
      case 'worker_started':
        aiLog.system('Background worker started');
        break;
      case 'worker_stopped':
        aiLog.system('Background worker stopped');
        break;
      case 'error':
        aiLog.error('system', `${(event as any).source}: ${(event as any).message}`);
        break;
      // Skip other events that are less important for stream visibility
    }
  }

  /**
   * Process items in the extraction queue
   */
  private async processExtractionQueue(): Promise<void> {
    if (!hasApiKey()) {
      return; // Skip extraction if no API key configured
    }

    try {
      const items = await extractionQueueStore.getNext(this.config.extractionBatchSize);

      if (items.length === 0) {
        return;
      }

      log('processExtractionQueue', `Processing ${items.length} extraction items`);

      for (const item of items) {
        try {
          // Skip if chat is not recent (might have been queued before recency check was added)
          if (!this.isChatRecent(item.chatId)) {
            log('processExtractionQueue', `Skipping ${item.chatId} - no recent activity`);
            await extractionQueueStore.markComplete(item.id);
            continue;
          }

          eventBus.emit({ type: 'extraction_started', chatId: item.chatId });

          // Get existing contact intelligence for context
          const existingContact = await contactStore.getByChatId(item.chatId);
          const existingFacts = existingContact?.facts || [];
          const existingRelationship = existingContact?.relationship;

          // Fetch messages - either by specific IDs or by chatId
          let messages;
          if (item.messageIds && item.messageIds.length > 0) {
            messages = getMessagesByIds(item.messageIds);
          } else {
            // Fall back to getting recent messages from chat
            messages = getMessagesByChatId(item.chatId, 50);
          }

          if (messages.length === 0) {
            log('processExtractionQueue', `Skipping ${item.chatId} - no messages found`);
            await extractionQueueStore.markComplete(item.id);
            eventBus.emit({
              type: 'extraction_complete',
              chatId: item.chatId,
              facts: [],
            });
            continue;
          }

          // Get contact info for the extraction request
          const crmContact = getCrmContactByChatId(item.chatId);
          const contactName = crmContact?.displayName || messages[0]?.senderName || 'Unknown';
          const platform = crmContact?.platformLinks?.[0]?.platform || messages[0]?.platform || 'unknown';

          log('processExtractionQueue', `Extracting from ${messages.length} messages for ${contactName}`);

          // Build extraction request
          const request: Tier2ExtractionRequest = {
            chatId: item.chatId,
            contactId: item.contactId,
            contactName,
            platform,
            messages,
            existingFacts,
            existingRelationship,
          };

          // Run extraction
          const result = await extractTier2(request);

          if (result.facts.length > 0 || result.actionItems.length > 0) {
            log('processExtractionQueue', `Extracted ${result.facts.length} facts, ${result.actionItems.length} action items`);

            // Store in contact intelligence store
            const contactIntelligence: ContactIntelligence = existingContact || createDefaultContactIntelligence({
              id: item.contactId,
              displayName: contactName,
              platformLinks: [{
                platform,
                chatId: item.chatId,
                accountId: '',
                addedAt: new Date().toISOString(),
              }],
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            // Merge new facts with existing
            const updatedIntelligence: ContactIntelligence = {
              ...contactIntelligence,
              facts: [...contactIntelligence.facts, ...result.facts],
              relationship: result.relationship,
              actionItems: [...contactIntelligence.actionItems, ...result.actionItems],
              summary: result.summary || contactIntelligence.summary,
              lastExtractionAt: new Date().toISOString(),
            };

            await contactStore.upsert(updatedIntelligence);
          }

          await extractionQueueStore.markComplete(item.id);
          eventBus.emit({
            type: 'extraction_complete',
            chatId: item.chatId,
            facts: result.facts,
          });

        } catch (error) {
          logError('processExtractionQueue', `Extraction failed for ${item.chatId}`, error);

          await extractionQueueStore.markFailed(
            item.id,
            error instanceof Error ? error.message : 'Unknown error'
          );

          eventBus.emit({
            type: 'extraction_failed',
            chatId: item.chatId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      logError('processExtractionQueue', 'Failed to process extraction queue', error);
    }
  }

  /**
   * Run ambient processing on sent messages
   */
  private async runAmbientProcessing(): Promise<void> {
    if (!hasApiKey()) {
      return;
    }

    try {
      log('runAmbientProcessing', 'Running ambient stream processing...');

      // Get sent messages from storage
      // Note: In practice, this would come from BeeperDataProvider or a store
      const sentMessages: any[] = []; // TODO: Wire up to actual sent messages

      if (sentMessages.length === 0) {
        return;
      }

      const updates = await processAmbientStream(sentMessages);
      const topicsFound = updates.activeTopics?.length || 0;

      if (Object.keys(updates).length > 0) {
        eventBus.emit({ type: 'user_state_updated', updates });
        eventBus.emit({ type: 'ambient_processing_complete', topicsFound });
      }

      log('runAmbientProcessing', 'Ambient processing complete', { topicsFound });

    } catch (error) {
      logError('runAmbientProcessing', 'Ambient processing failed', error);
    }
  }

  /**
   * Check for proactive opportunities across active chats
   * Only checks chats with recent activity (last 7 days)
   */
  private async checkProactiveOpportunities(): Promise<void> {
    if (this.state.activeChats.size === 0) {
      return;
    }

    // Filter to only recent active chats
    const recentActiveChats = Array.from(this.state.activeChats).filter(chatId =>
      this.isChatRecent(chatId)
    );

    if (recentActiveChats.length === 0) {
      log('checkProactiveOpportunities', 'No recent active chats to check');
      return;
    }

    log('checkProactiveOpportunities', 'Checking proactive opportunities', {
      activeChats: this.state.activeChats.size,
      recentActiveChats: recentActiveChats.length,
    });

    for (const chatId of recentActiveChats) {
      await this.checkProactiveForChat(chatId, 'scheduled_check');
    }
  }

  /**
   * Check for proactive action for a specific chat
   */
  private async checkProactiveForChat(
    chatId: string,
    trigger: ProactiveTrigger
  ): Promise<void> {
    try {
      // Build context (simplified - would need actual message history)
      const context: ProactiveContext = {
        chatId,
        recentMessages: [], // TODO: Get from store
        unreadCount: 0,
      };

      const action = determineProactiveAction(trigger, context);

      if (action) {
        log('checkProactiveForChat', 'Proactive action triggered', {
          chatId,
          trigger,
          actionType: action.type,
          priority: action.priority,
        });

        eventBus.emit({
          type: 'proactive_action_triggered',
          action,
          chatId,
        });

        // If high priority, try to generate actual content
        if (action.priority === 'high' && hasApiKey()) {
          if (action.type === 'context' || action.type === 'insight') {
            const analysis = await analyzeConversationContext(context);
            if (analysis) {
              log('checkProactiveForChat', 'Generated analysis', analysis);
            }
          }
        }
      }
    } catch (error) {
      logError('checkProactiveForChat', `Proactive check failed for ${chatId}`, error);
    }
  }

  /**
   * Run agent lifecycle maintenance
   */
  private async runAgentMaintenance(): Promise<void> {
    try {
      log('runAgentMaintenance', 'Running agent lifecycle maintenance...');

      const orchestrator = getOrchestrator();
      await orchestrator.runLifecycleMaintenance();

      const activeCount = await agentStore.countActive();
      const totalCount = await agentStore.count();

      log('runAgentMaintenance', 'Agent maintenance complete', {
        activeAgents: activeCount,
        totalAgents: totalCount,
      });

    } catch (error) {
      logError('runAgentMaintenance', 'Agent maintenance failed', error);
    }
  }

  /**
   * Record an error
   */
  private recordError(source: string, message: string): void {
    this.state.errors.push({
      timestamp: new Date().toISOString(),
      source,
      message,
    });

    // Keep only last 50 errors
    if (this.state.errors.length > 50) {
      this.state.errors = this.state.errors.slice(-50);
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    tickCount: number;
    activeChats: number;
    config: WorkerConfig;
    recentErrors: Array<{ timestamp: string; source: string; message: string }>;
  } {
    return {
      isRunning: this.state.isRunning,
      tickCount: this.state.tickCount,
      activeChats: this.state.activeChats.size,
      config: this.config,
      recentErrors: this.state.errors.slice(-10),
    };
  }

  /**
   * Manually trigger a tick (for testing)
   */
  async manualTick(): Promise<void> {
    await this.tick();
  }

  /**
   * Add a chat to active tracking
   */
  addActiveChat(chatId: string): void {
    this.state.activeChats.add(chatId);
    log('addActiveChat', 'Added active chat', { chatId });
  }

  /**
   * Remove a chat from active tracking
   */
  removeActiveChat(chatId: string): void {
    this.state.activeChats.delete(chatId);
    log('removeActiveChat', 'Removed active chat', { chatId });
  }

  /**
   * Check if a chat has recent activity (within 7 days)
   */
  private isChatRecent(chatId: string): boolean {
    const messages = loadCachedMessages();
    const chatMessages = messages.filter(m => m.chatId === chatId);

    if (chatMessages.length === 0) return false;

    // Find the most recent message in this chat
    const mostRecent = chatMessages.reduce((latest, msg) => {
      const msgTime = new Date(msg.timestamp).getTime();
      return msgTime > latest ? msgTime : latest;
    }, 0);

    const cutoff = Date.now() - RECENCY_THRESHOLD_MS;
    return mostRecent > cutoff;
  }

  /**
   * Queue a message for extraction (batched per chat)
   * Only queues if the chat has recent activity (last 7 days)
   */
  private queueMessageForExtraction(chatId: string, messageId: string): void {
    // Skip if chat is not recent (no activity in last 7 days)
    if (!this.isChatRecent(chatId)) {
      log('queueMessageForExtraction', `Skipping ${chatId} - no recent activity`);
      return;
    }

    const pending = this.state.pendingExtractionMessages.get(chatId) || [];
    if (!pending.includes(messageId)) {
      pending.push(messageId);
      this.state.pendingExtractionMessages.set(chatId, pending);
    }
  }

  /**
   * Queue full chat history for extraction when AI is enabled
   * This is called when user enables AI for a chat - we want to extract
   * knowledge from all available messages, not just new ones.
   */
  private async queueFullHistoryExtraction(chatId: string, contactName?: string): Promise<void> {
    try {
      aiLog.thought('knowledge', `AI enabled - preparing full history extraction for ${contactName || chatId}`, chatId);

      // Get all cached messages for this chat
      const allMessages = loadCachedMessages();
      const chatMessages = allMessages.filter(m => m.chatId === chatId);

      if (chatMessages.length === 0) {
        aiLog.observation('knowledge', 'No cached messages yet - extraction will happen as history loads', chatId);
        return;
      }

      // Sort by timestamp (oldest first for chronological extraction)
      chatMessages.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const messageIds = chatMessages.map(m => m.id);

      // Get or create contact for this chat
      const crmContact = getCrmContactByChatId(chatId);
      const contactId = crmContact?.id || `temp-${chatId}`;

      aiLog.decision('knowledge', `Queueing ${messageIds.length} messages for extraction`, chatId, {
        messageCount: messageIds.length,
        oldestMessage: chatMessages[0]?.timestamp,
        newestMessage: chatMessages[chatMessages.length - 1]?.timestamp,
      });

      // Add to extraction queue with high priority
      await extractionQueueStore.add({
        chatId,
        contactId,
        messageIds,
        priority: 'high', // High priority since user explicitly enabled AI
        scheduledFor: new Date().toISOString(),
      });

      // Emit event for stream of consciousness
      eventBus.emit({
        type: 'extraction_queued',
        chatId,
        priority: 'high',
      });

      log('queueFullHistoryExtraction', `Queued ${messageIds.length} messages for extraction`, { chatId });
    } catch (error) {
      logError('queueFullHistoryExtraction', `Failed to queue extraction for ${chatId}`, error);
      aiLog.error('knowledge', `Failed to queue history extraction: ${error instanceof Error ? error.message : 'Unknown'}`, chatId);
    }
  }

  /**
   * Flush pending messages to the extraction queue
   * Called periodically to batch messages for efficient extraction
   */
  private async flushPendingExtractions(): Promise<void> {
    const entries = Array.from(this.state.pendingExtractionMessages.entries());
    if (entries.length === 0) return;

    log('flushPendingExtractions', `Flushing ${entries.length} chats with pending messages`);

    for (const [chatId, messageIds] of entries) {
      if (messageIds.length === 0) continue;

      try {
        // Get or create contact for this chat
        const crmContact = getCrmContactByChatId(chatId);
        const contactId = crmContact?.id || `temp-${chatId}`;

        // Add to extraction queue
        await extractionQueueStore.add({
          chatId,
          contactId,
          messageIds,
          priority: 'normal',
          scheduledFor: new Date().toISOString(),
        });

        log('flushPendingExtractions', `Queued ${messageIds.length} messages for ${chatId}`);

        // Clear the pending messages for this chat
        this.state.pendingExtractionMessages.delete(chatId);
      } catch (error) {
        logError('flushPendingExtractions', `Failed to queue extraction for ${chatId}`, error);
      }
    }
  }
}

// ============================================
// SINGLETON
// ============================================

let worker: IntelligenceBackgroundWorker | null = null;

export function getBackgroundWorker(): IntelligenceBackgroundWorker {
  if (!worker) {
    worker = new IntelligenceBackgroundWorker();
  }
  return worker;
}

/**
 * Start the global background worker
 */
export function startIntelligenceWorker(config?: Partial<WorkerConfig>): void {
  if (!worker) {
    worker = new IntelligenceBackgroundWorker(config);
  }
  worker.start();
}

/**
 * Stop the global background worker
 */
export function stopIntelligenceWorker(): void {
  worker?.stop();
}

/**
 * Get worker status
 */
export function getWorkerStatus() {
  return worker?.getStatus() || {
    isRunning: false,
    tickCount: 0,
    activeChats: 0,
    config: DEFAULT_CONFIG,
    recentErrors: [],
  };
}
