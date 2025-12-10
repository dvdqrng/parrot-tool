'use client';

import { useState, useEffect, useCallback } from 'react';
import { BeeperMessage } from '@/lib/types';
import { loadSettings, loadCachedMessages, saveCachedMessages, loadCachedAvatars, mergeCachedAvatars, loadCachedChatInfo, mergeCachedChatInfo } from '@/lib/storage';

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
          // Replace messages and save to cache
          const newMessages = result.data || [];
          setMessages(newMessages);
          saveCachedMessages(newMessages);
          setIsFromCache(false);
        }
        // Merge new avatars with cached ones
        if (result.avatars && Object.keys(result.avatars).length > 0) {
          const mergedAvatars = mergeCachedAvatars(result.avatars);
          setAvatars(mergedAvatars);
        }
        // Merge new chat info with cached ones
        if (result.chatInfo && Object.keys(result.chatInfo).length > 0) {
          const mergedChatInfo = mergeCachedChatInfo(result.chatInfo);
          setChatInfo(mergedChatInfo);
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

  // Filter helpers - also filter out hidden chats for immediate UI feedback
  const unreadMessages = messages.filter(m => {
    const isHidden = hiddenChatIds && hiddenChatIds.has(m.chatId);
    return !m.isRead && !m.isFromMe && !isHidden;
  });
  const sentMessages = messages.filter(m => m.isFromMe);

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
