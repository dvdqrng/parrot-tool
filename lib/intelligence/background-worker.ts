/**
 * Intelligence Background Worker
 *
 * The "heartbeat" of the intelligence layer. Runs continuously in the background,
 * processing queues, checking for proactive opportunities, and maintaining agent lifecycles.
 *
 * This solves Mistake #1: Components built but never started.
 */

import { eventBus, emitError, IntelligenceEvent } from './event-bus';
import { extractionQueueStore, contactStore, agentStore, userStateStore, soulStore } from './knowledge/store';
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
import { extractTier2, Tier2ExtractionRequest, EXTRACTION_BATCH_SIZE } from './extraction/tier2-llm';
import { sampleMessagesForSoulExtraction, mergeSoulTraits } from './extraction/soul-extractor';
import { classifyRelationship } from './extraction/relationship-classifier';
import { extractTier1 } from './extraction/tier1-local';
import { metrics } from './instrumentation/metrics';
import { buildAttentionSignal, rankChats, AttentionScore } from './attention-model';
import { hasApiKey, getApiKey, getActiveProvider } from '@/lib/intelligence-settings';
import { getMessagesByIds, getMessagesByChatId, getCrmContactByChatId, loadCachedMessages } from '@/lib/storage';
import { createDefaultContactIntelligence, ContactIntelligence } from './knowledge/types';
import { deduplicateFacts as deduplicateFactsWithExisting } from './knowledge/deduplication';

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
  globalScanIntervalMs: number;
  soulExtractionIntervalMs: number;
  maxExtractionRetries: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  tickIntervalMs: 30000, // 30 seconds
  extractionBatchSize: 5,
  ambientProcessingIntervalMs: 5 * 60 * 1000, // 5 minutes
  agentMaintenanceIntervalMs: 10 * 60 * 1000, // 10 minutes
  proactiveCheckIntervalMs: 60 * 1000, // 1 minute
  globalScanIntervalMs: 15 * 60 * 1000, // 15 minutes
  soulExtractionIntervalMs: 30 * 60 * 1000, // 30 minutes
  maxExtractionRetries: 3,
};

// ============================================
// WORKER STATE
// ============================================

interface WorkerState {
  isRunning: boolean;
  tickCount: number;
  lastAmbientProcessing: number;
  lastAgentMaintenance: number;
  lastProactiveCheck: number;
  lastGlobalScan: number;
  lastSoulExtraction: number;
  activeChats: Set<string>; // chatIds currently being viewed
  pendingExtractionMessages: Map<string, string[]>; // chatId -> messageIds pending extraction
  lastAttentionScores: AttentionScore[]; // cached from last global scan
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
      lastGlobalScan: 0,
      lastSoulExtraction: 0,
      activeChats: new Set(),
      pendingExtractionMessages: new Map(),
      lastAttentionScores: [],
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

    // Enable event bus debug mode for testing
    eventBus.setDebugMode(true);

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

      // 4. Run global attention scan if due
      if (now - this.state.lastGlobalScan >= this.config.globalScanIntervalMs) {
        await this.globalProactiveScan();
        this.state.lastGlobalScan = now;
      }

      // 5. Run soul extraction if due
      if (now - this.state.lastSoulExtraction >= this.config.soulExtractionIntervalMs) {
        await this.runSoulExtraction();
        this.state.lastSoulExtraction = now;
      }

