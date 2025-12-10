'use client';

import { useState, useEffect, useCallback } from 'react';
import { Draft, BeeperMessage } from '@/lib/types';
import {
  loadDrafts,
  saveDrafts,
  addDraft as addDraftToStorage,
  updateDraft as updateDraftInStorage,
  deleteDraft as deleteDraftFromStorage,
  generateId,
} from '@/lib/storage';

export function useDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = loadDrafts();
    setDrafts(stored);
    setIsLoaded(true);
  }, []);

  const createDraft = useCallback((
    originalMessage: BeeperMessage,
    initialText: string = '',
    avatarUrl?: string,
    isGroup?: boolean
  ): Draft => {
    const now = new Date().toISOString();
    const draft: Draft = {
      id: generateId(),
      originalMessageId: originalMessage.id,
      chatId: originalMessage.chatId,
      accountId: originalMessage.accountId,
      recipientName: originalMessage.senderName,
      originalText: originalMessage.text,
      draftText: initialText,
      platform: originalMessage.platform || 'unknown',
      avatarUrl,
      isGroup,
      createdAt: now,
      updatedAt: now,
    };

    const updated = addDraftToStorage(draft);
    setDrafts(updated);
    return draft;
  }, []);

  const updateDraft = useCallback((id: string, updates: Partial<Draft>) => {
    const updated = updateDraftInStorage(id, updates);
    setDrafts(updated);
  }, []);

  const deleteDraft = useCallback((id: string) => {
    const updated = deleteDraftFromStorage(id);
    setDrafts(updated);
  }, []);

  const getDraftByMessageId = useCallback((messageId: string): Draft | undefined => {
    return drafts.find(d => d.originalMessageId === messageId);
  }, [drafts]);

  const syncDrafts = useCallback(() => {
    const stored = loadDrafts();
    setDrafts(stored);
  }, []);

  return {
    drafts,
    isLoaded,
    createDraft,
    updateDraft,
    deleteDraft,
    getDraftByMessageId,
    syncDrafts,
  };
}
