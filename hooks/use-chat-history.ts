'use client';

/**
 * Unified chat history hook.
 *
 * Provides cursor-based message fetching, polling for new messages,
 * manual "load more" for older messages, and automatic full-history
 * loading when an agent is activated on a chat.
 *
 * Used by MessagePanel, MessageModal, and the background history loader
 * (via the exported fetchChatMessages utility).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { BeeperMessage, BeeperAttachment } from '@/lib/types';
import { loadSettings, saveCachedMessages, loadCachedMessages } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/intelligence/event-bus';

// ─── Shared types ────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  isFromMe: boolean;
  senderName: string;
  senderAvatarUrl?: string;
  attachments?: BeeperAttachment[];
}

// ─── Shared fetch utility ────────────────────────────────────────────

/**
 * Low-level fetch for chat messages. Used by both the hook and the
 * background history loader so there is exactly one place that talks
 * to the /api/beeper/chats endpoint for message retrieval.
 */
export async function fetchChatMessages(
  chatId: string,
  opts: { limit: number; cursor?: string | null; beeperToken: string },
): Promise<{ messages: BeeperMessage[]; nextCursor: string | null }> {
  const params = new URLSearchParams({
    chatId,
    limit: String(opts.limit),
  });
  if (opts.cursor) {
    params.set('cursor', opts.cursor);
  }

  const headers: HeadersInit = {};
  if (opts.beeperToken) {
    headers['x-beeper-token'] = opts.beeperToken;
  }

  const response = await fetch(`/api/beeper/chats?${params}`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.status}`);
  }

  const result = await response.json();
  return {
    messages: (result.data as BeeperMessage[]) || [],
    nextCursor: result.nextCursor || null,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────

export interface UseChatHistoryOptions {
  /** When true, automatically batch-load the entire history (agent mode). */
  autoLoadAll?: boolean;
  /** Number of messages to fetch on initial load. Default 20. */
  initialLimit?: number;
  /** Milliseconds between polls for new messages. 0 = no polling. Default 5000. */
  pollInterval?: number;
  /** Called after each batch of messages is loaded. */
  onMessagesLoaded?: (chatId: string, msgs: Array<{ timestamp: string; isFromMe: boolean }>) => void;
}

export interface UseChatHistoryReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isAutoLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  reset: () => void;
}

function toBeeperToken(): string {
  return loadSettings().beeperAccessToken || '';
}

function mapToChatMessage(m: BeeperMessage): ChatMessage {
  return {
    id: m.id,
    text: m.text,
    timestamp: m.timestamp,
    isFromMe: m.isFromMe,
    senderName: m.senderName,
    senderAvatarUrl: m.senderAvatarUrl,
    attachments: m.attachments,
  };
}

export function useChatHistory(
  chatId: string | null | undefined,
  options: UseChatHistoryOptions = {},
): UseChatHistoryReturn {
  const {
    autoLoadAll = false,
    initialLimit = 20,
    pollInterval = 5000,
    onMessagesLoaded,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const nextCursorRef = useRef<string | null>(null);
  const autoLoadAbortRef = useRef<AbortController | null>(null);

  // Stable ref for callback to avoid re-renders
  const onMessagesLoadedRef = useRef(onMessagesLoaded);
  onMessagesLoadedRef.current = onMessagesLoaded;

  // ── Merge helper ──────────────────────────────────────────────────

  const mergeMessages = useCallback((
    newMessages: ChatMessage[],
    updateCursor: boolean,
    nextCursor: string | null,
    requestedLimit: number,
  ) => {
    // Cursor: only update when explicitly loading older messages or on
    // first load. Polling fetches the newest messages and must NOT
    // overwrite the cursor.
    if (nextCursor && (updateCursor || !nextCursorRef.current)) {
      nextCursorRef.current = nextCursor;
    }

    let allMessages: ChatMessage[] = [];

    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      // Deduplicate within newMessages and filter out already-existing IDs
      const seenInBatch = new Set<string>();
      const unique: ChatMessage[] = [];
      for (const m of newMessages) {
        if (!existingIds.has(m.id) && !seenInBatch.has(m.id)) {
          seenInBatch.add(m.id);
          unique.push(m);
        }
      }
      if (unique.length === 0) {
        allMessages = prev;
        return prev;
      }
      const merged = [...prev, ...unique];
      allMessages = merged.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      return allMessages;
    });

    setHasMore(newMessages.length >= requestedLimit);

    // Notify parent with ALL accumulated messages (not just new ones)
    // This ensures stats are calculated correctly across all loaded messages
    if (chatId && onMessagesLoadedRef.current && allMessages.length > 0) {
      onMessagesLoadedRef.current(chatId, allMessages.map(m => ({
        timestamp: m.timestamp,
        isFromMe: m.isFromMe,
      })));
    }
  }, [chatId]);

  // ── Reset ─────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    autoLoadAbortRef.current?.abort();
    setMessages([]);
    setHasMore(true);
    setIsLoading(false);
    setIsLoadingMore(false);
    setIsAutoLoading(false);
    setInitialLoadDone(false);
    nextCursorRef.current = null;
  }, []);

  // ── Fetch a batch (internal) ──────────────────────────────────────

  const fetchBatch = useCallback(async (
    limit: number,
    cursor?: string | null,
  ): Promise<{ chatMessages: ChatMessage[]; nextCursor: string | null }> => {
    if (!chatId) return { chatMessages: [], nextCursor: null };
    const token = toBeeperToken();
    const { messages: raw, nextCursor } = await fetchChatMessages(chatId, {
      limit,
      cursor,
      beeperToken: token,
    });
    return { chatMessages: raw.map(mapToChatMessage), nextCursor };
  }, [chatId]);

  // ── Initial load + chat switch ────────────────────────────────────

  useEffect(() => {
    if (!chatId) return;

    // Reset state for new chat
    autoLoadAbortRef.current?.abort();
    setMessages([]);
    setHasMore(true);
    setIsAutoLoading(false);
    setInitialLoadDone(false);
    nextCursorRef.current = null;

    // Fetch newest messages from API
    setIsLoading(true);
    fetchBatch(initialLimit).then(({ chatMessages, nextCursor }) => {
      mergeMessages(chatMessages, true, nextCursor, initialLimit);
      setIsLoading(false);
      setInitialLoadDone(true);
    }).catch(() => {
      setIsLoading(false);
      setInitialLoadDone(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // ── Polling ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!chatId || !initialLoadDone || pollInterval <= 0) return;

    const interval = setInterval(async () => {
      try {
        const { chatMessages, nextCursor } = await fetchBatch(20);
        // updateCursor=false — polling must not overwrite the load-more cursor
        mergeMessages(chatMessages, false, nextCursor, 20);
      } catch {
        // Swallow polling errors silently
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [chatId, initialLoadDone, pollInterval, fetchBatch, mergeMessages]);

  // ── Manual load more ──────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!chatId || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const cursor = nextCursorRef.current;
      logger.debug(`[ChatHistory] loadMore: cursor=${cursor || 'none'}`);
      const { chatMessages, nextCursor } = await fetchBatch(20, cursor);
      mergeMessages(chatMessages, true, nextCursor, 20);
    } catch (err) {
      logger.error('[ChatHistory] loadMore failed:', err instanceof Error ? err : String(err));
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, isLoadingMore, fetchBatch, mergeMessages]);

  // ── Refresh (re-fetch newest, e.g. after sending) ─────────────────

  const refresh = useCallback(async () => {
    if (!chatId) return;
    try {
      const { chatMessages, nextCursor } = await fetchBatch(20);
      mergeMessages(chatMessages, false, nextCursor, 20);
    } catch {
      // Swallow
    }
  }, [chatId, fetchBatch, mergeMessages]);

  // ── Auto-load full history (agent mode) ───────────────────────────

  useEffect(() => {
    if (!autoLoadAll || !chatId || !initialLoadDone) return;

    autoLoadAbortRef.current?.abort();
    const controller = new AbortController();
    autoLoadAbortRef.current = controller;
    setIsAutoLoading(true);

    const BATCH_SIZE = 50;
    const BATCH_DELAY_MS = 500;
    let totalLoaded = 0;

    const run = async () => {
      logger.debug(`[ChatHistory] Auto-loading full history for ${chatId}`);
      let cursor = nextCursorRef.current;

      while (!controller.signal.aborted) {
        try {
          const { chatMessages, nextCursor } = await fetchBatch(BATCH_SIZE, cursor);
          if (controller.signal.aborted) break;

          logger.debug(`[ChatHistory] Auto-load batch: ${chatMessages.length} msgs, next=${nextCursor || 'none'}`);

          if (chatMessages.length === 0) {
            setHasMore(false);
            break;
          }

          if (nextCursor) {
            cursor = nextCursor;
            nextCursorRef.current = nextCursor;
          }

          mergeMessages(chatMessages, true, nextCursor, BATCH_SIZE);
          totalLoaded += chatMessages.length;

          // Also save to local cache for extraction
          // The background worker can then extract from cached messages
          const cachedMessages = loadCachedMessages();
          const existingIds = new Set(cachedMessages.map(m => m.id));
          const newMessages = chatMessages
            .filter(m => !existingIds.has(m.id))
            .map(m => ({
              id: m.id,
              chatId: chatId,
              text: m.text,
              timestamp: m.timestamp,
              isFromMe: m.isFromMe,
              senderName: m.senderName,
              senderAvatarUrl: m.senderAvatarUrl,
              attachments: m.attachments,
              accountId: '',
              senderId: '',
              isRead: true,
            } as BeeperMessage));

          if (newMessages.length > 0) {
            saveCachedMessages([...cachedMessages, ...newMessages]);
          }

          if (chatMessages.length < BATCH_SIZE) {
            setHasMore(false);
            break;
          }

          // Brief pause between batches
          await new Promise<void>((resolve, reject) => {
            const t = setTimeout(resolve, BATCH_DELAY_MS);
            controller.signal.addEventListener('abort', () => {
              clearTimeout(t);
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') break;
          logger.error('[ChatHistory] Auto-load error:', err instanceof Error ? err : String(err));
          break;
        }
      }

      setIsAutoLoading(false);
      logger.debug(`[ChatHistory] Auto-load finished for ${chatId}, total loaded: ${totalLoaded}`);

      // Emit event so background worker can trigger extraction on the now-loaded history
      if (totalLoaded > 0 && !controller.signal.aborted) {
        eventBus.emit({
          type: 'messages_loaded',
          chatId,
          count: totalLoaded,
        });
      }
    };

    run();

    return () => {
      controller.abort();
      setIsAutoLoading(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoadAll, chatId, initialLoadDone]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    isAutoLoading,
    hasMore,
    loadMore,
    refresh,
    reset,
  };
}
