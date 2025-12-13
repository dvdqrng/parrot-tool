'use client';

import { useState, useCallback, useRef } from 'react';
import { BeeperMessage, Draft, ToneSettings } from '@/lib/types';
import { loadSettings, loadToneSettings, loadWritingStylePatterns } from '@/lib/storage';

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

  const generateDraftForMessage = useCallback(async (
    message: BeeperMessage,
    signal: AbortSignal
  ): Promise<string | null> => {
    try {
      const settings = loadSettings();
      const toneSettings = loadToneSettings();
      const writingStyle = loadWritingStylePatterns();

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (settings.anthropicApiKey) {
        headers['x-anthropic-key'] = settings.anthropicApiKey;
      }

      const response = await fetch('/api/ai/draft', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          originalMessage: message.text,
          senderName: message.senderName,
          toneSettings: toneSettings || undefined,
          writingStyle: writingStyle.sampleMessages.length > 0 ? writingStyle : undefined,
        }),
        signal,
      });

      if (!response.ok) {
        console.error(`Failed to generate draft for message ${message.id}`);
        return null;
      }

      const result = await response.json();

      if (result.error) {
        console.error(`Error generating draft: ${result.error}`);
        return null;
      }

      return result.data?.suggestedReply || null;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      console.error('Error generating draft:', error);
      return null;
    }
  }, []);

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
