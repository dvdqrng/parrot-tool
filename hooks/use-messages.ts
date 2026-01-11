'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BeeperMessage } from '@/lib/types';
import { loadSettings, loadCachedMessages, saveCachedMessages, loadCachedAvatars, mergeCachedAvatars, loadCachedChatInfo, mergeCachedChatInfo, updateCachedMessageNames, updateDraftRecipientNames, updateCachedChatInfoTitles } from '@/lib/storage';

// Deep compare messages using a Map for efficient lookup
// This handles reordering without triggering unnecessary re-renders
function messagesEqual(a: BeeperMessage[], b: BeeperMessage[]): boolean {
  if (a.length !== b.length) return false;

  // Build a map of the new messages for O(1) lookup
  const bMap = new Map<string, BeeperMessage>();
  for (const msg of b) {
    bMap.set(msg.id, msg);
  }

  // Check if all messages in 'a' exist in 'b' with same content
  for (const msgA of a) {
    const msgB = bMap.get(msgA.id);
    if (!msgB) return false; // Message was removed
    // Compare key fields that would affect display
    if (msgA.timestamp !== msgB.timestamp ||
        msgA.text !== msgB.text ||
        msgA.unreadCount !== msgB.unreadCount ||
        msgA.isRead !== msgB.isRead) {
      return false;
    }
  }

  return true;
}

// Merge new messages into existing array, preserving object references where possible
function mergeMessages(existing: BeeperMessage[], incoming: BeeperMessage[]): BeeperMessage[] {
  const existingMap = new Map<string, BeeperMessage>();
  for (const msg of existing) {
    existingMap.set(msg.id, msg);
  }

  // Map incoming messages, reusing existing references when unchanged
  return incoming.map(newMsg => {
    const existingMsg = existingMap.get(newMsg.id);
    if (existingMsg &&
        existingMsg.timestamp === newMsg.timestamp &&
        existingMsg.text === newMsg.text &&
        existingMsg.unreadCount === newMsg.unreadCount &&
        existingMsg.isRead === newMsg.isRead) {
      // Reuse existing object reference to prevent re-renders
      return existingMsg;
    }
    return newMsg;
  });
}

// Check if two record objects are equal (shallow comparison of values)
function recordsEqual<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

// Check if chat info records are equal (deep comparison)
function chatInfoEqual(
  a: Record<string, { isGroup: boolean; title?: string }>,
  b: Record<string, { isGroup: boolean; title?: string }>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const aInfo = a[key];
    const bInfo = b[key];
    if (!bInfo || aInfo.isGroup !== bInfo.isGroup || aInfo.title !== bInfo.title) {
      return false;
    }
  }
  return true;
}

