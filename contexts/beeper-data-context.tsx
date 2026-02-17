'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { BeeperAccount, BeeperMessage, BeeperUserInfo } from '@/lib/types';
import { ChatInfo, BeeperDataResponse } from '@/lib/beeper/types';
import {
  loadSettings,
  loadCachedMessages,
  saveCachedMessages,
  loadCachedAccounts,
  saveCachedAccounts,
  loadCachedAvatars,
  mergeCachedAvatars,
  loadCachedChatInfo,
  mergeCachedChatInfo,
  getBeeperUserInfo,
  saveBeeperUserInfo,
  updateCachedMessageNames,
  updateDraftRecipientNames,
  updateCachedChatInfoTitles,
} from '@/lib/storage';
import { POLLING_INTERVALS } from '@/lib/constants';
import { eventBus, emitMessageReceived, emitMessageSent } from '@/lib/intelligence/event-bus';

/**
 * Detect changes between old and new message lists
 */
interface MessageDiff {
  hasChanges: boolean;
  newMessages: BeeperMessage[];
  updatedMessages: BeeperMessage[];
  removedIds: Set<string>;
}

function diffMessages(existing: BeeperMessage[], incoming: BeeperMessage[]): MessageDiff {
  const existingMap = new Map<string, BeeperMessage>();
  for (const msg of existing) {
    existingMap.set(msg.id, msg);
  }

  const incomingIds = new Set<string>();
  const newMessages: BeeperMessage[] = [];
  const updatedMessages: BeeperMessage[] = [];

  for (const msg of incoming) {
    incomingIds.add(msg.id);
    const existingMsg = existingMap.get(msg.id);

    if (!existingMsg) {
      newMessages.push(msg);
    } else if (
      existingMsg.timestamp !== msg.timestamp ||
      existingMsg.text !== msg.text ||
      existingMsg.unreadCount !== msg.unreadCount ||
      existingMsg.isRead !== msg.isRead
    ) {
      updatedMessages.push(msg);
    }
  }

  const removedIds = new Set<string>();
  for (const id of existingMap.keys()) {
    if (!incomingIds.has(id)) {
      removedIds.add(id);
    }
  }

  return {
    hasChanges: newMessages.length > 0 || updatedMessages.length > 0 || removedIds.size > 0,
    newMessages,
    updatedMessages,
    removedIds,
  };
}

function applyMessageDiff(
  existing: BeeperMessage[],
  incoming: BeeperMessage[],
  diff: MessageDiff
): BeeperMessage[] {
  if (!diff.hasChanges) return existing;

  const existingMap = new Map<string, BeeperMessage>();
  for (const msg of existing) {
    existingMap.set(msg.id, msg);
  }

  const updatedMap = new Map<string, BeeperMessage>();
  for (const msg of diff.updatedMessages) {
    updatedMap.set(msg.id, msg);
  }

  return incoming.map(newMsg => {
    if (updatedMap.has(newMsg.id)) return updatedMap.get(newMsg.id)!;
    const existingMsg = existingMap.get(newMsg.id);
    if (existingMsg) return existingMsg;
    return newMsg;
  });
}

/**
 * Utility to compare and merge record state
 */
function mergeRecordState<T>(
  prev: Record<string, T>,
  merged: Record<string, T>,
  isEqual: (a: T, b: T) => boolean
): Record<string, T> {
  const prevKeys = Object.keys(prev);
  const newKeys = Object.keys(merged);

  if (prevKeys.length !== newKeys.length) return merged;

  for (const key of prevKeys) {
    const prevVal = prev[key];
    const newVal = merged[key];
    if (!newVal || !isEqual(prevVal, newVal)) return merged;
  }

  return prev;
}

/**
 * Context value interface
 */
interface BeeperDataContextValue {
  // Data
  accounts: BeeperAccount[];
  messages: BeeperMessage[];
  unreadMessages: BeeperMessage[];
  sentMessages: BeeperMessage[];
  archivedMessages: BeeperMessage[];
  userInfo: BeeperUserInfo | null;
  chatInfo: Record<string, ChatInfo>;
  avatars: Record<string, string>;

  // State
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  isFromCache: boolean;
  hasMore: boolean;

  // Selected accounts
  selectedAccountIds: string[];
  setSelectedAccountIds: (ids: string[]) => void;

