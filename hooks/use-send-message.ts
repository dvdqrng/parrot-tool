'use client';

import { useCallback } from 'react';
import { useSettingsContext } from '@/contexts/settings-context';
import { getBeeperHeaders } from '@/lib/api-headers';
import { POLLING_INTERVALS } from '@/lib/constants';
import { logger } from '@/lib/logger';

interface UseSendMessageOptions {
  /** Callback after successful send */
  onSuccess?: (chatId: string) => void;
  /** Callback after send error */
  onError?: (chatId: string, error: Error) => void;
  /** Auto-refresh messages after sending (default: true) */
  autoRefresh?: boolean;
  /** Refresh function to call after send */
  refetch?: () => void;
}

interface SendMessageResult {
  success: boolean;
  error?: string;
}

/**
 * Consolidated hook for sending messages via Beeper API
 * Replaces duplicate send logic throughout the app
 */
export function useSendMessage(options: UseSendMessageOptions = {}) {
  const { settings } = useSettingsContext();
  const {
    onSuccess,
    onError,
    autoRefresh = true,
    refetch,
  } = options;

  const sendMessage = useCallback(async (
    chatId: string,
    text: string
  ): Promise<SendMessageResult> => {
    try {
      logger.debug('Sending message', { chatId, textLength: text.length });

      const headers = getBeeperHeaders(settings.beeperAccessToken);

      const response = await fetch('/api/beeper/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({ chatId, text }),
      });

      const result = await response.json();

      if (result.error) {
        const error = new Error(result.error);
        logger.error('Failed to send message', { chatId, error: result.error });
        onError?.(chatId, error);
        return { success: false, error: result.error };
      }

      logger.info('Message sent successfully', { chatId });
      onSuccess?.(chatId);

      // Auto-refresh messages after a short delay if enabled
      if (autoRefresh && refetch) {
        setTimeout(refetch, POLLING_INTERVALS.REFRESH_DELAY);
      }

      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error sending message');
      logger.error('Exception sending message', err);
      onError?.(chatId, err);
      return { success: false, error: err.message };
    }
  }, [settings.beeperAccessToken, onSuccess, onError, autoRefresh, refetch]);

  return { sendMessage };
}
