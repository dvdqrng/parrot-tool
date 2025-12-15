'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChatAutopilotConfig,
  AutopilotMode,
  AutopilotStatus,
  GoalCompletionBehavior,
} from '@/lib/types';
import {
  getChatAutopilotConfig,
  saveChatAutopilotConfig,
  deleteChatAutopilotConfig,
  cancelActionsForChat,
  generateId,
} from '@/lib/storage';

interface UseChatAutopilotOptions {
  onStatusChange?: (status: AutopilotStatus) => void;
}

export function useChatAutopilot(chatId: string | null, options?: UseChatAutopilotOptions) {
  const [config, setConfig] = useState<ChatAutopilotConfig | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load config when chatId changes
  useEffect(() => {
    if (!chatId) {
      setConfig(null);
      setIsLoaded(true);
      return;
    }

    const loaded = getChatAutopilotConfig(chatId);
    setConfig(loaded);
    setIsLoaded(true);
  }, [chatId]);

  // Check if self-driving has expired
  const isExpired = useMemo(() => {
    if (!config?.selfDrivingExpiresAt) return false;
    return new Date() > new Date(config.selfDrivingExpiresAt);
  }, [config?.selfDrivingExpiresAt]);

  // Calculate time remaining for self-driving mode
  const timeRemaining = useMemo(() => {
    if (!config?.selfDrivingExpiresAt) return null;
    const remaining = new Date(config.selfDrivingExpiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }, [config?.selfDrivingExpiresAt]);

  // Enable autopilot for this chat
  const enable = useCallback((
    agentId: string,
    mode: AutopilotMode,
    durationMinutes?: number
  ) => {
    if (!chatId) return;

    const now = new Date().toISOString();
    let expiresAt: string | undefined;

    if (mode === 'self-driving' && durationMinutes) {
      expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    }

    const newConfig: ChatAutopilotConfig = {
      chatId,
      enabled: true,
      agentId,
      mode,
      status: 'active',
      selfDrivingDurationMinutes: durationMinutes,
      selfDrivingStartedAt: mode === 'self-driving' ? now : undefined,
      selfDrivingExpiresAt: expiresAt,
      messagesHandled: 0,
      errorCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    saveChatAutopilotConfig(newConfig);
    setConfig(newConfig);
    options?.onStatusChange?.('active');
  }, [chatId, options]);

  // Disable autopilot
  const disable = useCallback(() => {
    if (!chatId || !config) return;

    // Cancel any pending actions
    cancelActionsForChat(chatId);

    const updated: ChatAutopilotConfig = {
      ...config,
      enabled: false,
      status: 'inactive',
      updatedAt: new Date().toISOString(),
    };

    saveChatAutopilotConfig(updated);
    setConfig(updated);
    options?.onStatusChange?.('inactive');
  }, [chatId, config, options]);

  // Pause autopilot
  const pause = useCallback(() => {
    if (!chatId || !config) return;

    const updated: ChatAutopilotConfig = {
      ...config,
      status: 'paused',
      updatedAt: new Date().toISOString(),
    };

    saveChatAutopilotConfig(updated);
    setConfig(updated);
    options?.onStatusChange?.('paused');
  }, [chatId, config, options]);

  // Resume autopilot
  const resume = useCallback(() => {
    if (!chatId || !config) return;

    // If self-driving was expired, don't allow resume
    if (config.mode === 'self-driving' && isExpired) {
      return;
    }

    const updated: ChatAutopilotConfig = {
      ...config,
      status: 'active',
      updatedAt: new Date().toISOString(),
    };

    saveChatAutopilotConfig(updated);
    setConfig(updated);
    options?.onStatusChange?.('active');
  }, [chatId, config, isExpired, options]);

  // Change mode
  const setMode = useCallback((mode: AutopilotMode, durationMinutes?: number) => {
    if (!chatId || !config) return;

    const now = new Date().toISOString();
    let expiresAt: string | undefined;

    if (mode === 'self-driving' && durationMinutes) {
      expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    }

    const updated: ChatAutopilotConfig = {
      ...config,
      mode,
      selfDrivingDurationMinutes: durationMinutes,
      selfDrivingStartedAt: mode === 'self-driving' ? now : undefined,
      selfDrivingExpiresAt: expiresAt,
      updatedAt: now,
    };

    saveChatAutopilotConfig(updated);
    setConfig(updated);
  }, [chatId, config]);

  // Change agent
  const setAgent = useCallback((agentId: string) => {
    if (!chatId || !config) return;

    const updated: ChatAutopilotConfig = {
      ...config,
      agentId,
      updatedAt: new Date().toISOString(),
    };

    saveChatAutopilotConfig(updated);
    setConfig(updated);
  }, [chatId, config]);

  // Set self-driving duration
  const setSelfDrivingDuration = useCallback((minutes: number) => {
    if (!chatId || !config || config.mode !== 'self-driving') return;

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    const updated: ChatAutopilotConfig = {
      ...config,
      selfDrivingDurationMinutes: minutes,
      selfDrivingStartedAt: now,
      selfDrivingExpiresAt: expiresAt,
      updatedAt: now,
    };

    saveChatAutopilotConfig(updated);
    setConfig(updated);
  }, [chatId, config]);

  // Set goal completion behavior override
  const setGoalCompletionOverride = useCallback((behavior: GoalCompletionBehavior | undefined) => {
    if (!chatId || !config) return;

    const updated: ChatAutopilotConfig = {
      ...config,
      goalCompletionBehaviorOverride: behavior,
      updatedAt: new Date().toISOString(),
    };

    saveChatAutopilotConfig(updated);
    setConfig(updated);
  }, [chatId, config]);

  // Update status (used by engine)
  const updateStatus = useCallback((status: AutopilotStatus, error?: string) => {
    if (!chatId || !config) return;

    const updated: ChatAutopilotConfig = {
      ...config,
      status,
      lastError: error,
      errorCount: status === 'error' ? config.errorCount + 1 : config.errorCount,
      updatedAt: new Date().toISOString(),
    };

    saveChatAutopilotConfig(updated);
    setConfig(updated);
    options?.onStatusChange?.(status);
  }, [chatId, config, options]);

  // Increment messages handled
  const incrementMessagesHandled = useCallback(() => {
    if (!chatId || !config) return;

    const updated: ChatAutopilotConfig = {
      ...config,
      messagesHandled: config.messagesHandled + 1,
      lastActivityAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveChatAutopilotConfig(updated);
    setConfig(updated);
  }, [chatId, config]);

  // Remove config entirely
  const remove = useCallback(() => {
    if (!chatId) return;
    deleteChatAutopilotConfig(chatId);
    setConfig(null);
  }, [chatId]);

  // Sync from storage
  const sync = useCallback(() => {
    if (!chatId) return;
    const loaded = getChatAutopilotConfig(chatId);
    setConfig(loaded);
  }, [chatId]);

  return {
    config,
    isLoaded,
    isEnabled: config?.enabled ?? false,
    status: config?.status ?? 'inactive',
    isExpired,
    timeRemaining,

    // Actions
    enable,
    disable,
    pause,
    resume,
    setMode,
    setAgent,
    setSelfDrivingDuration,
    setGoalCompletionOverride,
    updateStatus,
    incrementMessagesHandled,
    remove,
    sync,
  };
}
