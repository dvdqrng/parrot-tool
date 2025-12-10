'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '@/lib/types';
import { loadSettings, saveSettings } from '@/lib/storage';

// Get initial settings synchronously to avoid flash of empty state
function getInitialSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return { selectedAccountIds: [] };
  }
  return loadSettings();
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getInitialSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Re-load in case initial load missed anything
    const stored = loadSettings();
    setSettings(stored);
    setIsLoaded(true);
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const toggleAccount = useCallback((accountId: string) => {
    setSettings(prev => {
      const isSelected = prev.selectedAccountIds.includes(accountId);
      const newSelectedIds = isSelected
        ? prev.selectedAccountIds.filter(id => id !== accountId)
        : [...prev.selectedAccountIds, accountId];

      const newSettings = { ...prev, selectedAccountIds: newSelectedIds };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const selectAllAccounts = useCallback((accountIds: string[]) => {
    setSettings(prev => {
      const newSettings = { ...prev, selectedAccountIds: accountIds };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const deselectAllAccounts = useCallback(() => {
    setSettings(prev => {
      const newSettings = { ...prev, selectedAccountIds: [] };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  return {
    settings,
    isLoaded,
    updateSettings,
    toggleAccount,
    selectAllAccounts,
    deselectAllAccounts,
  };
}
