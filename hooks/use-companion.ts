'use client';

/**
 * useCompanion Hook
 *
 * A PROACTIVE AI Companion that:
 * - Has separate "enabled" (background running) and "panel open" (UI visible) states
 * - Automatically analyzes context when enabled
 * - Suggests drafts when new messages arrive
 * - Surfaces insights without being asked
 * - Monitors the conversation in the background
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { CompanionMessage, CompanionSuggestion } from '@/components/intelligence/ai-companion-panel';
import { ContactIntelligence } from '@/lib/intelligence/knowledge/types';
import {
  getApiKey,
  getActiveProvider,
  hasApiKey,
} from '@/lib/intelligence-settings';
import {
  ProactiveContext,
  shouldSuggestDraft,
  detectActionItems,
  generateProactiveDraft,
} from '@/lib/intelligence/proactive-engine';
import { aiLog } from '@/lib/intelligence/activity-log';
import {
  initializeCache,
  getCachedState,
  setCachedState,
  setAiEnabled,
  subscribeToEnabledChanges,
  type CompanionChatState,
} from '@/lib/intelligence/companion-state-store';
import { eventBus, emitCompanionOpened } from '@/lib/intelligence/event-bus';
import { getOrchestrator } from '@/lib/intelligence/agents/orchestrator';
import { getConversationAgent } from '@/lib/intelligence/agents/dynamic/conversation-agent';
import { contactStore, soulStore, userStateStore } from '@/lib/intelligence/knowledge/store';
import { UserSoul } from '@/lib/intelligence/user-state/soul';
import { UserIntelligence } from '@/lib/intelligence/user-state/types';
import { projectContext } from '@/lib/intelligence/context-projection';
import { useGlobalAttention } from '@/hooks/use-global-attention';

// ============================================
// TYPES
// ============================================

interface UseCompanionOptions {
  chatId: string | null;
  contactName?: string;
  platform?: string;
  recentMessages?: Array<{
    id: string;
    text: string;
    isFromMe: boolean;
    timestamp: string;
    senderName?: string;
  }>;
  draftText?: string;
  onApplyDraft?: (draft: string) => void;
}

interface UseCompanionReturn {
  // State
  isEnabled: boolean;      // AI is running in background for this chat
  isPanelOpen: boolean;    // AI panel is visible
  messages: CompanionMessage[];
  isLoading: boolean;
  isThinking: boolean;
  hasActivity: boolean;
  contactIntelligence: ContactIntelligence | null;
  error: string | null;

  // Actions
  enable: () => void;      // Turn AI on for this chat
  disable: () => void;     // Turn AI off for this chat
  toggleEnabled: () => void;
  openPanel: () => void;   // Show the AI panel
  closePanel: () => void;  // Hide the AI panel
  togglePanel: () => void;
  sendMessage: (content: string) => Promise<void>;
  applyDraft: (draft: string) => void;
  dismissInsight: (messageId: string) => void;
  clearMessages: () => void;
  clearError: () => void;

  // Proactive features
  requestDraft: () => Promise<void>;
  requestSummary: () => Promise<void>;
  requestInsights: () => Promise<void>;
}

// ============================================
// HOOK
// ============================================

export function useCompanion({
  chatId,
  contactName,
  platform,
  recentMessages = [],
  draftText,
  onApplyDraft,
}: UseCompanionOptions): UseCompanionReturn {
  // State - separated enabled (background) from panel open (UI)
  const [isEnabled, setIsEnabled] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);
  const [contactIntelligence, setContactIntelligence] =
    useState<ContactIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs for tracking state changes
  const lastChatIdRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const hasRunInitialAnalysisRef = useRef<boolean>(false);
  const isAnalyzingRef = useRef<boolean>(false);

  // Attention scores (from global heartbeat scan)
  const { scores: attentionScores } = useGlobalAttention();

  // Soul + user state refs (loaded once, cached)
  const soulRef = useRef<UserSoul | null>(null);
  const userStateRef = useRef<UserIntelligence | null>(null);

  // Initialize the persistent cache + load soul/user state on mount
  useEffect(() => {
    initializeCache().then(async () => {
      // Load soul and user state from IndexedDB (cached in refs for all API calls)
      try {
        const [soul, userState] = await Promise.all([
          soulStore.get(),
          userStateStore.get(),
        ]);
        soulRef.current = soul;
        userStateRef.current = userState || null;
        console.log('[Companion] Soul loaded:', {
          hasName: !!soul?.name,
          name: soul?.name || '(empty)',
          hasBio: !!soul?.bio,
          toneKeywords: soul?.toneKeywords?.length || 0,
          alwaysDo: soul?.alwaysDo?.length || 0,
          neverDo: soul?.neverDo?.length || 0,
          formality: soul?.defaultFormality || 'unset',
          hasCustomPrompt: !!soul?.customSystemPrompt,
        });
        console.log('[Companion] User state loaded:', {
          activeContexts: userState?.activeContexts?.length || 0,
          activeTopics: userState?.activeTopics?.length || 0,
          distributedInfo: userState?.distributedInfo?.length || 0,
          communicationMode: userState?.communicationMode || 'unknown',
        });
      } catch (e) {
        console.error('[Companion] Failed to load soul/user state:', e);
      }
      setIsInitialized(true);
    });
  }, []);

  // Refresh cached soul when background extraction updates it
  useEffect(() => {
    const unsubscribe = eventBus.on('soul_updated', async () => {
      try {
        const updatedSoul = await soulStore.get();
        soulRef.current = updatedSoul;
        console.log('[Companion] Soul auto-refreshed after extraction:', {
          activeTraits: updatedSoul?.extractedTraits?.filter(t => t.isActive)?.length || 0,
          hasName: !!updatedSoul?.name,
        });
      } catch (e) {
        console.error('[Companion] Failed to refresh soul after extraction:', e);
      }
    });
    return unsubscribe;
  }, []);

  // Subscribe to global enabled state changes
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = subscribeToEnabledChanges((changedChatId, enabled) => {
      if (changedChatId === chatId) {
        setIsEnabled(enabled);
      }
    });

    return unsubscribe;
  }, [chatId]);

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  const addMessage = useCallback(
    (message: Omit<CompanionMessage, 'id' | 'timestamp'>) => {
      const newMessage: CompanionMessage = {
        ...message,
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);
      setHasActivity(true);
      return newMessage;
    },
    []
  );

  // ============================================
  // PROACTIVE CONTEXT
  // ============================================

  const getProactiveContext = useCallback((): ProactiveContext => {
    return {
      chatId: chatId || '',
      contactName,
      platform,
      recentMessages,
      draftText,
    };
  }, [chatId, contactName, platform, recentMessages, draftText]);

  // ============================================
  // LANGUAGE DETECTION
  // ============================================

  /**
   * Detect the dominant language from recent messages.
   * Uses word-frequency heuristics on padded text to avoid regex boundary issues.
   */
  const detectedLanguage = (() => {
    if (recentMessages.length === 0) return undefined;
    // Sample up to 15 non-empty messages
    const sample = recentMessages
      .filter(m => m.text && m.text.trim().length > 3)
      .slice(-15)
      .map(m => m.text);
    if (sample.length === 0) return undefined;
    // Pad with spaces so we can use simple ` word ` matching (handles start/end of string)
    const combined = ` ${sample.join(' ').toLowerCase()} `;

    // Count occurrences of function words using space-delimited matching
    // This avoids regex \b issues with non-ASCII characters
    const countWords = (words: string[]) => {
      let total = 0;
      for (const w of words) {
        // Check for the word surrounded by spaces, punctuation, or common delimiters
        const patterns = [` ${w} `, ` ${w},`, ` ${w}.`, ` ${w}!`, ` ${w}?`, ` ${w}\n`, `\n${w} `];
        for (const p of patterns) {
          if (combined.includes(p)) { total++; break; }
        }
      }
      return total;
    };

    const germanWords = [
      'ich', 'und', 'der', 'die', 'das', 'ist', 'nicht', 'ein', 'eine', 'mit',
      'auf', 'auch', 'noch', 'hab', 'habe', 'wir', 'aber', 'schon', 'dann',
      'wenn', 'jetzt', 'hier', 'mir', 'dir', 'mich', 'dich', 'für', 'über',
      'kann', 'bin', 'bis', 'mal', 'grad', 'gerade', 'oder', 'weil', 'dass',
      'war', 'hat', 'wie', 'nur', 'mein', 'dein', 'kein', 'keine', 'ja', 'nein',
      'ok', 'gut', 'ganz', 'sehr', 'halt', 'eben', 'morgen', 'heute', 'gleich',
    ];
    const spanishWords = [
      'que', 'por', 'para', 'con', 'una', 'los', 'las', 'del', 'esta', 'pero',
      'como', 'más', 'todo', 'bien', 'tiene', 'hay', 'esto', 'ese', 'eso',
      'muy', 'también', 'ahora', 'cuando', 'porque', 'donde', 'puede', 'otro',
    ];
    const frenchWords = [
      'que', 'les', 'des', 'une', 'est', 'pas', 'pour', 'dans', 'qui', 'sur',
      'avec', 'sont', 'mais', 'aussi', 'plus', 'cette', 'fait', 'bien', 'tout',
      'très', 'peut', 'quand', 'comme', 'ici', 'donc', 'encore', 'alors',
    ];
    const dutchWords = [
      'het', 'een', 'van', 'dat', 'niet', 'ook', 'wel', 'maar', 'voor', 'nog',
      'met', 'zijn', 'naar', 'hebben', 'deze', 'die', 'dan', 'toen', 'werd',
    ];

    const scores: [string, number][] = [
      ['German', countWords(germanWords)],
      ['Spanish', countWords(spanishWords)],
      ['French', countWords(frenchWords)],
      ['Dutch', countWords(dutchWords)],
    ];
    const best = scores.sort((a, b) => b[1] - a[1])[0];
    // If at least 2 function words match, call it that language
    const result = best[1] >= 2 ? best[0] : 'English';
    console.log('[Companion] Language detection:', { result, scores: scores.map(s => `${s[0]}:${s[1]}`), sampleSize: sample.length });
    return result;
  })();

  // ============================================
  // API CALLS
  // ============================================

  const callCompanionApi = useCallback(
    async (
      endpoint: 'chat' | 'draft' | 'insights',
      payload: Record<string, unknown>
    ): Promise<{ content: string; metadata?: Record<string, unknown> } | null> => {
      // Determine which agent is making this call
      const agentType = endpoint === 'draft' ? 'drafter' : endpoint === 'insights' ? 'analyzer' : 'companion';

      try {
        if (!hasApiKey()) {
          aiLog.error('companion', 'No API key configured', chatId || undefined);
          return {
            content:
              "I need an API key to help you. Please add your API key in Settings → Intelligence.",
            metadata: { type: 'system' },
          };
        }

        const provider = getActiveProvider();
        const apiKey = getApiKey();

        // Log the API call
        aiLog.apiCall(agentType, `/api/intelligence/companion/${endpoint}`, chatId || undefined, {
          provider,
          messageCount: recentMessages.length,
          hasContactIntelligence: !!contactIntelligence,
        });

        // Run context projection to select relevant facts
        const projectionInput = contactIntelligence?.facts ? {
          recentMessages: recentMessages.slice(-3).map(m => ({
            text: m.text,
            isFromMe: m.isFromMe,
          })),
          userIntent: (payload as Record<string, unknown>).intent as string | undefined,
          contactFacts: contactIntelligence.facts,
          userState: userStateRef.current,
          chatId: chatId || undefined,
        } : null;

        console.log('[Companion] Context projection input:', {
          hasFacts: !!contactIntelligence?.facts,
          totalFacts: contactIntelligence?.facts?.length || 0,
          recentMsgCount: recentMessages.slice(-3).length,
          recentMsgPreview: recentMessages.slice(-3).map(m => m.text.slice(0, 40)),
          hasUserState: !!userStateRef.current,
          userIntent: (payload as Record<string, unknown>).intent || '(none)',
        });

        const projected = projectionInput ? projectContext(projectionInput) : null;

        if (projected) {
          console.log('[Companion] Context projection result:', {
            selectedFacts: projected.relevantFacts.length,
            factDetails: projected.relevantFacts.map(f => ({
              content: f.content.slice(0, 50),
              category: f.category,
            })),
            scoring: projected.scoring.slice(0, 5).map(s => ({
              score: s.score.toFixed(2),
              reason: s.reason,
            })),
            relevantContexts: projected.relevantContexts.length,
          });
        } else {
          console.log('[Companion] Context projection: skipped (no facts available)');
        }

        const startTime = Date.now();
        const response = await fetch(`/api/intelligence/companion/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            apiKey,
            chatId,
            contactName,
            platform,
            contactIntelligence,
            soul: soulRef.current,
            projectedFacts: projected?.relevantFacts.map(f => ({
              content: f.content,
              category: f.category,
            })),
            // Send projected user state (filtered contexts + distributed info) if available
            userState: projected && userStateRef.current
              ? {
                  ...userStateRef.current,
                  activeContexts: projected.relevantContexts,
                  distributedInfo: projected.relevantDistributedInfo,
                }
              : userStateRef.current,
            // Attention context for this chat (from global heartbeat scan)
            attentionContext: (() => {
              const attn = chatId ? attentionScores.find(s => s.chatId === chatId) : undefined;
              return attn ? { score: attn.score, urgency: attn.urgency, reason: attn.reason } : undefined;
            })(),
            recentMessages: recentMessages.slice(-20),
            draftText,
            chatLanguage: detectedLanguage,
            ...payload,
          }),
        });
        const duration = Date.now() - startTime;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          aiLog.error(agentType, `API returned ${response.status}`, chatId || undefined, { errorData });
          if (response.status === 401) {
            return {
              content:
                'Your API key appears to be invalid. Please check it in Settings → Intelligence.',
              metadata: { type: 'system' },
            };
          }
          throw new Error(
            errorData.error || `Request failed with status ${response.status}`
          );
        }

        const result = await response.json();

        // Log the successful response
        aiLog.apiResponse(agentType, `/api/intelligence/companion/${endpoint}`, duration, chatId || undefined, {
          type: result.metadata?.type,
          contentLength: result.content?.length || 0,
          hasDraft: !!result.metadata?.draftText,
        });

        // Log specific outcomes
        if (result.metadata?.type === 'draft' && result.metadata?.draftText) {
          aiLog.draft(`Generated: "${result.metadata.draftText.slice(0, 50)}..."`, chatId || '', contactName);
        } else if (result.metadata?.type === 'insight') {
          aiLog.insight(result.content?.slice(0, 100) || 'Insight generated', chatId || undefined, contactName);
        }

        return result;
      } catch (err) {
        console.error(`[Companion] ${endpoint} API error:`, err);
        aiLog.error(agentType, `${endpoint} failed: ${err instanceof Error ? err.message : 'Unknown'}`, chatId || undefined);
        setError(err instanceof Error ? err.message : 'Failed to connect to AI');
        return null;
      }
    },
    [chatId, contactName, platform, contactIntelligence, recentMessages, draftText, attentionScores]
  );

  // ============================================
  // PROACTIVE BEHAVIORS
  // ============================================

  /**
   * Parse structured suggestions from LLM response.
   * Extracts the text before ---SUGGESTIONS--- and parses each suggestion line.
   */
  const parseSuggestionsFromResponse = useCallback((content: string): {
    text: string;
    suggestions: CompanionSuggestion[];
  } => {
    const suggestionsStart = content.indexOf('---SUGGESTIONS---');
    const suggestionsEnd = content.indexOf('---END---');

    if (suggestionsStart === -1) {
      return { text: content.trim(), suggestions: [] };
    }

    const text = content.slice(0, suggestionsStart).trim();
    const suggestionsBlock = suggestionsEnd !== -1
      ? content.slice(suggestionsStart + '---SUGGESTIONS---'.length, suggestionsEnd)
      : content.slice(suggestionsStart + '---SUGGESTIONS---'.length);

    const suggestions: CompanionSuggestion[] = [];
    const lines = suggestionsBlock.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      const match = line.match(/^\[(\w+)\]\s+(.+)$/);
      if (!match) continue;

      const [, typeStr, rest] = match;
      const id = `sug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (typeStr === 'draft') {
        suggestions.push({
          id,
          label: rest,
          type: 'draft',
          prompt: rest,
        });
      } else if (typeStr === 'share_link') {
        const pipeIdx = rest.indexOf('|');
        if (pipeIdx !== -1) {
          const label = rest.slice(0, pipeIdx).trim();
          const url = rest.slice(pipeIdx + 1).trim();
          suggestions.push({
            id,
            label,
            type: 'share_link',
            payload: url,
          });
        } else {
          suggestions.push({
            id,
            label: rest,
            type: 'share_link',
            prompt: rest,
          });
        }
      } else if (typeStr === 'send_message') {
        const msgText = rest.startsWith('Send:') ? rest.slice(5).trim() : rest;
        suggestions.push({
          id,
          label: msgText.length > 60 ? msgText.slice(0, 57) + '...' : msgText,
          type: 'send_message',
          payload: msgText,
        });
      } else {
        suggestions.push({
          id,
          label: rest,
          type: 'custom',
          prompt: rest,
        });
      }
    }

    return { text, suggestions };
  }, []);

  /**
   * Run initial analysis when AI is enabled.
   * Uses callCompanionApi so the LLM gets full intelligence context
   * (soul, contact facts, user state, attention, distributed info, etc.)
   */
  const runInitialAnalysis = useCallback(async () => {
    if (!chatId || isAnalyzingRef.current || !hasApiKey()) {
      return;
    }
    if (recentMessages.length === 0) {
      aiLog.thought('companion', `AI enabled for ${contactName || 'contact'} but no messages loaded yet`, chatId);
      return;
    }

    isAnalyzingRef.current = true;
    setIsThinking(true);

    aiLog.thought('companion', `AI enabled for ${contactName || 'contact'}. Starting analysis...`, chatId, { messageCount: recentMessages.length });

    try {
      // Log what we're observing
      const lastMsg = recentMessages[recentMessages.length - 1];
      if (lastMsg && !lastMsg.isFromMe) {
        aiLog.observation('analyzer', `Last message from ${contactName || 'contact'}: "${lastMsg.text.slice(0, 50)}..."`, chatId);
      }

      // Add a thinking message
      addMessage({
        role: 'assistant',
        content: `Analyzing your conversation with ${contactName || 'this contact'}...`,
        type: 'chat',
      });

      // Build an analysis prompt that asks for a proactive response with actionable suggestions
      const lastIsFromContact = lastMsg && !lastMsg.isFromMe;
      const langNote = detectedLanguage && detectedLanguage !== 'English'
        ? `\n\nIMPORTANT: This conversation is in ${detectedLanguage}. Write your summary AND all suggestion labels in ${detectedLanguage}. Only the [tag] markers should stay in English.`
        : '';
      const analysisPrompt = lastIsFromContact
        ? `Look at my recent conversation with ${contactName || 'this contact'}. Their last message may need a reply. Give me a brief summary of what's happening (2-3 sentences max).

Then list 2-4 specific actions I can take, formatted exactly like this:
---SUGGESTIONS---
[draft] Draft a reply about <specific topic>
[draft] Suggest a <specific thing, e.g. restaurant, plan>
[share_link] Share <description> | <actual URL if available>
[send_message] Send: <exact message text>
---END---

Be specific — reference actual content from the conversation and any known context (links, places, facts). Only include share_link if there's an actual URL available in the context.${langNote}`
        : `Look at my recent conversation with ${contactName || 'this contact'}. Summarize what's happening (2-3 sentences max).

Then list 2-4 specific actions I can take, formatted exactly like this:
---SUGGESTIONS---
[draft] Draft a message about <specific topic>
[draft] Follow up on <specific thing>
[share_link] Share <description> | <actual URL if available>
[send_message] Send: <exact message text>
---END---

Be specific — reference actual content from the conversation and any known context (links, places, facts). Only include share_link if there's an actual URL available in the context.${langNote}`;

      // Use callCompanionApi so the LLM gets full intelligence context
      const response = await callCompanionApi('chat', {
        message: analysisPrompt,
        conversationHistory: [],
      });

      if (response?.content) {
        // Parse suggestions from the structured section
        const { text, suggestions } = parseSuggestionsFromResponse(response.content);

        aiLog.insight(text, chatId, contactName);

        setMessages((prev) => {
          const withoutThinking = prev.slice(0, -1);
          return [
            ...withoutThinking,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant' as const,
              content: text,
              timestamp: new Date().toISOString(),
              type: 'insight' as const,
              metadata: suggestions.length > 0 ? { suggestions } : undefined,
            },
          ];
        });
      } else {
        aiLog.thought('companion', 'Analysis returned no content, using fallback', chatId);
        setMessages((prev) => {
          const withoutThinking = prev.slice(0, -1);
          return [
            ...withoutThinking,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant' as const,
              content: `I'm ready to help with ${contactName || 'this conversation'}. Ask me anything!`,
              timestamp: new Date().toISOString(),
              type: 'chat' as const,
            },
          ];
        });
      }
    } catch (err) {
      aiLog.error('companion', `Initial analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`, chatId);
      setMessages((prev) => {
        const withoutThinking = prev.slice(0, -1);
        return [
          ...withoutThinking,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant' as const,
            content: `I'm ready to help with ${contactName || 'this conversation'}. Ask me anything!`,
            timestamp: new Date().toISOString(),
            type: 'chat' as const,
          },
        ];
      });
    } finally {
      setIsThinking(false);
      isAnalyzingRef.current = false;
    }
  }, [chatId, contactName, recentMessages, addMessage, callCompanionApi]);

  /**
   * React to new messages from contact (runs in background when enabled)
   */
  const handleNewMessage = useCallback(async () => {
    if (!isEnabled || !chatId || !hasApiKey()) return;
    if (recentMessages.length === 0) return;

    const lastMessage = recentMessages[recentMessages.length - 1];
    if (lastMessage.isFromMe) return;

    aiLog.observation('proactive', `New message from ${contactName || 'contact'}: "${lastMessage.text.slice(0, 50)}..."`, chatId);

    // Check for action items
    const actionItems = detectActionItems(lastMessage.text);
    if (actionItems.length > 0) {
      aiLog.thought('analyzer', `Detected action items: ${actionItems.join(', ')}`, chatId);
      aiLog.action('proactive', `Flagging action item: "${actionItems[0]}"`, chatId);
      addMessage({
        role: 'assistant',
        content: `📌 I noticed an action item: "${actionItems[0]}"`,
        type: 'action',
        metadata: { actionType: 'reminder' },
      });
    }

    // Check if message needs a response
    const context = getProactiveContext();
    if (shouldSuggestDraft(context)) {
      aiLog.decision('proactive', 'Message appears to need a response - generating draft', chatId);
      setIsThinking(true);

      aiLog.thought('drafter', 'Composing contextual reply...', chatId);
      const startTime = Date.now();
      const draft = await generateProactiveDraft(context);
      const duration = Date.now() - startTime;
      aiLog.apiResponse('drafter', '/api/intelligence/companion/draft', duration, chatId);

      setIsThinking(false);

      if (draft) {
        aiLog.draft(`Generated draft: "${draft.slice(0, 50)}..."`, chatId, contactName);
        addMessage({
          role: 'assistant',
          content: "Here's a suggested reply:",
          type: 'draft',
          metadata: {
            draftText: draft,
            confidence: 0.8,
          },
        });
      }
    }
  }, [isEnabled, chatId, contactName, recentMessages, addMessage, getProactiveContext]);

  // ============================================
  // EFFECTS
  // ============================================

  // Save state to persistent store (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!chatId || !isInitialized) return;

    // Only save if we have meaningful state
    if (!isEnabled && messages.length === 0) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const state: CompanionChatState = {
        chatId,
        enabled: isEnabled,
        messages: messages,
        hasRunInitialAnalysis: hasRunInitialAnalysisRef.current,
        hasActivity: hasActivity,
        updatedAt: new Date().toISOString(),
      };
      setCachedState(state);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [chatId, isEnabled, messages, hasActivity, isInitialized]);

  // Restore state when switching chats
  useEffect(() => {
    if (!chatId || !isInitialized) {
      if (!chatId) setContactIntelligence(null);
      return;
    }

    if (chatId !== lastChatIdRef.current) {
      lastChatIdRef.current = chatId;
      lastMessageCountRef.current = recentMessages.length;
      isAnalyzingRef.current = false;
      setIsThinking(false);
      setError(null);

      // Restore state for this chat
      const savedState = getCachedState(chatId);
      if (savedState) {
        setIsEnabled(savedState.enabled);
        setMessages(savedState.messages as CompanionMessage[]);
        setHasActivity(savedState.hasActivity);
        // Don't restore hasRunInitialAnalysis - re-analyze on revisit
        hasRunInitialAnalysisRef.current = false;
      } else {
        setIsEnabled(false);
        setMessages([]);
        hasRunInitialAnalysisRef.current = false;
        setHasActivity(false);
      }

      // Always close panel when switching chats
      setIsPanelOpen(false);

      // Load ContactIntelligence from IndexedDB for this chat
      contactStore.getByChatId(chatId).then((intel) => {
        if (intel) {
          setContactIntelligence(intel);
          aiLog.thought('companion', `Loaded intelligence for ${intel.displayName}: ${intel.facts?.length || 0} facts`, chatId);
        } else {
          setContactIntelligence(null);
        }
      }).catch((err) => {
        console.error('Failed to load contact intelligence:', err);
        setContactIntelligence(null);
      });
    }
  }, [chatId, recentMessages.length, isInitialized]);

  // Store runInitialAnalysis in ref to avoid effect dependency issues
  const runInitialAnalysisRef = useRef(runInitialAnalysis);
  runInitialAnalysisRef.current = runInitialAnalysis;

  // Run analysis automatically when a chat is selected and has messages.
  // Auto-enables AI so the companion is always proactive.
  useEffect(() => {
    // Must have: initialized, chatId, API key, and messages
    if (!isInitialized || !chatId || !hasApiKey()) {
      return;
    }

    // Wait for messages to load before running analysis
    if (recentMessages.length === 0) {
      return;
    }

    // Only run once per chat session
    if (hasRunInitialAnalysisRef.current) {
      return;
    }

    hasRunInitialAnalysisRef.current = true;

    // Auto-enable AI for this chat if not already enabled
    if (!isEnabled) {
      setAiEnabled(chatId, true, contactName, platform);
      setIsEnabled(true);
      emitCompanionOpened(chatId, contactName, platform);
    }

    // Small delay to ensure messages are fully loaded
    const timer = setTimeout(() => {
      runInitialAnalysisRef.current();
    }, 500);
    return () => clearTimeout(timer);
  }, [isEnabled, chatId, isInitialized, recentMessages.length, contactName, platform]);

  // React to new messages (when enabled)
  useEffect(() => {
    if (isEnabled && recentMessages.length > lastMessageCountRef.current) {
      lastMessageCountRef.current = recentMessages.length;
      handleNewMessage();
    }
  }, [isEnabled, recentMessages.length, handleNewMessage]);

  // ============================================
  // USER ACTIONS
  // ============================================

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Log user message
      aiLog.observation('companion', `User asked: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`, chatId || undefined);
      aiLog.thought('companion', 'Processing user request...', chatId || undefined);

      setError(null);
      addMessage({ role: 'user', content });
      setIsLoading(true);
      setIsThinking(true);

      try {
        const response = await callCompanionApi('chat', {
          message: content,
          conversationHistory: messages,
        });

        if (response) {
          aiLog.decision('companion', `Responding with ${response.metadata?.type || 'chat'} message`, chatId || undefined);
          addMessage({
            role: 'assistant',
            content: response.content,
            type: response.metadata?.type as CompanionMessage['type'],
            metadata: response.metadata as CompanionMessage['metadata'],
          });
        } else if (!error) {
          addMessage({
            role: 'assistant',
            content: "I'm sorry, I couldn't process that request. Please try again.",
          });
        }
      } catch (err) {
        console.error('[Companion] Send message error:', err);
        addMessage({
          role: 'assistant',
          content: "I'm having trouble connecting. Please try again in a moment.",
        });
      } finally {
        setIsLoading(false);
        setIsThinking(false);
      }
    },
    [isLoading, messages, addMessage, callCompanionApi, error, chatId]
  );

  // ============================================
  // PROACTIVE FEATURE ACTIONS
  // ============================================

  const requestDraft = useCallback(async () => {
    if (!chatId) return;

    aiLog.action('drafter', `User requested draft for ${contactName || 'contact'}`, chatId);
    aiLog.thought('drafter', 'Routing through orchestrator to conversation agent...', chatId);

    // Emit event for tracking
    eventBus.emit({ type: 'draft_requested', chatId, intent: undefined });

    setError(null);
    setIsLoading(true);
    setIsThinking(true);

    try {
      // FIXED: Route through agent architecture instead of direct API call
      const orchestrator = getOrchestrator();

      // 1. Route to or spawn a conversation agent through the orchestrator
      aiLog.thought('orchestrator', `Routing draft request for ${contactName || 'contact'}`, chatId);
      const agent = await orchestrator.route({
        type: 'conversation',
        contextId: chatId,
        platform: platform || 'unknown',
        priority: 'normal',
        payload: { intent: 'draft_reply' },
      });

      aiLog.thought('orchestrator', `Routed to agent ${agent.id} (${agent.lifecycle})`, chatId);

      // 2. Get the conversation agent instance
      const conversationAgent = getConversationAgent(chatId, chatId, platform || 'unknown');

      // 3. Convert recent messages to BeeperMessage format for the agent
      const beeperMessages = recentMessages.map((m, idx) => ({
        id: m.id || `msg-${idx}`,
        chatId: chatId,
        text: m.text,
        isFromMe: m.isFromMe,
        timestamp: m.timestamp,
        platform: platform || 'unknown',
        senderName: m.senderName,
      }));

      // 4. Use the conversation agent to draft a reply
      // This coordinates KnowledgeAgent, StyleAgent, and UserStateAgent
      aiLog.thought('conversation_agent', 'Building draft context from knowledge, style, and user state...', chatId);
      const result = await conversationAgent.draftReply(beeperMessages as any);

      if (result && result.draft) {
        aiLog.decision('drafter', 'Draft generated successfully via agent architecture', chatId, {
          confidence: result.confidence,
          draftLength: result.draft.length,
          usedDistributedInfo: result.context.relevantDistributedInfo.length > 0,
        });

        // Build context message
        let contextMessage = "Here's a suggested reply";
        if (result.context.relevantDistributedInfo.length > 0) {
          contextMessage += " (using context from your other conversations)";
        }
        contextMessage += ":";

        addMessage({
          role: 'assistant',
          content: contextMessage,
          type: 'draft',
          metadata: {
            draftText: result.draft,
            confidence: result.confidence,
            reasoning: result.reasoning,
          },
        });
      } else {
        // Fallback to direct API call if agent returns no draft
        aiLog.thought('drafter', 'Agent returned no draft, falling back to direct API...', chatId);
        const response = await callCompanionApi('draft', {});

        if (response && response.metadata?.draftText) {
          addMessage({
            role: 'assistant',
            content: response.content,
            type: 'draft',
            metadata: {
              draftText: response.metadata.draftText as string,
              confidence: response.metadata.confidence as number,
            },
          });
        } else {
          addMessage({
            role: 'assistant',
            content:
              "I couldn't generate a draft. Could you tell me more about what you'd like to say?",
          });
        }
      }
    } catch (err) {
      console.error('[Companion] Request draft error:', err);
      aiLog.error('drafter', `Draft generation failed: ${err instanceof Error ? err.message : 'Unknown'}`, chatId);
      addMessage({
        role: 'assistant',
        content: "I'm having trouble generating a draft. Please try again.",
      });
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  }, [chatId, contactName, platform, recentMessages, callCompanionApi, addMessage]);

  const requestSummary = useCallback(async () => {
    aiLog.action('analyzer', `User requested summary for ${contactName || 'conversation'}`, chatId || undefined);
    aiLog.thought('analyzer', 'Analyzing conversation to generate summary...', chatId || undefined);

    setError(null);
    setIsLoading(true);
    setIsThinking(true);

    try {
      const response = await callCompanionApi('chat', {
        message: 'Summarize this conversation',
        conversationHistory: [],
      });

      if (response) {
        aiLog.decision('analyzer', 'Summary generated', chatId || undefined);
        addMessage({
          role: 'assistant',
          content: response.content,
        });
      }
    } catch (err) {
      console.error('[Companion] Request summary error:', err);
      addMessage({
        role: 'assistant',
        content: "I couldn't summarize the conversation. Please try again.",
      });
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  }, [callCompanionApi, addMessage, chatId, contactName]);

  const requestInsights = useCallback(async () => {
    aiLog.action('analyzer', `User requested insights for ${contactName || 'conversation'}`, chatId || undefined);
    aiLog.thought('analyzer', 'Analyzing conversation for insights and patterns...', chatId || undefined);

    setError(null);
    setIsLoading(true);
    setIsThinking(true);

    try {
      const response = await callCompanionApi('insights', {});

      if (response) {
        aiLog.decision('analyzer', 'Insights generated', chatId || undefined);
        addMessage({
          role: 'assistant',
          content: response.content,
          type: 'insight',
        });
      }
    } catch (err) {
      console.error('[Companion] Request insights error:', err);
      addMessage({
        role: 'assistant',
        content: "I couldn't generate insights right now. Please try again.",
      });
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  }, [callCompanionApi, addMessage]);

  // ============================================
  // PANEL & ENABLED CONTROLS
  // ============================================

  const enable = useCallback(() => {
    if (!chatId) return;
    setAiEnabled(chatId, true, contactName, platform); // Pass contact info for extraction
    setIsEnabled(true);
    setIsPanelOpen(true); // Auto-open panel when AI is enabled
    hasRunInitialAnalysisRef.current = false; // Reset so analysis runs
    // Emit event so background worker knows companion is open
    emitCompanionOpened(chatId, contactName, platform);
  }, [chatId, contactName, platform]);

  const disable = useCallback(() => {
    if (!chatId) return;
    setAiEnabled(chatId, false);
    setIsEnabled(false);
    setIsPanelOpen(false); // Close panel when disabling
  }, [chatId]);

  const toggleEnabled = useCallback(() => {
    if (isEnabled) {
      disable();
    } else {
      enable();
    }
  }, [isEnabled, enable, disable]);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
    // Emit event so background worker knows companion is open
    if (chatId) {
      emitCompanionOpened(chatId, contactName, platform);
    }
  }, [chatId, contactName, platform]);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    // Emit event so background worker knows companion is closed
    if (chatId) {
      eventBus.emit({ type: 'companion_closed', chatId });
    }
  }, [chatId]);

  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  const applyDraft = useCallback(
    (draft: string) => {
      onApplyDraft?.(draft);
      addMessage({
        role: 'system',
        content: '✓ Draft applied to message input',
      });
      // Emit event for tracking metrics
      if (chatId) {
        eventBus.emit({ type: 'draft_accepted', chatId, draft });
        aiLog.action('companion', 'Draft accepted by user', chatId);
      }
    },
    [onApplyDraft, addMessage, chatId]
  );

  const dismissInsight = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              content: '(Dismissed)',
              metadata: { ...m.metadata, dismissed: true },
            }
          : m
      )
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasActivity(false);
    setError(null);
    hasRunInitialAnalysisRef.current = false;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    isEnabled,
    isPanelOpen,
    messages,
    isLoading,
    isThinking,
    hasActivity,
    contactIntelligence,
    error,

    // Actions
    enable,
    disable,
    toggleEnabled,
    openPanel,
    closePanel,
    togglePanel,
    sendMessage,
    applyDraft,
    dismissInsight,
    clearMessages,
    clearError,

    // Proactive features
    requestDraft,
    requestSummary,
    requestInsights,
  };
}
