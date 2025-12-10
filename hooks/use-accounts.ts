'use client';

import { useState, useEffect, useCallback } from 'react';
import { BeeperAccount } from '@/lib/types';
import { loadSettings, loadCachedAccounts, saveCachedAccounts } from '@/lib/storage';

export function useAccounts() {
  const [accounts, setAccounts] = useState<BeeperAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // Load cached accounts on mount
  useEffect(() => {
    const cached = loadCachedAccounts();
    if (cached.length > 0) {
      setAccounts(cached);
      setIsFromCache(true);
      setIsLoading(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    // Only show loading if we don't have cached data
    const cached = loadCachedAccounts();
    if (cached.length === 0) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const settings = loadSettings();
      const headers: HeadersInit = {};
      if (settings.beeperAccessToken) {
        headers['x-beeper-token'] = settings.beeperAccessToken;
      }

      const response = await fetch('/api/beeper/accounts', { headers });
      const result = await response.json();

      if (result.error) {
        setError(result.error);
        // Keep cached accounts on error if we have them
        if (cached.length > 0) {
          setAccounts(cached);
          setIsFromCache(true);
        } else {
          setAccounts([]);
        }
      } else {
        const newAccounts = result.data || [];
        setAccounts(newAccounts);
        saveCachedAccounts(newAccounts);
        setIsFromCache(false);
      }
    } catch (err) {
      setError('Failed to connect to Beeper Desktop');
      // Keep cached accounts on error if we have them
      if (cached.length > 0) {
        setAccounts(cached);
        setIsFromCache(true);
      } else {
        setAccounts([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    isLoading,
    error,
    refetch: fetchAccounts,
    isFromCache,
  };
}
