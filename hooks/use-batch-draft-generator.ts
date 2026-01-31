'use client';

import { useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { BeeperMessage } from '@/lib/types';
import { useAiPipeline } from '@/hooks/use-ai-pipeline';

interface BatchDraftGeneratorOptions {
  onDraftGenerated: (message: BeeperMessage, draftText: string) => void;
  getAvatarUrl?: (message: BeeperMessage) => string | undefined;
  getIsGroup?: (message: BeeperMessage) => boolean | undefined;
}

interface GeneratingProgress {
  current: number;
  total: number;
}

export function useBatchDraftGenerator({
  onDraftGenerated,
  getAvatarUrl,
  getIsGroup,
}: BatchDraftGeneratorOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GeneratingProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { generateDraft } = useAiPipeline();

  const generateDraftForMessage = useCallback(async (
    message: BeeperMessage,
    signal: AbortSignal
  ): Promise<string | null> => {
    try {
      const result = await generateDraft(
        message.chatId,
        message.text,
        message.senderName,
        { signal },
      );
      return result.text || null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      logger.error('Error generating draft:', error instanceof Error ? error : String(error));
      return null;
    }
  }, [generateDraft]);

  const generateAllDrafts = useCallback(async (messages: BeeperMessage[]) => {
    if (isGenerating || messages.length === 0) return;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsGenerating(true);
    setProgress({ current: 0, total: messages.length });

    for (let i = 0; i < messages.length; i++) {
      if (signal.aborted) break;

      const message = messages[i];
      setProgress({ current: i + 1, total: messages.length });

      const draftText = await generateDraftForMessage(message, signal);

      if (draftText && !signal.aborted) {
        onDraftGenerated(message, draftText);
      }

      // Small delay between requests to avoid rate limiting
      if (i < messages.length - 1 && !signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsGenerating(false);
    setProgress(null);
    abortControllerRef.current = null;
  }, [isGenerating, generateDraftForMessage, onDraftGenerated]);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setProgress(null);
  }, []);

  return {
    isGenerating,
    progress,
    generateAllDrafts,
    cancelGeneration,
  };
}