      // 6. Run agent lifecycle maintenance if due
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
      case 'global_attention_update':
        const scores = (event as any).scores || [];
        const highCount = scores.filter((s: any) => s.score >= 60).length;
        if (highCount > 0) {
          aiLog.observation('worker', `Global scan: ${highCount} chat(s) need attention`);
        }
        break;
      case 'soul_updated':
        const soulEvent = event as any;
        aiLog.knowledge(`Soul updated: ${soulEvent.newTraits} new traits (${soulEvent.traitCount} total)`, '');
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
          // Skip if queue item is very old (>30 days) - stale queue entries
          const itemAge = Date.now() - new Date(item.createdAt).getTime();
          if (itemAge > 30 * 24 * 60 * 60 * 1000) {
            log('processExtractionQueue', `Skipping ${item.chatId} - queue item is ${Math.round(itemAge / (24 * 60 * 60 * 1000))} days old`);
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

          // Sort messages chronologically (oldest first)
          messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          log('processExtractionQueue', `Extracting from ${messages.length} messages for ${contactName} in batches of ${EXTRACTION_BATCH_SIZE}`);

          // Process messages in batches to cover full history
          const totalBatches = Math.ceil(messages.length / EXTRACTION_BATCH_SIZE);
          let allFacts: typeof existingFacts = [...existingFacts];
          let currentRelationship = existingRelationship;
          let allActionItems: ContactIntelligence['actionItems'] = existingContact?.actionItems || [];
          let latestSummary = '';
          let allTopics: string[] = [];

          for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const batchStart = batchIndex * EXTRACTION_BATCH_SIZE;
            const batchEnd = Math.min(batchStart + EXTRACTION_BATCH_SIZE, messages.length);
            const batchMessages = messages.slice(batchStart, batchEnd);

            aiLog.thought('knowledge', `Processing batch ${batchIndex + 1}/${totalBatches} (messages ${batchStart + 1}-${batchEnd} of ${messages.length})`, item.chatId);

            // Build extraction request for this batch
            const request: Tier2ExtractionRequest = {
              chatId: item.chatId,
              contactId: item.contactId,
              contactName,
              platform,
              messages: batchMessages,
              existingFacts: allFacts, // Pass accumulated facts for context
              existingRelationship: currentRelationship,
            };

            // Run extraction on this batch
            const result = await extractTier2(request);

            // Accumulate results - deduplicate new facts against accumulated facts
            if (result.facts.length > 0) {
              // Deduplicate this batch's facts against what we've accumulated so far
              const batchDedupeResult = deduplicateFactsWithExisting(allFacts, result.facts);
              allFacts = batchDedupeResult.mergedFacts;
              log('processExtractionQueue', `Batch ${batchIndex + 1}: ${result.facts.length} raw facts → ${batchDedupeResult.stats.newFacts} new unique facts`);
            }
            if (result.actionItems.length > 0) {
              allActionItems = [...allActionItems, ...result.actionItems];
            }
            if (result.relationship.confidence > (currentRelationship?.confidence || 0)) {
              currentRelationship = result.relationship;
            }
            if (result.summary) {
              latestSummary = result.summary;
            }
            if (result.topics.length > 0) {
              allTopics = [...new Set([...allTopics, ...result.topics])];
            }

            // Small delay between batches to avoid rate limiting
            if (batchIndex < totalBatches - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          // Run free heuristic relationship classification as complement to LLM
          log('processExtractionQueue', `Running heuristic relationship classifier on ${messages.length} messages...`);
          const tier1Results = messages.map(m => extractTier1(m));
          const heuristicRelationship = classifyRelationship(messages, tier1Results, existingRelationship);
          log('processExtractionQueue', `✓ HEURISTIC RESULT: ${heuristicRelationship.type} (confidence: ${heuristicRelationship.confidence.toFixed(2)})`);
          log('processExtractionQueue', `  LLM relationship: ${currentRelationship?.type || 'none'} (confidence: ${currentRelationship?.confidence?.toFixed(2) || '0'})`);

          // Use heuristic if LLM didn't produce a confident result
          if (!currentRelationship || currentRelationship.confidence < heuristicRelationship.confidence) {
            currentRelationship = heuristicRelationship;
            log('processExtractionQueue', `  → Using HEURISTIC (higher confidence)`);
          } else {
            log('processExtractionQueue', `  → Keeping LLM result (higher confidence)`);
          }

          // allFacts is already deduplicated from batch processing
          const uniqueFacts = allFacts;
          const totalNewFacts = uniqueFacts.length - existingFacts.length;
          log('processExtractionQueue', `Total extraction: ${totalNewFacts} new facts (${uniqueFacts.length} unique after dedup)`);

          if (totalNewFacts > 0 || allActionItems.length > (existingContact?.actionItems?.length || 0)) {
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

            // Update with all accumulated facts
            const updatedIntelligence: ContactIntelligence = {
              ...contactIntelligence,
              facts: uniqueFacts,
              relationship: currentRelationship || contactIntelligence.relationship,
              actionItems: allActionItems,
              summary: latestSummary || contactIntelligence.summary,
              lastExtractionAt: new Date().toISOString(),
            };

            await contactStore.upsert(updatedIntelligence);
            aiLog.knowledge(`Extracted ${totalNewFacts} facts from ${messages.length} messages`, item.chatId, contactName, { factCount: uniqueFacts.length });
          }

          await extractionQueueStore.markComplete(item.id);
          eventBus.emit({
            type: 'extraction_complete',
            chatId: item.chatId,
            facts: uniqueFacts.slice(-10), // Last 10 facts for the event
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
    try {
      log('runAmbientProcessing', 'Running ambient stream processing...');

      // Get sent messages from cached storage (last 48 hours for ambient window)
      const allMessages = loadCachedMessages();
      const cutoff = Date.now() - 48 * 60 * 60 * 1000; // 48-hour window
      const sentMessages = allMessages.filter(m =>
        m.isFromMe &&
        new Date(m.timestamp).getTime() > cutoff
      );

      log('runAmbientProcessing', `Loaded ${allMessages.length} total cached messages, ${sentMessages.length} sent in last 48h`);

      if (sentMessages.length === 0) {
        log('runAmbientProcessing', 'No sent messages in 48h window - skipping ambient processing');
        return;
      }

      const uniqueChats = new Set(sentMessages.map(m => m.chatId));
      log('runAmbientProcessing', `Processing ${sentMessages.length} sent messages across ${uniqueChats.size} chats`);

      const updates = await processAmbientStream(sentMessages);
      const topicsFound = updates.activeTopics?.length || 0;

      if (Object.keys(updates).length > 0) {
        // Persist user state to IndexedDB
        log('runAmbientProcessing', '✓ AMBIENT RESULTS - persisting to IndexedDB', {
          topicsFound,
          distributedInfo: updates.distributedInfo?.length || 0,
          activeContexts: updates.activeContexts?.length || 0,
          communicationMode: updates.communicationMode,
          topics: updates.activeTopics?.slice(0, 5).map(t => t.topic) || [],
          contexts: updates.activeContexts?.map(c => c.label) || [],
        });
        await userStateStore.update(updates);

        eventBus.emit({ type: 'user_state_updated', updates });
        eventBus.emit({ type: 'ambient_processing_complete', topicsFound });
      } else {
        log('runAmbientProcessing', 'Ambient processing returned no updates');
      }

      log('runAmbientProcessing', 'Ambient processing complete');

    } catch (error) {
      logError('runAmbientProcessing', 'Ambient processing failed', error);
    }
  }

  /**
   * Run soul extraction — samples sent messages across all chats,
   * sends to LLM for identity trait extraction, merges into UserSoul.
   */
  private async runSoulExtraction(): Promise<void> {
    if (!hasApiKey()) {
      log('runSoulExtraction', 'No API key — skipping soul extraction');
      return;
    }

    try {
      log('runSoulExtraction', 'Starting soul extraction...');

      // 1. Load and sample messages
      const allMessages = loadCachedMessages();
      const sampled = sampleMessagesForSoulExtraction(allMessages);

      if (sampled.length === 0) {
        log('runSoulExtraction', 'No substantive sent messages — skipping');
        return;
      }

      const uniqueChats = new Set(sampled.map(m => m.chatId));
      log('runSoulExtraction', `Sampled ${sampled.length} messages across ${uniqueChats.size} chats`);

      // 2. Load current soul
      const currentSoul = await soulStore.get();
      const existingTraits = currentSoul.extractedTraits || [];

      log('runSoulExtraction', `Current soul has ${existingTraits.filter(t => t.isActive).length} active traits (${existingTraits.filter(t => t.userVerified).length} pinned)`);

      // 3. Call extraction API
      const provider = getActiveProvider();
      const apiKey = getApiKey(provider);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-ai-provider': provider,
      };
      if (apiKey) {
        headers['x-ai-key'] = apiKey;
      }

      const response = await fetch('/api/intelligence/extract', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mode: 'soul',
          sentMessages: sampled.map(m => ({
            text: m.text,
            chatId: m.chatId,
            timestamp: m.timestamp,
          })),
          existingTraits: existingTraits.filter(t => t.isActive),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Soul extraction API failed: ${response.status} - ${errorData.error || 'Unknown'}`);
      }

      const result = await response.json();
      const newTraits = result.traits || [];

      log('runSoulExtraction', `LLM returned ${newTraits.length} traits`);

      // 4. Merge with existing traits
      const { mergedTraits, newCount, updatedCount } = mergeSoulTraits(existingTraits, newTraits);

      log('runSoulExtraction', `Merge result: ${newCount} new, ${updatedCount} updated, ${mergedTraits.length} total`);

      // 5. Save updated soul
      const updatedSoul = {
        ...currentSoul,
        extractedTraits: mergedTraits,
        lastExtractionAt: new Date().toISOString(),
      };
      await soulStore.set(updatedSoul);

      // 6. Emit event
      eventBus.emit({
        type: 'soul_updated',
        traitCount: mergedTraits.filter(t => t.isActive).length,
        newTraits: newCount,
      });

      aiLog.knowledge(
        `Soul extraction: ${newCount} new traits, ${updatedCount} confirmed (${mergedTraits.filter(t => t.isActive).length} total)`,
        '',
        undefined,
        { newCount, updatedCount, totalTraits: mergedTraits.filter(t => t.isActive).length }
      );

      log('runSoulExtraction', '✓ Soul extraction complete');

    } catch (error) {
      logError('runSoulExtraction', 'Soul extraction failed', error);
    }
  }

  /**
   * Check for proactive opportunities across active chats
   * Active chats are those where the companion is currently open
   */
  private async checkProactiveOpportunities(): Promise<void> {
    if (this.state.activeChats.size === 0) {
      return;
    }

    log('checkProactiveOpportunities', 'Checking proactive opportunities', {
      activeChats: this.state.activeChats.size,
    });

    for (const chatId of this.state.activeChats) {
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
   * Global proactive scan — scores ALL chats with recent activity for attention.
   * Runs every globalScanIntervalMs (default 15 min).
   * No LLM calls — uses pure local scoring from attention-model.ts.
   * Only considers chats with messages in the last 7 days, capped at 50 chats.
   */
  private async globalProactiveScan(): Promise<void> {
    try {
      // Load all cached messages once (not per-chat)
      const allMessages = loadCachedMessages();
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      // Filter to last 7 days and group by chatId
      const chatMessageMap = new Map<string, typeof allMessages>();
      for (const msg of allMessages) {
        if (new Date(msg.timestamp).getTime() < sevenDaysAgo) continue;
        const arr = chatMessageMap.get(msg.chatId) || [];
        arr.push(msg);
        chatMessageMap.set(msg.chatId, arr);
      }

      if (chatMessageMap.size === 0) {
        log('globalProactiveScan', 'No chats with recent activity to scan');
        return;
      }

      // Sort chats by most recent message, cap at 50
      const chatsByRecency = Array.from(chatMessageMap.entries())
        .map(([chatId, msgs]) => ({
          chatId,
          msgs,
          latestTimestamp: Math.max(...msgs.map(m => new Date(m.timestamp).getTime())),
        }))
        .sort((a, b) => b.latestTimestamp - a.latestTimestamp)
        .slice(0, 50);

      log('globalProactiveScan', `Scanning ${chatsByRecency.length} chats with activity in last 7 days (${chatMessageMap.size} total)`);

      // Load user state once before the loop
      const userState = await userStateStore.get();
      const signals = [];

      for (const { chatId, msgs } of chatsByRecency) {
        try {
          // Sort by time and take last 20 messages
          const chatMessages = msgs
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .slice(-20);

          if (chatMessages.length === 0) continue;

          // Load contact intelligence for relationship type
          const contact = await contactStore.getByChatId(chatId);
          const relationshipType = contact?.relationship?.type || 'unknown';
          const pendingActions = contact?.actionItems?.filter(a => a.status === 'pending').length || 0;

          // Check if this chat overlaps with any active context
          const activeContextOverlap = userState?.activeContexts?.some(
            ctx => ctx.relatedContacts.includes(chatId) && ctx.status === 'active'
          ) || false;

          const signalInput = {
            chatId,
            contactName: contact?.displayName,
            messages: chatMessages.map(m => ({
              text: m.text,
              isFromMe: m.isFromMe,
              timestamp: m.timestamp,
            })),
            relationshipType,
            pendingActionItems: pendingActions,
            activeContextOverlap,
          };

          log('globalProactiveScan', `Building signal for ${contact?.displayName || chatId}`, {
            messageCount: chatMessages.length,
            relationshipType,
            pendingActions,
            activeContextOverlap,
            lastMsgFrom: chatMessages[chatMessages.length - 1]?.isFromMe ? 'me' : 'them',
            lastMsgAge: Math.round((Date.now() - new Date(chatMessages[chatMessages.length - 1]?.timestamp).getTime()) / 60000) + 'min',
          });

          const signal = buildAttentionSignal(signalInput);
          signals.push(signal);
        } catch (e) {
          logError('globalProactiveScan', `Failed to build signal for ${chatId}`, e);
        }
      }

      // Rank all chats
      const scores = rankChats(signals);
      this.state.lastAttentionScores = scores;

      const highAttention = scores.filter(s => s.score >= 60);

      log('globalProactiveScan', `Scan complete`, {
        totalScanned: signals.length,
        highAttention: highAttention.length,
        topScores: scores.slice(0, 3).map(s => ({
          chatId: s.chatId,
          score: s.score,
          urgency: s.urgency,
          reason: s.reason,
        })),
      });

      // Emit global attention update
      eventBus.emit({
        type: 'global_attention_update',
        scores,
        timestamp: new Date().toISOString(),
      });

      if (highAttention.length > 0) {
        aiLog.decision(
          'worker',
          `${highAttention.length} chat(s) need attention: ${highAttention.map(s => `${s.contactName || s.chatId} (${s.score})`).join(', ')}`,
        );
      }
    } catch (error) {
      logError('globalProactiveScan', 'Global scan failed', error);
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
   * Get last computed attention scores
   */
  getLastAttentionScores(): AttentionScore[] {
    return this.state.lastAttentionScores;
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
   * Queue a message for extraction (batched per chat)
   * Messages arriving via event bus are inherently recent - they just happened.
   */
  private queueMessageForExtraction(chatId: string, messageId: string): void {
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
