'use client';

import { useRef, useCallback, useEffect } from 'react';
import {
  BeeperMessage,
  AutopilotAgent,
  ConversationHandoffSummary,
} from '@/lib/types';
import { logger } from '@/lib/logger';
import {
  getAutopilotAgentById,
  getChatAutopilotConfig,
  saveChatAutopilotConfig,
  addAutopilotActivityEntry,
  generateId,
  saveHandoffSummary,
  getCachedMessageById,
  appendAiChatMessage,
} from '@/lib/storage';
import {
  useAutopilotScheduler,
  calculateReplyDelay,
  isWithinActivityHours,
  calculateMultiMessageDelay,
} from './use-autopilot-scheduler';
import { AUTOPILOT } from '@/lib/ai-constants';
import { useAiPipeline } from '@/hooks/use-ai-pipeline';

interface UseAutopilotEngineOptions {
  onMessageScheduled?: (chatId: string, scheduledFor: Date) => void;
  onGoalCompleted?: (chatId: string, summary: ConversationHandoffSummary) => void;
  onError?: (chatId: string, error: string) => void;
}

export function useAutopilotEngine(options: UseAutopilotEngineOptions = {}) {
  const {
    onMessageScheduled,
    onGoalCompleted,
    onError,
  } = options;

  const scheduler = useAutopilotScheduler({
    onActionComplete: (action) => {
      if (action.type === 'send-message') {
        // Log the sent message
        addAutopilotActivityEntry({
          id: generateId(),
          chatId: action.chatId,
          agentId: action.agentId,
          type: 'message-sent',
          timestamp: new Date().toISOString(),
          messageText: action.messageText,
        });

        // Increment messages handled
        const config = getChatAutopilotConfig(action.chatId);
        if (config) {
          saveChatAutopilotConfig({
            ...config,
            messagesHandled: config.messagesHandled + 1,
            lastActivityAt: new Date().toISOString(),
          });
        }
      }
    },
    onActionError: (action, error) => {
      addAutopilotActivityEntry({
        id: generateId(),
        chatId: action.chatId,
        agentId: action.agentId,
        type: 'error',
        timestamp: new Date().toISOString(),
        errorMessage: error.message,
      });
      onError?.(action.chatId, error.message);
    },
  });

  const processedMessagesRef = useRef<Set<string>>(new Set());

  const { generateDraft, generateSummary, extractKnowledge } = useAiPipeline();

  // Start the scheduler on mount - use refs to avoid dependency issues
  const schedulerRef = useRef(scheduler);
  schedulerRef.current = scheduler;

  useEffect(() => {
    schedulerRef.current.start();
    return () => {
      // Clear interval directly without state update to avoid infinite loop
      if (schedulerRef.current) {
        schedulerRef.current.stop();
      }
    };
  }, []); // Empty deps - only run on mount/unmount

  // Handle an incoming message for a chat with autopilot enabled
  const handleIncomingMessage = useCallback(async (
    message: BeeperMessage,
    forceProcess = false
  ) => {
    const { chatId, id: messageId, text, senderName } = message;

    logger.engine('handleIncomingMessage called', { chatId, messageId, text: text?.slice(0, 50), forceProcess });

    // Skip if we've already processed this message (unless forced to process)
    if (!forceProcess && processedMessagesRef.current.has(messageId)) {
      logger.engine('Message already processed, skipping', { messageId });
      return;
    }
    processedMessagesRef.current.add(messageId);

    // Clean up old processed messages (keep last N)
    if (processedMessagesRef.current.size > AUTOPILOT.MAX_PROCESSED_MESSAGES) {
      const arr = Array.from(processedMessagesRef.current);
      processedMessagesRef.current = new Set(arr.slice(-AUTOPILOT.MAX_PROCESSED_MESSAGES));
    }

    // Check if autopilot is enabled for this chat
    const config = getChatAutopilotConfig(chatId);
    logger.engine('Chat config', { chatId, config: config ? { enabled: config.enabled, status: config.status, agentId: config.agentId } : null });
    if (!config || !config.enabled || config.status !== 'active') {
      logger.engine('Autopilot not active for chat, skipping', { chatId });
      return;
    }

    // Observer mode: agent only reads/learns, no draft generation
    if (config.mode === 'observer') {
      logger.engine('Observer mode - skipping draft generation', { chatId });
      return;
    }

    // Check if self-driving has expired
    if (config.mode === 'self-driving' && config.selfDrivingExpiresAt) {
      if (new Date() > new Date(config.selfDrivingExpiresAt)) {
        // Expired - disable autopilot
        saveChatAutopilotConfig({
          ...config,
          enabled: false,
          status: 'inactive',
        });
        addAutopilotActivityEntry({
          id: generateId(),
          chatId,
          agentId: config.agentId,
          type: 'time-expired',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    // Get the agent
    const agent = getAutopilotAgentById(config.agentId);
    logger.engine('Agent lookup', { agentId: config.agentId, found: !!agent });
    if (!agent) {
      logger.engine('Agent not found', { agentId: config.agentId });
      onError?.(chatId, 'Agent not found');
      return;
    }

    // Check activity hours (unless forced to process)
    if (!forceProcess) {
      const withinHours = isWithinActivityHours(agent.behavior);
      logger.engine('Activity hours check', { withinHours, behavior: agent.behavior });
      if (!withinHours) {
        logger.engine('Outside activity hours, skipping');
        // Outside activity hours - skip processing
        return;
      }
    } else {
      logger.engine('Bypassing activity hours check (forceProcess=true)');
    }

    // Log the received message
    addAutopilotActivityEntry({
      id: generateId(),
      chatId,
      agentId: agent.id,
      type: 'message-received',
      timestamp: new Date().toISOString(),
      messageText: text,
    });

    // Calculate effective response rate (with fatigue)
    let effectiveResponseRate = agent.behavior.responseRate ?? 100;

    if (agent.behavior.conversationFatigueEnabled && config.messagesHandled > 0) {
      const fatigueMessages = agent.behavior.fatigueTriggerMessages ?? 15;
      const fatigueReduction = agent.behavior.fatigueResponseReduction ?? 5;

      if (config.messagesHandled >= fatigueMessages) {
        const extraMessages = config.messagesHandled - fatigueMessages;
        const reduction = Math.min(extraMessages * fatigueReduction, 50); // Cap at 50% reduction
        effectiveResponseRate = Math.max(30, effectiveResponseRate - reduction); // Min 30%

        if (reduction > 0) {
          logger.engine('Fatigue applied', { messagesHandled: config.messagesHandled, reduction, effectiveResponseRate });
          addAutopilotActivityEntry({
            id: generateId(),
            chatId,
            agentId: agent.id,
            type: 'fatigue-reduced',
            timestamp: new Date().toISOString(),
            metadata: { reduction, effectiveResponseRate, messagesHandled: config.messagesHandled },
          });
        }
      }
    }

    // Response rate check - simulate being busy
    const responseRoll = Math.random() * 100;
    if (responseRoll > effectiveResponseRate) {
      logger.engine('Skipping message (busy simulation)', { responseRoll, effectiveResponseRate });
      addAutopilotActivityEntry({
        id: generateId(),
        chatId,
        agentId: agent.id,
        type: 'skipped-busy',
        timestamp: new Date().toISOString(),
        messageText: text,
        metadata: { responseRoll, effectiveResponseRate },
      });
      return;
    }

    // Check for emoji-only response
    const shouldSendEmojiOnly = agent.behavior.emojiOnlyResponseEnabled &&
      Math.random() * 100 < (agent.behavior.emojiOnlyResponseChance ?? 10);

    // Check for conversation closing suggestion
    const shouldSuggestClosing = !!(agent.behavior.conversationClosingEnabled &&
      config.lastActivityAt &&
      (Date.now() - new Date(config.lastActivityAt).getTime()) > (agent.behavior.closingTriggerIdleMinutes ?? 30) * 60 * 1000);

    try {
      logger.engine('Generating draft via pipeline...', { shouldSendEmojiOnly, shouldSuggestClosing });

      const result = await generateDraft(chatId, text, senderName, {
        agentId: agent.id,
        emojiOnlyResponse: shouldSendEmojiOnly,
        suggestClosing: shouldSuggestClosing,
        messagesInConversation: config.messagesHandled,
        detectGoalCompletion: true,
      });

      const { text: suggestedReply, suggestedMessages, goalAnalysis } = result;

      // Log draft generation
      addAutopilotActivityEntry({
        id: generateId(),
        chatId,
        agentId: agent.id,
        type: 'draft-generated',
        timestamp: new Date().toISOString(),
        draftText: suggestedReply,
      });

      // Trigger knowledge extraction every 5 messages (background, non-blocking)
      if (config.messagesHandled > 0 && config.messagesHandled % 5 === 0) {
        extractKnowledge(chatId, senderName).catch(err => {
          logger.debug('[Autopilot] Knowledge extraction failed (non-critical):', err);
        });
      }

      // Check goal completion
      if (goalAnalysis?.isGoalAchieved && goalAnalysis.confidence >= 70) {
        const goalBehavior = config.goalCompletionBehaviorOverride || agent.goalCompletionBehavior;

        addAutopilotActivityEntry({
          id: generateId(),
          chatId,
          agentId: agent.id,
          type: 'goal-detected',
          timestamp: new Date().toISOString(),
          metadata: { goalAnalysis },
        });

        if (goalBehavior === 'auto-disable') {
          // Disable autopilot
          saveChatAutopilotConfig({
            ...config,
            enabled: false,
            status: 'goal-completed',
          });
          return; // Don't send the reply
        } else if (goalBehavior === 'handoff') {
          // Generate handoff summary and disable
          await handleHandoffSummary(chatId, agent, senderName);
          saveChatAutopilotConfig({
            ...config,
            enabled: false,
            status: 'goal-completed',
          });
          return;
        }
        // 'maintenance' mode continues but we could adjust behavior here
      }

      // Handle based on mode
      logger.engine('Handling mode', { mode: config.mode, suggestedReply: suggestedReply?.slice(0, 50) });
      if (config.mode === 'suggest') {
        // Suggest mode: inject the draft into the AI chat panel as an assistant message
        // Include context about which message triggered the suggestion
        logger.engine('Suggest mode - adding suggestion to AI chat panel');
        if (suggestedReply) {
          const truncatedMsg = text && text.length > 80 ? text.slice(0, 80) + '…' : text;
          const context = truncatedMsg
            ? `${senderName} wrote: "${truncatedMsg}"\n\nSuggested reply:\n\n`
            : '';
          appendAiChatMessage(chatId, {
            id: `suggestion-${Date.now()}`,
            role: 'assistant',
            content: `${context}<draft>${suggestedReply}</draft>`,
          });
        }
      } else if (config.mode === 'manual-approval') {
        logger.engine('Manual approval mode - scheduling draft for approval');
        // Schedule the message far in the future (24 hours) so it appears as pending
        // User approval will reschedule it to send immediately
        const PENDING_APPROVAL_DELAY = AUTOPILOT.PENDING_APPROVAL_DELAY;

        if (suggestedMessages && suggestedMessages.length > 1) {
          // Multi-message - schedule all with far-future dates
          scheduler.scheduleMessages(
            chatId,
            agent.id,
            suggestedMessages,
            PENDING_APPROVAL_DELAY,
            5, // Small delay between multi-messages
            message.id
          );
        } else {
          // Single message
          scheduler.scheduleMessage(chatId, agent.id, suggestedReply, PENDING_APPROVAL_DELAY, message.id);
        }
      } else {
        // Self-driving mode - schedule the message(s)
        const replyDelay = calculateReplyDelay(
          agent.behavior,
          new Date(message.timestamp),
          config.createdAt ? new Date(config.createdAt) : undefined
        );

        if (suggestedMessages && suggestedMessages.length > 1) {
          // Multi-message - schedule with delays between
          const delayBetween = calculateMultiMessageDelay(agent.behavior);
          scheduler.scheduleMessages(
            chatId,
            agent.id,
            suggestedMessages,
            replyDelay,
            delayBetween,
            message.id
          );
        } else {
          // Single message
          scheduler.scheduleMessage(chatId, agent.id, suggestedReply, replyDelay, message.id);
        }

        onMessageScheduled?.(chatId, new Date(Date.now() + replyDelay * 1000));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in autopilot engine:', error instanceof Error ? error : errorMessage);

      // Update config with error
      saveChatAutopilotConfig({
        ...config,
        status: 'error',
        lastError: errorMessage,
        errorCount: config.errorCount + 1,
      });

      addAutopilotActivityEntry({
        id: generateId(),
        chatId,
        agentId: agent.id,
        type: 'error',
        timestamp: new Date().toISOString(),
        errorMessage,
      });

      onError?.(chatId, errorMessage);
    }
  }, [scheduler, generateDraft, extractKnowledge, onMessageScheduled, onError]);

  // Generate a handoff summary via the pipeline
  const handleHandoffSummary = useCallback(async (
    chatId: string,
    agent: AutopilotAgent,
    senderName: string,
  ) => {
    try {
      const result = await generateSummary(chatId, senderName, agent.id);

      if (result.summary) {
        const summary: ConversationHandoffSummary = {
          chatId,
          agentId: agent.id,
          generatedAt: new Date().toISOString(),
          summary: result.summary,
          keyPoints: result.keyPoints || [],
          suggestedNextSteps: result.suggestedNextSteps || [],
          goalStatus: result.goalStatus || 'unclear',
        };
        saveHandoffSummary(summary);

        addAutopilotActivityEntry({
          id: generateId(),
          chatId,
          agentId: agent.id,
          type: 'handoff-triggered',
          timestamp: new Date().toISOString(),
          metadata: { summary: result.summary },
        });

        onGoalCompleted?.(chatId, summary);
      }
    } catch (error) {
      logger.error('Failed to generate handoff summary:', error instanceof Error ? error : String(error));
    }
  }, [generateSummary, onGoalCompleted]);

  // Generate a proactive initial message (not in response to an incoming message)
  const generateProactiveMessage = useCallback(async (chatId: string) => {
    logger.engine('generateProactiveMessage called', { chatId });

    // Check if autopilot is enabled for this chat
    const config = getChatAutopilotConfig(chatId);
    logger.engine('Chat config', { chatId, config: config ? { enabled: config.enabled, status: config.status, agentId: config.agentId } : null });
    if (!config || !config.enabled || config.status !== 'active') {
      logger.engine('Autopilot not active for chat, skipping', { chatId });
      return;
    }

    // Get the agent
    const agent = getAutopilotAgentById(config.agentId);
    logger.engine('Agent lookup', { agentId: config.agentId, found: !!agent });
    if (!agent) {
      logger.engine('Agent not found', { agentId: config.agentId });
      onError?.(chatId, 'Agent not found');
      return;
    }

    try {
      logger.engine('Generating proactive draft via pipeline...');

      // Use empty original message for proactive mode - pipeline handles intent routing
      const result = await generateDraft(chatId, '', 'Chat', {
        agentId: agent.id,
        detectGoalCompletion: false,
      });

      const { text: suggestedReply, suggestedMessages } = result;

      // Log draft generation
      addAutopilotActivityEntry({
        id: generateId(),
        chatId,
        agentId: agent.id,
        type: 'draft-generated',
        timestamp: new Date().toISOString(),
        draftText: suggestedReply,
      });

      // Handle based on mode
      logger.engine('Handling mode', { mode: config.mode, suggestedReply: suggestedReply?.slice(0, 50) });
      if (config.mode === 'suggest') {
        // Suggest mode: inject the draft into the AI chat panel as an assistant message
        logger.engine('Suggest mode - adding suggestion to AI chat panel');
        if (suggestedReply) {
          appendAiChatMessage(chatId, {
            id: `suggestion-${Date.now()}`,
            role: 'assistant',
            content: `Based on the conversation so far, here's a proactive suggestion:\n\n<draft>${suggestedReply}</draft>`,
          });
        }
      } else if (config.mode === 'manual-approval') {
        logger.engine('Manual approval mode - scheduling draft for approval');
        // Schedule the message far in the future (24 hours) so it appears as pending
        const PENDING_APPROVAL_DELAY = AUTOPILOT.PENDING_APPROVAL_DELAY;

        if (suggestedMessages && suggestedMessages.length > 1) {
          scheduler.scheduleMessages(
            chatId,
            agent.id,
            suggestedMessages,
            PENDING_APPROVAL_DELAY,
            5
          );
        } else {
          scheduler.scheduleMessage(chatId, agent.id, suggestedReply, PENDING_APPROVAL_DELAY);
        }
      } else {
        // Self-driving mode - schedule the message(s)
        // Use a short delay for proactive messages (3-8 seconds)
        const replyDelay = Math.floor(Math.random() * 5) + 3; // 3-8 seconds

        if (suggestedMessages && suggestedMessages.length > 1) {
          // Multi-message - schedule with delays between
          const delayBetween = calculateMultiMessageDelay(agent.behavior);
          scheduler.scheduleMessages(
            chatId,
            agent.id,
            suggestedMessages,
            replyDelay,
            delayBetween
          );
        } else {
          // Single message
          scheduler.scheduleMessage(chatId, agent.id, suggestedReply, replyDelay);
        }

        onMessageScheduled?.(chatId, new Date(Date.now() + replyDelay * 1000));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error in proactive message generation:', error instanceof Error ? error : errorMessage);

      // Update config with error
      saveChatAutopilotConfig({
        ...config,
        status: 'error',
        lastError: errorMessage,
        errorCount: config.errorCount + 1,
      });

      addAutopilotActivityEntry({
        id: generateId(),
        chatId,
        agentId: agent.id,
        type: 'error',
        timestamp: new Date().toISOString(),
        errorMessage,
      });

      onError?.(chatId, errorMessage);
    }
  }, [scheduler, generateDraft, onMessageScheduled, onError]);

  // Manually approve and send a draft
  const approveAndSend = useCallback(async (
    chatId: string,
    draftText: string,
    agentId: string
  ) => {
    const config = getChatAutopilotConfig(chatId);
    const agent = getAutopilotAgentById(agentId);

    if (!config || !agent) return;

    // Schedule immediate send (5 second delay for UI feedback)
    scheduler.scheduleMessage(chatId, agentId, draftText, 5);

    // Increment messages handled
    saveChatAutopilotConfig({
      ...config,
      messagesHandled: config.messagesHandled + 1,
      lastActivityAt: new Date().toISOString(),
    });
  }, [scheduler]);

  const regenerateDraft = useCallback(async (messageId: string) => {
    const message = getCachedMessageById(messageId);
    if (message) {
      // Temporarily remove from processed messages to allow reprocessing
      processedMessagesRef.current.delete(messageId);
      await handleIncomingMessage(message);
    } else {
      logger.error(`[Autopilot Engine] Could not find message ${messageId} to regenerate draft`);
      onError?.('', `Could not find message ${messageId} to regenerate draft`);
    }
  }, [handleIncomingMessage, onError]);

  return {
    handleIncomingMessage,
    generateProactiveMessage,
    regenerateDraft,
    approveAndSend,
    scheduler,
    // Pass through scheduler methods
    cancelChat: scheduler.cancelChat,
    isRunning: scheduler.isRunning,
    pendingCount: scheduler.pendingCount,
  };
}
