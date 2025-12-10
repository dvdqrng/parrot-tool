'use client';

import { useState, useEffect, useCallback } from 'react';
import { AiChatMessage, getAiChatForThread, saveAiChatForThread } from '@/lib/storage';

export function useAiChatHistory(chatId: string | null) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);

  // Load messages when chatId changes
  useEffect(() => {
    if (chatId) {
      const stored = getAiChatForThread(chatId);
      setMessages(stored);
    } else {
      setMessages([]);
    }
  }, [chatId]);

  // Update messages and persist to storage
  const updateMessages = useCallback((newMessages: AiChatMessage[]) => {
    setMessages(newMessages);
    if (chatId) {
      saveAiChatForThread(chatId, newMessages);
    }
  }, [chatId]);

  // Clear messages for current thread
  const clearMessages = useCallback(() => {
    setMessages([]);
    if (chatId) {
      saveAiChatForThread(chatId, []);
    }
  }, [chatId]);

  return {
    messages,
    setMessages: updateMessages,
    clearMessages,
  };
}
