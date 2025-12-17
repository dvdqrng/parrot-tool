'use client';

import { useState, useEffect } from 'react';
import { getPendingActionsForChat } from '@/lib/storage';
import { ChatAutopilotConfig, AutopilotStatus } from '@/lib/types';

interface PendingDraft {
  draft: string;
  actionId: string;
  messageId: string;
}

/**
 * Hook to monitor pending drafts for a chat in manual-approval mode
 * Polls every 2 seconds when conditions are met
 */
export function usePendingDrafts(
  chatId: string | null,
  config: ChatAutopilotConfig | null,
  status: AutopilotStatus
): PendingDraft | null {
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);

  useEffect(() => {
    // Only check for drafts in manual-approval mode when active
    if (!config || config.mode !== 'manual-approval' || status !== 'active' || !chatId) {
      setPendingDraft(null);
      return;
    }

    const checkForDrafts = () => {
      const pendingActions = getPendingActionsForChat(chatId);
      const draftAction = pendingActions.find((a) => a.type === 'send-message' && a.messageText);

      if (draftAction && draftAction.messageText) {
        setPendingDraft({
          draft: draftAction.messageText,
          actionId: draftAction.id,
          messageId: draftAction.messageId || '', // messageId is optional for proactive messages
        });
      } else {
        setPendingDraft(null);
      }
    };

    checkForDrafts();
    // Poll every 500ms for responsive feedback
    const interval = setInterval(checkForDrafts, 500);
    return () => clearInterval(interval);
  }, [chatId, config, status]);

  return pendingDraft;
}
