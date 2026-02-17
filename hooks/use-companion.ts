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
import { CompanionMessage } from '@/components/intelligence/ai-companion-panel';
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
  analyzeConversationContext,
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

  // Initialize the persistent cache on mount
  useEffect(() => {
    initializeCache().then(() => {
      setIsInitialized(true);
    });
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
  // PROACTIVE BEHAVIORS
  // ============================================

  /**
   * Run initial analysis when AI is enabled
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
      const context = getProactiveContext();

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

      aiLog.thought('analyzer', 'Analyzing conversation context, mood, urgency, and suggesting actions...', chatId);

      // Analyze conversation context
      const startTime = Date.now();
      const analysis = await analyzeConversationContext(context);
      const duration = Date.now() - startTime;

      if (analysis) {
        aiLog.apiResponse('analyzer', '/api/intelligence/companion/chat', duration, chatId, {
          summary: analysis.summary,
          mood: analysis.mood,
          urgency: analysis.urgency,
          suggestedAction: analysis.suggestedAction,
        });

        aiLog.decision('companion', `Conversation mood: ${analysis.mood || 'neutral'}, Urgency: ${analysis.urgency || 'low'}`, chatId);

        let greeting = '';

        if (analysis.summary) {
          greeting += analysis.summary;
        }

        if (analysis.urgency === 'high') {
          aiLog.thought('proactive', 'High urgency detected - will offer to draft a quick response', chatId);
          greeting += ' This seems urgent - want me to help draft a quick response?';
        } else if (analysis.suggestedAction && analysis.suggestedAction !== 'no action needed') {
          aiLog.thought('proactive', `Suggesting action: ${analysis.suggestedAction}`, chatId);
          greeting += ` I suggest: ${analysis.suggestedAction}.`;
        }

        if (greeting) {
          aiLog.insight(greeting, chatId, contactName);

          setMessages((prev) => {
            const withoutThinking = prev.slice(0, -1);
            return [
              ...withoutThinking,
              {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: greeting,
                timestamp: new Date().toISOString(),
                type: 'insight' as const,
                metadata: {
                  urgency: analysis.urgency,
                  mood: analysis.mood,
                },
              },
            ];
          });
        }

        // If there's an unanswered message, proactively offer to draft
        if (shouldSuggestDraft(context)) {
          aiLog.observation('proactive', 'Detected unanswered message that may need a response', chatId);
          setTimeout(() => {
            aiLog.action('proactive', 'Offering to draft a reply', chatId);
            addMessage({
              role: 'assistant',
              content:
                "I notice there's a message that might need a response. Would you like me to help draft a reply?",
              type: 'chat',
            });
          }, 1500);
        }
      } else {
        aiLog.thought('companion', 'Analysis returned no structured data, using fallback greeting', chatId);
        setMessages((prev) => {
          const withoutThinking = prev.slice(0, -1);
          return [
            ...withoutThinking,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: `I'm monitoring ${contactName || 'this conversation'}. I'll help when needed.`,
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
            role: 'assistant',
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
  }, [chatId, contactName, recentMessages, addMessage, getProactiveContext]);

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
    }
  }, [chatId, recentMessages.length, isInitialized]);

  // Store runInitialAnalysis in ref to avoid effect dependency issues
  const runInitialAnalysisRef = useRef(runInitialAnalysis);
  runInitialAnalysisRef.current = runInitialAnalysis;

  // Run analysis when AI becomes enabled (not when panel opens)
  useEffect(() => {
    // Must have: initialized, enabled, chatId, API key, and messages
    if (!isInitialized || !isEnabled || !chatId || !hasApiKey()) {
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

    // Small delay to ensure messages are fully loaded
    const timer = setTimeout(() => {
      runInitialAnalysisRef.current();
    }, 500);
    return () => clearTimeout(timer);
  }, [isEnabled, chatId, isInitialized, recentMessages.length]);

  // React to new messages (when enabled)
  useEffect(() => {
    if (isEnabled && recentMessages.length > lastMessageCountRef.current) {
      lastMessageCountRef.current = recentMessages.length;
      handleNewMessage();
    }
  }, [isEnabled, recentMessages.length, handleNewMessage]);

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
            recentMessages: recentMessages.slice(-20),
            draftText,
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
    [chatId, contactName, platform, contactIntelligence, recentMessages, draftText]
  );

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
    setAiEnabled(chatId, true);
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
