'use client';

import { useRef, useCallback, useEffect } from 'react';
import {
  BeeperMessage,
  AutopilotAgent,
  ChatAutopilotConfig,
  AutopilotActivityEntry,
  ConversationHandoffSummary,
} from '@/lib/types';
import {
  loadAutopilotAgents,
  getAutopilotAgentById,
  getChatAutopilotConfig,
  saveChatAutopilotConfig,
  addAutopilotActivityEntry,
  loadToneSettings,
  loadWritingStylePatterns,
  getThreadContext,
  formatThreadContextForPrompt,
  loadSettings,
  generateId,
  saveHandoffSummary,
} from '@/lib/storage';
import {
  useAutopilotScheduler,
  calculateReplyDelay,
  isWithinActivityHours,
  calculateMultiMessageDelay,
} from './use-autopilot-scheduler';

interface UseAutopilotEngineOptions {
  onDraftGenerated?: (chatId: string, draftText: string, agentId: string) => void;
  onMessageScheduled?: (chatId: string, scheduledFor: Date) => void;
  onGoalCompleted?: (chatId: string, summary: ConversationHandoffSummary) => void;
  onError?: (chatId: string, error: string) => void;
}

export function useAutopilotEngine(options: UseAutopilotEngineOptions = {}) {
  const {
    onDraftGenerated,
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
    message: BeeperMessage
  ) => {
    const { chatId, id: messageId, text, senderName } = message;

    console.log('[Autopilot Engine] handleIncomingMessage called', { chatId, messageId, text: text?.slice(0, 50) });

    // Skip if we've already processed this message
    if (processedMessagesRef.current.has(messageId)) {
      console.log('[Autopilot Engine] Message already processed, skipping', { messageId });
      return;
    }
    processedMessagesRef.current.add(messageId);

    // Clean up old processed messages (keep last 100)
    if (processedMessagesRef.current.size > 100) {
      const arr = Array.from(processedMessagesRef.current);
      processedMessagesRef.current = new Set(arr.slice(-100));
    }

    // Check if autopilot is enabled for this chat
    const config = getChatAutopilotConfig(chatId);
    console.log('[Autopilot Engine] Chat config', { chatId, config: config ? { enabled: config.enabled, status: config.status, agentId: config.agentId } : null });
    if (!config || !config.enabled || config.status !== 'active') {
      console.log('[Autopilot Engine] Autopilot not active for chat, skipping', { chatId });
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
    console.log('[Autopilot Engine] Agent lookup', { agentId: config.agentId, found: !!agent });
    if (!agent) {
      console.log('[Autopilot Engine] Agent not found', { agentId: config.agentId });
      onError?.(chatId, 'Agent not found');
      return;
    }

    // Check activity hours
    const withinHours = isWithinActivityHours(agent.behavior);
    console.log('[Autopilot Engine] Activity hours check', { withinHours, behavior: agent.behavior });
    if (!withinHours) {
      console.log('[Autopilot Engine] Outside activity hours, skipping');
      // Outside activity hours - skip processing
      return;
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

    // Get context and settings
    const settings = loadSettings();
    const toneSettings = loadToneSettings();
    const writingStyle = loadWritingStylePatterns();
    const threadContext = getThreadContext(chatId);
    const threadContextStr = formatThreadContextForPrompt(threadContext);

    try {
      console.log('[Autopilot Engine] Generating draft via API...');
      // Generate draft via API
      const response = await fetch('/api/ai/autopilot-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-anthropic-key': settings.anthropicApiKey || '',
        },
        body: JSON.stringify({
          originalMessage: text,
          senderName,
          threadContext: threadContextStr,
          agentSystemPrompt: agent.systemPrompt,
          agentGoal: agent.goal,
          toneSettings,
          writingStyle,
          detectGoalCompletion: true,
          provider: settings.aiProvider || 'anthropic',
          ollamaModel: settings.ollamaModel,
          ollamaBaseUrl: settings.ollamaBaseUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.log('[Autopilot Engine] API error', error);
        throw new Error(error.error || 'Failed to generate draft');
      }

      const result = await response.json();
      console.log('[Autopilot Engine] API response', result);
      const { data } = result;
      const { suggestedReply, suggestedMessages, goalAnalysis } = data;

      // Log draft generation
      addAutopilotActivityEntry({
        id: generateId(),
        chatId,
        agentId: agent.id,
        type: 'draft-generated',
        timestamp: new Date().toISOString(),
        draftText: suggestedReply,
      });

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
          await generateHandoffSummary(chatId, agent, senderName, threadContextStr, settings);
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
      console.log('[Autopilot Engine] Handling mode', { mode: config.mode, suggestedReply: suggestedReply?.slice(0, 50) });
      if (config.mode === 'manual-approval') {
        console.log('[Autopilot Engine] Manual approval mode - calling onDraftGenerated');
        // Notify that a draft is ready for approval
        onDraftGenerated?.(chatId, suggestedReply, agent.id);
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
            delayBetween
          );
        } else {
          // Single message
          scheduler.scheduleMessage(chatId, agent.id, suggestedReply, replyDelay);
        }

        onMessageScheduled?.(chatId, new Date(Date.now() + replyDelay * 1000));
      }
    } catch (error) {
      console.error('Error in autopilot engine:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
  }, [scheduler, onDraftGenerated, onMessageScheduled, onError]);

  // Generate a handoff summary
  const generateHandoffSummary = async (
    chatId: string,
    agent: AutopilotAgent,
    senderName: string,
    threadContext: string,
    settings: ReturnType<typeof loadSettings>
  ) => {
    try {
      const response = await fetch('/api/ai/conversation-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-anthropic-key': settings.anthropicApiKey || '',
        },
        body: JSON.stringify({
          threadContext,
          agentGoal: agent.goal,
          senderName,
          provider: settings.aiProvider || 'anthropic',
          ollamaModel: settings.ollamaModel,
          ollamaBaseUrl: settings.ollamaBaseUrl,
        }),
      });

      if (response.ok) {
        const { data } = await response.json();
        const summary: ConversationHandoffSummary = {
          chatId,
          agentId: agent.id,
          generatedAt: new Date().toISOString(),
          ...data,
        };
        saveHandoffSummary(summary);

        addAutopilotActivityEntry({
          id: generateId(),
          chatId,
          agentId: agent.id,
          type: 'handoff-triggered',
          timestamp: new Date().toISOString(),
          metadata: { summary: data.summary },
        });

        onGoalCompleted?.(chatId, summary);
      }
    } catch (error) {
      console.error('Failed to generate handoff summary:', error);
    }
  };

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

  // Get all active autopilot chats
  const getActiveChats = useCallback((): ChatAutopilotConfig[] => {
    const agents = loadAutopilotAgents();
    // This is a simple implementation - in production you'd want to track this differently
    const allConfigs: ChatAutopilotConfig[] = [];
    // Note: We'd need to iterate through all configs, but we don't have a list of all chatIds
    // This would need to be enhanced to track active chats separately
    return allConfigs;
  }, []);

  return {
    handleIncomingMessage,
    approveAndSend,
    getActiveChats,
    scheduler,
    // Pass through scheduler methods
    cancelChat: scheduler.cancelChat,
    isRunning: scheduler.isRunning,
    pendingCount: scheduler.pendingCount,
  };
}