export function useMessages(accountIds: string[], hiddenChatIds?: Set<string>) {
  const [messages, setMessages] = useState<BeeperMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [chatInfo, setChatInfo] = useState<Record<string, { isGroup: boolean; title?: string }>>({});

  // Load cached messages, avatars, and chat info on mount
  useEffect(() => {
    const cached = loadCachedMessages();
    if (cached.length > 0) {
      setMessages(cached);
      setIsFromCache(true);
    }
    const cachedAvatars = loadCachedAvatars();
    setAvatars(cachedAvatars);
    const cachedInfo = loadCachedChatInfo();
    setChatInfo(cachedInfo);
  }, []);

  // Convert Set to string for stable dependency comparison
  const hiddenChatIdsString = hiddenChatIds ? Array.from(hiddenChatIds).sort().join(',') : '';

  const fetchMessages = useCallback(async (cursor?: string | null) => {
    if (accountIds.length === 0) {
      setMessages([]);
      setHasMore(false);
      setNextCursor(null);
      return;
    }

    if (cursor) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const settings = loadSettings();
      const headers: HeadersInit = {};
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      const params = new URLSearchParams({
        accountIds: accountIds.join(','),
      });

      if (cursor) {
        params.set('cursor', cursor);
      }

      if (hiddenChatIdsString) {
        params.set('hiddenChatIds', hiddenChatIdsString);
      }

      const response = await fetch(`/api/beeper/messages?${params}`, { headers });
      const result = await response.json();

      if (result.error) {
        setError(result.error);
        if (!cursor) {
          // Keep cached messages on error if we have them
          const cached = loadCachedMessages();
          if (cached.length > 0) {
            setMessages(cached);
            setIsFromCache(true);
          } else {
            setMessages([]);
          }
        }
      } else {
        if (cursor) {
          // Append to existing messages
          setMessages(prev => {
            const updated = [...prev, ...(result.data || [])];
            saveCachedMessages(updated);
            return updated;
          });
        } else {
          // Replace messages only if data actually changed
          const newMessages = result.data || [];
          setMessages(prev => {
            if (messagesEqual(prev, newMessages)) {
              // Data hasn't changed, keep previous reference to avoid re-renders
              return prev;
            }
            // Merge to preserve object references for unchanged messages
            const merged = mergeMessages(prev, newMessages);
            saveCachedMessages(merged);
            return merged;
          });
          setIsFromCache(false);
        }
        // Merge new avatars with cached ones, only update state if changed
        if (result.avatars && Object.keys(result.avatars).length > 0) {
          const mergedAvatars = mergeCachedAvatars(result.avatars);
          setAvatars(prev => recordsEqual(prev, mergedAvatars) ? prev : mergedAvatars);
        }
        // Merge new chat info with cached ones, only update state if changed
        if (result.chatInfo && Object.keys(result.chatInfo).length > 0) {
          const mergedChatInfo = mergeCachedChatInfo(result.chatInfo);
          setChatInfo(prev => chatInfoEqual(prev, mergedChatInfo) ? prev : mergedChatInfo);
        }

        // Build a name map from fresh data and update any stale cached entries
        // This corrects cached messages that might have wrong participant names
        if (!cursor && result.data && result.data.length > 0) {
          const nameMap: Record<string, { name: string; avatarUrl?: string }> = {};
          const titleMap: Record<string, string> = {};
          for (const msg of result.data) {
            if (msg.chatId && msg.senderName) {
              nameMap[msg.chatId] = {
                name: msg.senderName,
                avatarUrl: msg.senderAvatarUrl,
              };
              titleMap[msg.chatId] = msg.senderName;
            }
          }
          // This will update any cached messages, drafts, and chat info that have different names
          updateCachedMessageNames(nameMap);
          updateDraftRecipientNames(nameMap);
          updateCachedChatInfoTitles(titleMap);
        }

        setHasMore(result.hasMore || false);
        setNextCursor(result.nextCursor || null);
      }
    } catch (err) {
      setError('Failed to fetch messages');
      if (!cursor) {
        // Keep cached messages on error if we have them
        const cached = loadCachedMessages();
        if (cached.length > 0) {
          setMessages(cached);
          setIsFromCache(true);
        } else {
          setMessages([]);
        }
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [accountIds]); // Don't include hiddenChatIdsString - we filter client-side for immediate feedback

  const loadMore = useCallback(() => {
    if (hasMore && nextCursor && !isLoadingMore) {
      fetchMessages(nextCursor);
    }
  }, [hasMore, nextCursor, isLoadingMore, fetchMessages]);

  const refetch = useCallback(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Convert hiddenChatIds Set to a stable string for memoization
  const hiddenChatIdsKey = hiddenChatIds ? Array.from(hiddenChatIds).sort().join(',') : '';

  // Memoize filtered messages to avoid re-renders when data hasn't changed
  const unreadMessages = useMemo(() => {
    return messages.filter(m => {
      const isHidden = hiddenChatIds && hiddenChatIds.has(m.chatId);
      return !m.isRead && !m.isFromMe && !isHidden;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, hiddenChatIdsKey]);

  const sentMessages = useMemo(() => {
    return messages.filter(m => m.isFromMe);
  }, [messages]);

  return {
    messages,
    unreadMessages,
    sentMessages,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
    isFromCache,
    avatars,
    chatInfo,
  };
}
