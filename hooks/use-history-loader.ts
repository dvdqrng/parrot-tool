'use client';

/**
 * Background history loader for agent-enabled chats.
 *
 * When autopilot is activated on a chat, this hook fetches the full message
 * history in batches and runs knowledge extraction on each batch.
 * Progress is persisted to localStorage so it resumes after app restart.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAiPipeline } from './use-ai-pipeline';
import {
  loadSettings,
  getActiveAutopilotChats,
  getHistoryLoadProgress,
  saveHistoryLoadProgress,
  addAutopilotActivityEntry,
} from '@/lib/storage';
import { BeeperMessage, HistoryLoadProgress, AutopilotActivityEntry } from '@/lib/types';
import { logger } from '@/lib/logger';

const BATCH_SIZE = 200;
const BATCH_DELAY_MS = 8_000; // 8 seconds between batches

function logActivity(
  chatId: string,
  agentId: string,
  type: AutopilotActivityEntry['type'],
  metadata?: Record<string, unknown>,
): void {
  addAutopilotActivityEntry({
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chatId,
    agentId,
    type,
    timestamp: new Date().toISOString(),
    metadata,
  });
}

/**
 * Format a batch of messages into a text string for knowledge extraction.
 */
function formatMessagesForExtraction(messages: BeeperMessage[]): string {
  return messages
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(m => {
      const prefix = m.isFromMe ? 'Me' : m.senderName;
      return `${prefix}: ${m.text}`;
    })
    .filter(line => line.trim().length > 4) // skip empty/trivial messages
    .join('\n');
}

/**
 * Fetch a batch of messages for a chat, skipping already-processed ones.
 */
async function fetchMessageBatch(
  chatId: string,
  skip: number,
  beeperToken: string,
): Promise<BeeperMessage[]> {
  const params = new URLSearchParams({
    chatId,
    limit: String(BATCH_SIZE),
    skip: String(skip),
  });

  const headers: HeadersInit = {};
  if (beeperToken) {
    headers['x-beeper-token'] = beeperToken;
  }

  const response = await fetch(`/api/beeper/chats?${params}`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.status}`);
  }

  const result = await response.json();
  return (result.data as BeeperMessage[]) || [];
}

export function useHistoryLoader(configVersion?: number) {
  const { extractKnowledge } = useAiPipeline();
  const abortRef = useRef<AbortController | null>(null);
  const isRunningRef = useRef(false);

  const processChat = useCallback(async (
    chatId: string,
    agentId: string,
    senderName: string,
    beeperToken: string,
    signal: AbortSignal,
  ) => {
    let progress = getHistoryLoadProgress(chatId) || {
      chatId,
      oldestLoadedMessageId: null,
      totalMessagesProcessed: 0,
      totalBatchesProcessed: 0,
      isComplete: false,
      lastProcessedAt: new Date().toISOString(),
    };

    if (progress.isComplete) {
      logger.debug(`[HistoryLoader] Chat ${chatId} already fully processed`);
      return;
    }

    logger.debug(`[HistoryLoader] Starting deep history load for ${chatId}, skip=${progress.totalMessagesProcessed}`);
    logActivity(chatId, agentId, 'history-loading', { messagesProcessed: progress.totalMessagesProcessed });

    while (!signal.aborted) {
      try {
        const messages = await fetchMessageBatch(
          chatId,
          progress.totalMessagesProcessed,
          beeperToken,
        );

        if (signal.aborted) break;

        // No more messages -- history fully loaded
        if (messages.length === 0) {
          progress = {
            ...progress,
            isComplete: true,
            lastProcessedAt: new Date().toISOString(),
          };
          saveHistoryLoadProgress(progress);
          logActivity(chatId, agentId, 'history-complete', { messagesProcessed: progress.totalMessagesProcessed });
          logger.debug(`[HistoryLoader] Chat ${chatId} fully processed: ${progress.totalMessagesProcessed} messages, ${progress.totalBatchesProcessed} batches`);
          break;
        }

        // Format batch and extract knowledge
        const batchText = formatMessagesForExtraction(messages);
        if (batchText.length > 0) {
          const firstSenderName = messages.find(m => !m.isFromMe)?.senderName || senderName;
          try {
            await extractKnowledge(chatId, firstSenderName, batchText);
            logActivity(chatId, agentId, 'knowledge-updated', { batchSize: messages.length });
          } catch (err) {
            // Knowledge extraction failure is non-critical -- log and continue
            logger.debug('[HistoryLoader] Knowledge extraction failed for batch (continuing)', { error: err instanceof Error ? err.message : String(err) });
          }
        }

        if (signal.aborted) break;

        // Update progress
        const oldestMessage = messages[messages.length - 1];
        progress = {
          ...progress,
          oldestLoadedMessageId: oldestMessage?.id || progress.oldestLoadedMessageId,
          totalMessagesProcessed: progress.totalMessagesProcessed + messages.length,
          totalBatchesProcessed: progress.totalBatchesProcessed + 1,
          lastProcessedAt: new Date().toISOString(),
        };
        saveHistoryLoadProgress(progress);

        logger.debug(`[HistoryLoader] Chat ${chatId}: batch ${progress.totalBatchesProcessed} done, ${progress.totalMessagesProcessed} total messages`);
        logActivity(chatId, agentId, 'history-loading', { messagesProcessed: progress.totalMessagesProcessed });

        // End of history if we got fewer than requested
        if (messages.length < BATCH_SIZE) {
          progress = { ...progress, isComplete: true };
          saveHistoryLoadProgress(progress);
          logActivity(chatId, agentId, 'history-complete', { messagesProcessed: progress.totalMessagesProcessed });
          logger.debug(`[HistoryLoader] Chat ${chatId} fully processed (partial batch)`);
          break;
        }

        // Throttle between batches
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, BATCH_DELAY_MS);
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') break;
        logger.error(`[HistoryLoader] Error processing chat ${chatId}:`, err instanceof Error ? err : String(err));
        // Wait before retrying on error
        await new Promise(resolve => setTimeout(resolve, 15_000));
      }
    }
  }, [extractKnowledge]);

  const runLoader = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    // Abort any previous run
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const settings = loadSettings();
      const beeperToken = settings.beeperAccessToken || '';
      if (!beeperToken) {
        logger.debug('[HistoryLoader] No beeper token, skipping');
        return;
      }

      const activeChats = getActiveAutopilotChats();
      if (activeChats.length === 0) {
        logger.debug('[HistoryLoader] No active autopilot chats');
        return;
      }

      logger.debug(`[HistoryLoader] Found ${activeChats.length} active autopilot chats`);

      // Process one chat at a time to avoid overloading
      for (const config of activeChats) {
        if (controller.signal.aborted) break;

        // Use chatId as a rough senderName fallback
        await processChat(
          config.chatId,
          config.agentId,
          'Contact',
          beeperToken,
          controller.signal,
        );
      }
    } finally {
      isRunningRef.current = false;
    }
  }, [processChat]);

  // Start loading when autopilot configs change or on mount
  useEffect(() => {
    runLoader();

    return () => {
      abortRef.current?.abort();
    };
  }, [runLoader, configVersion]);
}
