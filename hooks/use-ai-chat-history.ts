'use client';

import { useState, useEffect, useCallback } from 'react';
import { AiChatMessage, getAiChatForThread, saveAiChatForThread } from '@/lib/storage';

export function useAiChatHistory(chatId: string | null) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);

  // Load messages from storage
  const loadMessages = useCallback(() => {
    if (chatId) {
      const stored = getAiChatForThread(chatId);
      setMessages(stored);
    } else {
      setMessages([]);
    }
  }, [chatId]);

  // Load messages when chatId changes
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Listen for external AI chat updates (e.g., from autopilot suggest mode)
  useEffect(() => {
    if (!chatId) return;

    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.chatId === chatId) {
        loadMessages();
      }
    };

    window.addEventListener('ai-chat-updated', handleUpdate);
    return () => window.removeEventListener('ai-chat-updated', handleUpdate);
  }, [chatId, loadMessages]);

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
