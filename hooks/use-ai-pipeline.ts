/**
 * React hook for the unified AI pipeline.
 *
 * All components use this instead of directly calling fetch('/api/ai/...').
 * Wraps executeAiPipeline with convenient, type-safe methods.
 */

import { useCallback } from 'react';
import {
  executeAiPipeline,
  AiPipelineRequest,
  AiPipelineResponse,
  GoalAnalysis,
  ExtractedFact,
} from '@/lib/ai-pipeline';
import { mergeChatFacts, generateId } from '@/lib/storage';
import { ChatFact, ChatFactCategory, ChatFactSource, ChatFactEntity } from '@/lib/types';

export interface DraftOptions {
  agentId?: string;
  emojiOnlyResponse?: boolean;
  suggestClosing?: boolean;
  messagesInConversation?: number;
  detectGoalCompletion?: boolean;
  signal?: AbortSignal;
}

export interface DraftResult {
  text: string;
  suggestedMessages?: string[];
  isEmojiOnly?: boolean;
  goalAnalysis?: GoalAnalysis;
}

export interface BatchDraftItem {
  chatId: string;
  text: string;
  senderName: string;
}

export function useAiPipeline() {
  /**
   * Generate a draft reply to a message.
   * Used by: MessagePanel, DraftComposer, page.tsx drag-to-draft, AutopilotEngine
   */
  const generateDraft = useCallback(async (
    chatId: string,
    originalMessage: string,
    senderName: string,
    options?: DraftOptions,
  ): Promise<DraftResult> => {
    const result = await executeAiPipeline({
      intent: originalMessage ? 'draft-reply' : 'draft-proactive',
      chatId,
      originalMessage,
      senderName,
      agentId: options?.agentId,
      emojiOnlyResponse: options?.emojiOnlyResponse,
      suggestClosing: options?.suggestClosing,
      messagesInConversation: options?.messagesInConversation,
      detectGoalCompletion: options?.detectGoalCompletion,
      signal: options?.signal,
    });

    return {
      text: result.text,
      suggestedMessages: result.suggestedMessages,
      isEmojiOnly: result.isEmojiOnly,
      goalAnalysis: result.goalAnalysis,
    };
  }, []);

  /**
   * Generate drafts for multiple messages in sequence.
   * Used by: BatchDraftGenerator
   */
  const generateBatchDrafts = useCallback(async (
    messages: BatchDraftItem[],
    signal?: AbortSignal,
  ): Promise<Array<{ chatId: string; draft: string | null }>> => {
    const results: Array<{ chatId: string; draft: string | null }> = [];

    for (const msg of messages) {
      if (signal?.aborted) break;

      try {
        const result = await executeAiPipeline({
          intent: 'draft-reply',
          chatId: msg.chatId,
          originalMessage: msg.text,
          senderName: msg.senderName,
          signal,
        });
        results.push({ chatId: msg.chatId, draft: result.text || null });
      } catch (error) {
        if (signal?.aborted) break;
        results.push({ chatId: msg.chatId, draft: null });
      }

      // Rate limiting delay between batch items
      if (!signal?.aborted) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }, []);

  /**
   * Send a message in the interactive AI chat sidebar.
   * Used by: AiChatPanel
   */
  const sendChatMessage = useCallback(async (
    chatId: string,
    senderName: string,
    userMessage: string,
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<string> => {
    const result = await executeAiPipeline({
      intent: 'interactive-chat',
      chatId,
      senderName,
      userMessage,
      chatHistory,
    });

    return result.text;
  }, []);

  /**
   * Generate a conversation summary for handoff.
   * Used by: AutopilotEngine (when goal completed or handoff triggered)
   */
  const generateSummary = useCallback(async (
    chatId: string,
    senderName: string,
    agentId: string,
  ): Promise<AiPipelineResponse> => {
    return executeAiPipeline({
      intent: 'conversation-summary',
      chatId,
      senderName,
      agentId,
    });
  }, []);

  /**
   * Extract knowledge/facts from a conversation and persist to storage.
   * Returns the pipeline response with extracted facts.
   */
  const extractKnowledge = useCallback(async (
    chatId: string,
    senderName: string,
    threadContext?: string,
  ): Promise<AiPipelineResponse> => {
    const result = await executeAiPipeline({
      intent: 'knowledge-extract',
      chatId,
      senderName,
      rawThreadContext: threadContext,
    });

    // Persist extracted facts to storage
    if (result.extractedFacts && result.extractedFacts.length > 0) {
      const chatFacts: ChatFact[] = result.extractedFacts.map(f => ({
        id: generateId(),
        category: f.category as ChatFactCategory,
        content: f.content,
        confidence: f.confidence,
        source: f.source as ChatFactSource,
        aboutEntity: (f.aboutEntity || 'contact') as ChatFactEntity,
        firstObserved: new Date().toISOString(),
        lastObserved: new Date().toISOString(),
        mentions: 1,
      }));

      mergeChatFacts(chatId, chatFacts, {
        conversationTone: result.conversationTone,
        primaryLanguage: result.primaryLanguage,
        topicHistory: result.topicHistory,
        relationshipType: result.relationshipType,
      });
    }

    return result;
  }, []);

  return {
    generateDraft,
    generateBatchDrafts,
    sendChatMessage,
    generateSummary,
    extractKnowledge,
  };
}
