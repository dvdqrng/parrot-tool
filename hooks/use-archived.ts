'use client';

import { useState, useEffect, useCallback } from 'react';
import { BeeperMessage } from '@/lib/types';
import { loadSettings } from '@/lib/storage';

export function useArchived(accountIds: string[], enabled: boolean = false) {
  const [archivedMessages, setArchivedMessages] = useState<BeeperMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [chatInfo, setChatInfo] = useState<Record<string, { isGroup: boolean; title?: string }>>({});

  const fetchArchived = useCallback(async () => {
    if (!enabled || accountIds.length === 0) {
      setArchivedMessages([]);
      return;
    }

    setIsLoading(true);
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

      const response = await fetch(`/api/beeper/archived?${params}`, { headers });
      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setArchivedMessages([]);
      } else {
        setArchivedMessages(result.data || []);
        if (result.avatars) {
          setAvatars(prev => ({ ...prev, ...result.avatars }));
        }
        if (result.chatInfo) {
          setChatInfo(prev => ({ ...prev, ...result.chatInfo }));
        }
      }
    } catch {
      setError('Failed to fetch archived chats');
      setArchivedMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [accountIds, enabled]);

  const refetch = useCallback(() => {
    fetchArchived();
  }, [fetchArchived]);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  return {
    archivedMessages,
    isLoading,
    error,
    refetch,
    avatars,
    chatInfo,
  };
}
