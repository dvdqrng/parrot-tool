'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useSettings } from '@/hooks/use-settings';
import { AppSettings } from '@/lib/types';

interface SettingsContextValue {
  settings: AppSettings;
  isLoaded: boolean;
  updateSettings: (updates: Partial<AppSettings>) => void;
  toggleAccount: (accountId: string) => void;
  selectAllAccounts: (accountIds: string[]) => void;
  deselectAllAccounts: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settingsState = useSettings();

  return (
    <SettingsContext.Provider value={settingsState}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
}
