'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BeeperMessage } from '@/lib/types';
import { loadSettings, loadCachedMessages, saveCachedMessages, loadCachedAvatars, mergeCachedAvatars, loadCachedChatInfo, mergeCachedChatInfo, updateCachedMessageNames, updateDraftRecipientNames, updateCachedChatInfoTitles } from '@/lib/storage';

// Detect what changed between old and new message lists
interface MessageDiff {
  hasChanges: boolean;
  newMessages: BeeperMessage[];      // Messages that didn't exist before
  updatedMessages: BeeperMessage[];  // Messages with changed content
  removedIds: Set<string>;           // IDs of messages that were removed
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
      // This is a new message
      newMessages.push(msg);
    } else if (
      existingMsg.timestamp !== msg.timestamp ||
      existingMsg.text !== msg.text ||
      existingMsg.unreadCount !== msg.unreadCount ||
      existingMsg.isRead !== msg.isRead
    ) {
      // This message was updated
      updatedMessages.push(msg);
    }
  }

  // Find removed messages
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

// Apply diff to existing messages, preserving object references where possible
function applyMessageDiff(
  existing: BeeperMessage[],
  incoming: BeeperMessage[],
  diff: MessageDiff
): BeeperMessage[] {
  if (!diff.hasChanges) {
    return existing; // No changes, return same reference
  }

  const existingMap = new Map<string, BeeperMessage>();
  for (const msg of existing) {
    existingMap.set(msg.id, msg);
  }

  // Build updated map with new/updated messages
  const updatedMap = new Map<string, BeeperMessage>();
  for (const msg of diff.updatedMessages) {
    updatedMap.set(msg.id, msg);
  }

  // Reconstruct list in incoming order, reusing references
  return incoming.map(newMsg => {
    // If this message was updated, use the new version
    if (updatedMap.has(newMsg.id)) {
      return updatedMap.get(newMsg.id)!;
    }
    // If this is an existing unchanged message, reuse its reference
    const existingMsg = existingMap.get(newMsg.id);
    if (existingMsg) {
      return existingMsg;
    }
    // This is a new message
    return newMsg;
  });
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

  // Track message IDs for quick lookup
  const messageIdsRef = useRef<Set<string>>(new Set());

  // Load cached messages, avatars, and chat info on mount
  useEffect(() => {
    const cached = loadCachedMessages();
    if (cached.length > 0) {
      setMessages(cached);
      messageIdsRef.current = new Set(cached.map(m => m.id));
      setIsFromCache(true);
    }
    const cachedAvatars = loadCachedAvatars();
    setAvatars(cachedAvatars);
    const cachedInfo = loadCachedChatInfo();
    setChatInfo(cachedInfo);
  }, []);

  // Convert Set to string for stable dependency comparison
  const hiddenChatIdsString = hiddenChatIds ? Array.from(hiddenChatIds).sort().join(',') : '';

  // Track if this is the initial load vs a background poll
  const hasLoadedOnceRef = useRef(false);

  const fetchMessages = useCallback(async (cursor?: string | null, isBackgroundPoll = false) => {
    if (accountIds.length === 0) {
      setMessages([]);
      messageIdsRef.current = new Set();
      setHasMore(false);
      setNextCursor(null);
      return;
    }

    // Only show loading state on initial load or manual refresh, not on background polls
    if (cursor) {
      setIsLoadingMore(true);
    } else if (!isBackgroundPoll || !hasLoadedOnceRef.current) {
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
            messageIdsRef.current = new Set(cached.map(m => m.id));
            setIsFromCache(true);
          } else {
            setMessages([]);
            messageIdsRef.current = new Set();
          }
        }
      } else {
        if (cursor) {
          // Append to existing messages
          setMessages(prev => {
            const updated = [...prev, ...(result.data || [])];
            saveCachedMessages(updated);
            messageIdsRef.current = new Set(updated.map(m => m.id));
            return updated;
          });
        } else {
          // Diff-based update: only change state if there are actual differences
          const newMessages = result.data || [];

          setMessages(prev => {
            const diff = diffMessages(prev, newMessages);

            if (!diff.hasChanges) {
              // Nothing changed - keep exact same reference, no re-render
              return prev;
            }

            // Apply changes surgically
            const updated = applyMessageDiff(prev, newMessages, diff);
            saveCachedMessages(updated);
            messageIdsRef.current = new Set(updated.map(m => m.id));
            return updated;
          });

          setIsFromCache(false);
          hasLoadedOnceRef.current = true;
        }

        // Only update avatars if they actually changed
        if (result.avatars && Object.keys(result.avatars).length > 0) {
          const mergedAvatars = mergeCachedAvatars(result.avatars);
          setAvatars(prev => {
            // Check if any values actually changed
            const prevKeys = Object.keys(prev);
            const newKeys = Object.keys(mergedAvatars);
            if (prevKeys.length === newKeys.length) {
              let same = true;
              for (const key of prevKeys) {
                if (prev[key] !== mergedAvatars[key]) {
                  same = false;
                  break;
                }
              }
              if (same) return prev;
            }
            return mergedAvatars;
          });
        }

        // Only update chat info if it actually changed
        if (result.chatInfo && Object.keys(result.chatInfo).length > 0) {
          const mergedChatInfo = mergeCachedChatInfo(result.chatInfo);
          setChatInfo(prev => {
            const prevKeys = Object.keys(prev);
            const newKeys = Object.keys(mergedChatInfo);
            if (prevKeys.length === newKeys.length) {
              let same = true;
              for (const key of prevKeys) {
                const pInfo = prev[key];
                const nInfo = mergedChatInfo[key];
                if (!nInfo || pInfo.isGroup !== nInfo.isGroup || pInfo.title !== nInfo.title) {
                  same = false;
                  break;
                }
              }
              if (same) return prev;
            }
            return mergedChatInfo;
          });
        }

        // Build a name map from fresh data and update any stale cached entries
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
        const cached = loadCachedMessages();
        if (cached.length > 0) {
          setMessages(cached);
          messageIdsRef.current = new Set(cached.map(m => m.id));
          setIsFromCache(true);
        } else {
          setMessages([]);
          messageIdsRef.current = new Set();
        }
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [accountIds]); // Don't include hiddenChatIdsString - we filter client-side

  const loadMore = useCallback(() => {
    if (hasMore && nextCursor && !isLoadingMore) {
      fetchMessages(nextCursor);
    }
  }, [hasMore, nextCursor, isLoadingMore, fetchMessages]);

  // Manual refetch (shows loading indicator)
  const refetch = useCallback(() => {
    fetchMessages(null, false);
  }, [fetchMessages]);

  // Background poll (no loading indicator, silent update)
  const poll = useCallback(() => {
    fetchMessages(null, true);
  }, [fetchMessages]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Convert hiddenChatIds Set to a stable string for memoization
  const hiddenChatIdsKey = hiddenChatIds ? Array.from(hiddenChatIds).sort().join(',') : '';

  // Memoize filtered messages - these only recompute when messages actually change
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
    poll,
    isFromCache,
    avatars,
    chatInfo,
  };
}
