'use client';

import React, { createContext, useContext, useCallback, useState, useRef } from 'react';
import { BeeperMessage, ConversationHandoffSummary } from '@/lib/types';
import { useAutopilotEngine } from '@/hooks/use-autopilot-engine';
import { toast } from 'sonner';

interface PendingApproval {
  chatId: string;
  draftText: string;
  agentId: string;
  agentName: string;
  recipientName: string;
  timestamp: string;
}

interface AutopilotContextValue {
  // Engine state
  isRunning: boolean;
  pendingCount: number;

  // Pending approvals (for manual mode)
  pendingApprovals: PendingApproval[];
  approveDraft: (chatId: string) => void;
  rejectDraft: (chatId: string) => void;

  // Process incoming messages
  processNewMessages: (messages: BeeperMessage[]) => void;

  // Trigger processing for a specific chat (when autopilot is just enabled)
  triggerChatProcessing: (chatId: string, message: BeeperMessage) => void;

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
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [handoffSummaries, setHandoffSummaries] = useState<Map<string, ConversationHandoffSummary>>(new Map());
  const [configVersion, setConfigVersion] = useState(0);
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Notify that a config has changed - triggers re-render in consuming components
  const notifyConfigChange = useCallback(() => {
    setConfigVersion(v => v + 1);
  }, []);

  const engine = useAutopilotEngine({
    onDraftGenerated: (chatId, draftText, agentId) => {
      // Add to pending approvals
      setPendingApprovals(prev => {
        // Remove any existing approval for this chat
        const filtered = prev.filter(p => p.chatId !== chatId);
        return [...filtered, {
          chatId,
          draftText,
          agentId,
          agentName: 'Agent', // Would need to fetch agent name
          recipientName: 'Unknown',
          timestamp: new Date().toISOString(),
        }];
      });

      toast.info('Draft Ready', {
        description: 'Autopilot has generated a reply for your approval.',
      });
    },
    onMessageScheduled: () => {
      // Could show a notification here
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
    console.log('[Autopilot Context] processNewMessages called', { totalMessages: messages.length });

    // Filter to only new, unread messages not from us
    const newMessages = messages.filter(m => {
      if (m.isFromMe) return false;
      if (m.isRead) return false;
      if (processedMessageIds.current.has(m.id)) return false;
      return true;
    });

    console.log('[Autopilot Context] Filtered to new messages', {
      newCount: newMessages.length,
      messages: newMessages.map(m => ({ id: m.id, chatId: m.chatId, text: m.text?.slice(0, 30) }))
    });

    // Process each new message
    for (const message of newMessages) {
      console.log('[Autopilot Context] Processing message', { id: message.id, chatId: message.chatId });
      processedMessageIds.current.add(message.id);
      engine.handleIncomingMessage(message);
    }

    // Cleanup old processed IDs
    if (processedMessageIds.current.size > 500) {
      const arr = Array.from(processedMessageIds.current);
      processedMessageIds.current = new Set(arr.slice(-500));
    }
  }, [engine]);

  const approveDraft = useCallback((chatId: string) => {
    const approval = pendingApprovals.find(p => p.chatId === chatId);
    if (approval) {
      engine.approveAndSend(chatId, approval.draftText, approval.agentId);
      setPendingApprovals(prev => prev.filter(p => p.chatId !== chatId));

      toast.success('Message Sent', {
        description: 'Your approved message has been scheduled.',
      });
    }
  }, [pendingApprovals, engine]);

  const rejectDraft = useCallback((chatId: string) => {
    setPendingApprovals(prev => prev.filter(p => p.chatId !== chatId));
  }, []);

  // Trigger processing for a specific chat - used when autopilot is just enabled
  // This bypasses the "already processed" check to ensure existing unread messages get handled
  const triggerChatProcessing = useCallback((chatId: string, message: BeeperMessage) => {
    console.log('[Autopilot Context] triggerChatProcessing called', { chatId, messageId: message.id, text: message.text?.slice(0, 30) });
    // Remove the message ID from processed set so it can be reprocessed
    processedMessageIds.current.delete(message.id);
    // Now process it
    engine.handleIncomingMessage(message);
  }, [engine]);

  const cancelChat = useCallback((chatId: string) => {
    engine.cancelChat(chatId);
    setPendingApprovals(prev => prev.filter(p => p.chatId !== chatId));
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
    pendingApprovals,
    approveDraft,
    rejectDraft,
    processNewMessages,
    triggerChatProcessing,
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
