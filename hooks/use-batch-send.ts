'use client';

import { useState, useCallback, useRef } from 'react';
import { Draft } from '@/lib/types';
import { loadSettings } from '@/lib/storage';

interface BatchSendOptions {
  onDraftSent: (draft: Draft) => void;
}

interface SendingProgress {
  current: number;
  total: number;
}

export function useBatchSend({ onDraftSent }: BatchSendOptions) {
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<SendingProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendDraft = useCallback(async (
    draft: Draft,
    signal: AbortSignal
  ): Promise<boolean> => {
    try {
      const settings = loadSettings();

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      const response = await fetch('/api/beeper/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          chatId: draft.chatId,
          text: draft.draftText,
        }),
        signal,
      });

      if (!response.ok) {
        console.error(`Failed to send draft ${draft.id}`);
        return false;
      }

      const result = await response.json();

      if (result.error) {
        console.error(`Error sending draft: ${result.error}`);
        return false;
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }
      console.error('Error sending draft:', error);
      return false;
    }
  }, []);

  const sendAllDrafts = useCallback(async (drafts: Draft[]) => {
    if (isSending || drafts.length === 0) return;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsSending(true);
    setProgress({ current: 0, total: drafts.length });

    for (let i = 0; i < drafts.length; i++) {
      if (signal.aborted) break;

      const draft = drafts[i];
      setProgress({ current: i + 1, total: drafts.length });

      const success = await sendDraft(draft, signal);

      if (success && !signal.aborted) {
        onDraftSent(draft);
      }

      // Small delay between requests to avoid rate limiting
      if (i < drafts.length - 1 && !signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsSending(false);
    setProgress(null);
    abortControllerRef.current = null;
  }, [isSending, sendDraft, onDraftSent]);

  const cancelSending = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSending(false);
    setProgress(null);
  }, []);

  return {
    isSending,
    progress,
    sendAllDrafts,
    cancelSending,
  };
}