  // Hidden chats
  hiddenChatIds: Set<string>;
  setHiddenChatIds: (ids: Set<string>) => void;

  // Actions
  refetch: () => Promise<void>;
  poll: () => Promise<void>;
  loadMore: () => void;
}

const BeeperDataContext = createContext<BeeperDataContextValue | null>(null);

/**
 * Provider component
 */
export function BeeperDataProvider({ children }: { children: ReactNode }) {
  // Core data state
  const [accounts, setAccounts] = useState<BeeperAccount[]>(() => loadCachedAccounts());
  const [messages, setMessages] = useState<BeeperMessage[]>(() => loadCachedMessages());
  const [archivedMessages, setArchivedMessages] = useState<BeeperMessage[]>([]);
  const [userInfo, setUserInfo] = useState<BeeperUserInfo | null>(() => getBeeperUserInfo());
  const [chatInfo, setChatInfo] = useState<Record<string, ChatInfo>>(() => loadCachedChatInfo());
  const [avatars, setAvatars] = useState<Record<string, string>>(() => loadCachedAvatars());

  // Selection state
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [hiddenChatIds, setHiddenChatIds] = useState<Set<string>>(new Set());

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Refs for tracking
  const messagesRef = useRef<BeeperMessage[]>(messages);
  const hasLoadedOnceRef = useRef(false);

  // Convert hiddenChatIds to string for stable deps
  const hiddenChatIdsString = useMemo(
    () => Array.from(hiddenChatIds).sort().join(','),
    [hiddenChatIds]
  );

  /**
   * Fetch data from the unified endpoint
   */
  const fetchData = useCallback(async (
    cursor?: string | null,
    isBackgroundPoll = false
  ) => {
    let didSetLoading = false;
    let didSetLoadingMore = false;

    if (cursor) {
      setIsLoadingMore(true);
      didSetLoadingMore = true;
    } else if (!isBackgroundPoll || !hasLoadedOnceRef.current) {
      setIsLoading(true);
      didSetLoading = true;
    }

    if (!isBackgroundPoll) {
      setError(null);
    }

    try {
      const settings = loadSettings();
      const headers: HeadersInit = {};
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      // Build query params
      const params = new URLSearchParams({
        slices: 'accounts,messages,userInfo',
      });

      if (selectedAccountIds.length > 0) {
        params.set('accountIds', selectedAccountIds.join(','));
      }

      if (hiddenChatIdsString) {
        params.set('hiddenChatIds', hiddenChatIdsString);
      }

      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`/api/beeper/data?${params}`, { headers });
      const result: BeeperDataResponse & { error?: string } = await response.json();

      if (result.error) {
        setError(result.error);
        return;
      }

      // Update accounts
      if (result.accounts) {
        setAccounts(prev => {
          if (JSON.stringify(prev) === JSON.stringify(result.accounts)) return prev;
          saveCachedAccounts(result.accounts!);
          return result.accounts!;
        });
      }

      // Update user info
      if (result.userInfo) {
        setUserInfo(prev => {
          if (prev?.name === result.userInfo?.name && prev?.avatarUrl === result.userInfo?.avatarUrl) {
            return prev;
          }
          saveBeeperUserInfo(result.userInfo!);
          return result.userInfo!;
        });
      }

      // Update messages with diff-based approach
      if (cursor) {
        // Pagination: append
        const appendedMessages = result.messages || [];
        setMessages(prev => {
          const updated = [...prev, ...appendedMessages];
          saveCachedMessages(updated);
          messagesRef.current = updated;
          return updated;
        });
      } else if (result.messages) {
        // Full refresh: diff-based update
        const newMessages = result.messages;
        const existingMessages = messagesRef.current;
        const diff = diffMessages(existingMessages, newMessages);

        if (diff.hasChanges) {
          // Only emit events for RECENT messages (last 7 days)
          // This prevents flooding the extraction queue with old chats on initial load
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const recentNewMessages = diff.newMessages.filter(msg => {
            const msgTime = new Date(msg.timestamp).getTime();
            return msgTime > sevenDaysAgo;
          });

          // Emit events only for recent messages
          for (const msg of recentNewMessages) {
            if (msg.isFromMe) {
              emitMessageSent(msg);
            } else {
              emitMessageReceived(msg);
            }
          }

          // Log if we detected new messages
          if (recentNewMessages.length > 0) {
            console.log(`[BeeperDataProvider] ${recentNewMessages.length} recent message(s) detected (of ${diff.newMessages.length} total), events emitted`);
          }

          setMessages(prev => {
            const currentDiff = diffMessages(prev, newMessages);
            if (!currentDiff.hasChanges) return prev;
            const updated = applyMessageDiff(prev, newMessages, currentDiff);
            saveCachedMessages(updated);
            messagesRef.current = updated;
            return updated;
          });
          setIsFromCache(false);
        }
        hasLoadedOnceRef.current = true;
      }

      // Update archived messages
      if (result.archivedMessages) {
        setArchivedMessages(prev => {
          if (JSON.stringify(prev) === JSON.stringify(result.archivedMessages)) return prev;
          return result.archivedMessages!;
        });
      }

      // Update avatars
      if (result.avatars && Object.keys(result.avatars).length > 0) {
        const mergedAvatars = mergeCachedAvatars(result.avatars);
        setAvatars(prev => mergeRecordState(prev, mergedAvatars, (a, b) => a === b));
      }

      // Update chat info
      if (result.chatInfo && Object.keys(result.chatInfo).length > 0) {
        const mergedChatInfo = mergeCachedChatInfo(result.chatInfo);
        setChatInfo(prev => mergeRecordState(
          prev,
          mergedChatInfo,
          (a, b) => a.isGroup === b.isGroup && a.title === b.title
        ));
      }

      // Update name maps
      if (!cursor && result.messages && result.messages.length > 0) {
        const nameMap: Record<string, { name: string; avatarUrl?: string }> = {};
        const titleMap: Record<string, string> = {};
        for (const msg of result.messages) {
          if (msg.chatId && msg.senderName) {
            nameMap[msg.chatId] = {
              name: msg.senderName,
              avatarUrl: msg.senderAvatarUrl,
            };
            titleMap[msg.chatId] = msg.senderName;
          }
        }
        updateCachedMessageNames(nameMap);
        updateDraftRecipientNames(nameMap);
        updateCachedChatInfoTitles(titleMap);
      }

      // Update pagination
      const newHasMore = result.hasMore || false;
      const newNextCursor = result.nextCursor || null;
      setHasMore(prev => prev === newHasMore ? prev : newHasMore);
      setNextCursor(prev => prev === newNextCursor ? prev : newNextCursor);

    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      if (didSetLoading) setIsLoading(false);
      if (didSetLoadingMore) setIsLoadingMore(false);
    }
  }, [selectedAccountIds, hiddenChatIdsString]);

  /**
   * Manual refetch (shows loading)
   */
  const refetch = useCallback(async () => {
    await fetchData(null, false);
  }, [fetchData]);

  /**
   * Background poll (silent)
   */
  const poll = useCallback(async () => {
    await fetchData(null, true);
  }, [fetchData]);

  /**
   * Load more (pagination)
   */
  const loadMore = useCallback(() => {
    if (hasMore && nextCursor && !isLoadingMore) {
      fetchData(nextCursor);
    }
  }, [hasMore, nextCursor, isLoadingMore, fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      poll();
    }, POLLING_INTERVALS.MESSAGES);

    return () => clearInterval(interval);
  }, [poll]);

  // Computed values
  const unreadMessages = useMemo(() => {
    return messages.filter(m => {
      const isHidden = hiddenChatIds.has(m.chatId);
      return !m.isRead && !m.isFromMe && !isHidden;
    });
  }, [messages, hiddenChatIds]);

  const sentMessages = useMemo(() => {
    return messages.filter(m => m.isFromMe);
  }, [messages]);

  const value: BeeperDataContextValue = {
    accounts,
    messages,
    unreadMessages,
    sentMessages,
    archivedMessages,
    userInfo,
    chatInfo,
    avatars,
    isLoading,
    isLoadingMore,
    error,
    isFromCache,
    hasMore,
    selectedAccountIds,
    setSelectedAccountIds,
    hiddenChatIds,
    setHiddenChatIds,
    refetch,
    poll,
    loadMore,
  };

  return (
    <BeeperDataContext.Provider value={value}>
      {children}
    </BeeperDataContext.Provider>
  );
}

/**
 * Hook to access Beeper data
 */
export function useBeeperData(): BeeperDataContextValue {
  const context = useContext(BeeperDataContext);
  if (!context) {
    throw new Error('useBeeperData must be used within a BeeperDataProvider');
  }
  return context;
}
