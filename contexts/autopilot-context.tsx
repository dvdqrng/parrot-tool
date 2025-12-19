'use client';

import React, { createContext, useContext, useCallback, useState, useRef } from 'react';
import { BeeperMessage, ConversationHandoffSummary } from '@/lib/types';
import { useAutopilotEngine } from '@/hooks/use-autopilot-engine';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface AutopilotContextValue {
  // Engine state
  isRunning: boolean;
  pendingCount: number;

  // Process incoming messages
  processNewMessages: (messages: BeeperMessage[]) => void;

  // Trigger processing for a specific chat (when autopilot is just enabled)
  triggerChatProcessing: (chatId: string, message: BeeperMessage) => void;

  // Generate a proactive message (when enabling autopilot without an unread message)
  generateProactiveMessage: (chatId: string) => void;

  // Regenerate a draft for a message
  regenerateDraft: (messageId: string) => void;

  // Cancel autopilot for a chat
  cancelChat: (chatId: string) => void;

  // Handoff summaries
  handoffSummaries: Map<string, ConversationHandoffSummary>;
  dismissHandoff: (chatId: string) => void;

  // Config change counter - increments when any chat's autopilot config changes
  // Components can use this as a dependency to re-check configs
  configVersion: number;
  notifyConfigChange: () => void;
}

const AutopilotContext = createContext<AutopilotContextValue | null>(null);

export function AutopilotProvider({ children }: { children: React.ReactNode }) {
  const [handoffSummaries, setHandoffSummaries] = useState<Map<string, ConversationHandoffSummary>>(new Map());
  const [configVersion, setConfigVersion] = useState(0);
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Notify that a config has changed - triggers re-render in consuming components
  const notifyConfigChange = useCallback(() => {
    setConfigVersion(v => v + 1);
  }, []);

  const engine = useAutopilotEngine({
    onMessageScheduled: () => {
      // Could show a notification here if needed
    },
    onGoalCompleted: (chatId, summary) => {
      setHandoffSummaries(prev => {
        const newMap = new Map(prev);
        newMap.set(chatId, summary);
        return newMap;
      });

      toast.success('Goal Completed', {
        description: 'Autopilot has achieved its goal and is ready for handoff.',
      });
    },
    onError: (chatId, error) => {
      toast.error('Autopilot Error', {
        description: error,
      });
    },
  });

  const processNewMessages = useCallback((messages: BeeperMessage[]) => {
    logger.autopilot('processNewMessages called', { totalMessages: messages.length });

    // Filter to only new, unread messages not from us
    const newMessages = messages.filter(m => {
      if (m.isFromMe) return false;
      if (m.isRead) return false;
      if (processedMessageIds.current.has(m.id)) return false;
      return true;
    });

    logger.autopilot('Filtered to new messages', {
      newCount: newMessages.length,
      messages: newMessages.map(m => ({ id: m.id, chatId: m.chatId, text: m.text?.slice(0, 30) }))
    });

    // Process each new message
    for (const message of newMessages) {
      logger.autopilot('Processing message', { id: message.id, chatId: message.chatId });
      processedMessageIds.current.add(message.id);
      engine.handleIncomingMessage(message);
    }

    // Cleanup old processed IDs
    if (processedMessageIds.current.size > 500) {
      const arr = Array.from(processedMessageIds.current);
      processedMessageIds.current = new Set(arr.slice(-500));
    }
  }, [engine]);


  // Trigger processing for a specific chat - used when autopilot is just enabled
  // This bypasses deduplication and activity hours checks to ensure immediate action
  const triggerChatProcessing = useCallback((chatId: string, message: BeeperMessage) => {
    logger.autopilot('triggerChatProcessing called', { chatId, messageId: message.id, text: message.text?.slice(0, 30) });
    // Remove the message ID from processed set so it can be reprocessed
    processedMessageIds.current.delete(message.id);
    // Now process it with forceProcess=true to bypass engine's deduplication AND activity hours
    engine.handleIncomingMessage(message, true);
  }, [engine]);

  const cancelChat = useCallback((chatId: string) => {
    engine.cancelChat(chatId);
  }, [engine]);

  const generateProactiveMessage = useCallback((chatId: string) => {
    logger.autopilot('generateProactiveMessage called', { chatId });
    engine.generateProactiveMessage(chatId);
  }, [engine]);

  const dismissHandoff = useCallback((chatId: string) => {
    setHandoffSummaries(prev => {
      const newMap = new Map(prev);
      newMap.delete(chatId);
      return newMap;
    });
  }, []);

  const value: AutopilotContextValue = {
    isRunning: engine.isRunning,
    pendingCount: engine.pendingCount,
    processNewMessages,
    triggerChatProcessing,
    generateProactiveMessage,
    regenerateDraft: engine.regenerateDraft,
    cancelChat,
    handoffSummaries,
    dismissHandoff,
    configVersion,
    notifyConfigChange,
  };

  return (
    <AutopilotContext.Provider value={value}>
      {children}
    </AutopilotContext.Provider>
  );
}

export function useAutopilot() {
  const context = useContext(AutopilotContext);
  if (!context) {
    throw new Error('useAutopilot must be used within an AutopilotProvider');
  }
  return context;
}
