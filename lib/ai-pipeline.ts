/**
 * Unified AI Pipeline
 *
 * Single entry point for ALL AI features in the app.
 * Handles context loading, request building, API routing, and response parsing.
 *
 * Callers declare WHAT they want (intent), and the pipeline figures out HOW.
 */

import {
  AiProvider,
  ToneSettings,
  WritingStylePatterns,
  AppSettings,
  AutopilotAgent,
} from './types';
import {
  loadSettings,
  loadToneSettings,
  loadWritingStylePatterns,
  getThreadContext,
  formatThreadContextForPrompt,
  getAiChatForThread,
  formatAiChatSummaryForPrompt,
  getAutopilotAgentById,
  getCrmContactByChatId,
  getChatKnowledge,
  formatKnowledgeForPrompt,
} from './storage';
import { getEffectiveAiProvider, getAIHeaders } from './api-headers';
import { logger } from './logger';

// ============================================
// TYPES
// ============================================

export type AiIntent =
  | 'draft-reply'
  | 'draft-proactive'
  | 'interactive-chat'
  | 'conversation-summary'
  | 'knowledge-extract';

export interface AiPipelineRequest {
  intent: AiIntent;
  chatId: string;
  senderName: string;

  // For draft-reply: the message to reply to
  originalMessage?: string;

  // For interactive-chat: multi-turn conversation
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage?: string;

  // Agent override (autopilot uses this)
  agentId?: string;

  // Autopilot behavior modifiers
  emojiOnlyResponse?: boolean;
  suggestClosing?: boolean;
  messagesInConversation?: number;
  detectGoalCompletion?: boolean;

  // Override thread context (for deep history loading -- pass raw message text
  // instead of loading from localStorage which is capped at 100 messages)
  rawThreadContext?: string;

  // Abort signal for cancellation
  signal?: AbortSignal;
}

export interface GoalAnalysis {
  isGoalAchieved: boolean;
  confidence: number;
  reasoning: string;
}

export interface ExtractedFact {
  category: string;
  content: string;
  confidence: number;
  source: 'observed' | 'stated' | 'inferred';
}

export interface AiPipelineResponse {
  text: string;
  // Draft-specific
  suggestedMessages?: string[];
  isEmojiOnly?: boolean;
  // Goal detection
  goalAnalysis?: GoalAnalysis;
  // Summary-specific
  summary?: string;
  keyPoints?: string[];
  suggestedNextSteps?: string[];
  goalStatus?: 'achieved' | 'in-progress' | 'unclear';
  // Knowledge-specific
  extractedFacts?: ExtractedFact[];
  conversationTone?: string;
  primaryLanguage?: string;
  topicHistory?: string[];
  relationshipType?: string;
}

// ============================================
// INTERNAL CONTEXT TYPES
// ============================================

interface SharedContext {
  settings: AppSettings;
  toneSettings: ToneSettings;
  writingStyle: WritingStylePatterns | undefined;
  provider: AiProvider;
  providerConfig: {
    ollamaModel?: string;
    ollamaBaseUrl?: string;
  };
  headers: HeadersInit;
}

interface ChatContext {
  threadContext: string;
  aiChatSummary: string;
  knowledgeContext: string;
}

interface AgentContext {
  agent: AutopilotAgent;
  systemPrompt: string;
  goal: string;
}

// ============================================
// CONTEXT LOADERS
// ============================================

function loadSharedContext(): SharedContext {
  const settings = loadSettings();
  const toneSettings = loadToneSettings();
  const rawWritingStyle = loadWritingStylePatterns();

  // Only use writing style if we actually have sample messages
  const writingStyle = rawWritingStyle.sampleMessages.length > 0
    ? rawWritingStyle
    : undefined;

  const provider = getEffectiveAiProvider(settings);
  const headers = getAIHeaders(settings);

  return {
    settings,
    toneSettings,
    writingStyle,
    provider,
    providerConfig: {
      ollamaModel: settings.ollamaModel,
      ollamaBaseUrl: settings.ollamaBaseUrl,
    },
    headers,
  };
}

function loadChatContext(chatId: string): ChatContext {
  const threadCtx = getThreadContext(chatId);
  const threadContext = formatThreadContextForPrompt(threadCtx);

  const aiChatHistory = getAiChatForThread(chatId);
  const aiChatSummary = formatAiChatSummaryForPrompt(aiChatHistory);

  const knowledge = getChatKnowledge(chatId);
  const knowledgeContext = formatKnowledgeForPrompt(knowledge);

  return {
    threadContext,
    aiChatSummary,
    knowledgeContext,
  };
}

function loadAgentContext(agentId: string): AgentContext | null {
  const agent = getAutopilotAgentById(agentId);
  if (!agent) return null;

  return {
    agent,
    systemPrompt: agent.systemPrompt,
    goal: agent.goal,
  };
}

// ============================================
// REQUEST BUILDERS
// ============================================

function buildDraftRequest(
  request: AiPipelineRequest,
  shared: SharedContext,
  chat: ChatContext,
  agent: AgentContext | null,
): { apiRoute: string; body: Record<string, unknown> } {
  return {
    apiRoute: '/api/ai/draft',
    body: {
      originalMessage: request.originalMessage || '',
      senderName: request.senderName,
      toneSettings: shared.toneSettings,
      writingStyle: shared.writingStyle,
      threadContext: chat.threadContext,
      aiChatSummary: chat.aiChatSummary,
      knowledgeContext: chat.knowledgeContext || undefined,
      // Agent features
      agentSystemPrompt: agent?.systemPrompt,
      agentGoal: agent?.goal,
      detectGoalCompletion: request.detectGoalCompletion ?? false,
      // Human-like behaviors
      emojiOnlyResponse: request.emojiOnlyResponse ?? false,
      suggestClosing: request.suggestClosing ?? false,
      messagesInConversation: request.messagesInConversation ?? 0,
      // Provider
      provider: shared.provider,
      ollamaModel: shared.providerConfig.ollamaModel,
      ollamaBaseUrl: shared.providerConfig.ollamaBaseUrl,
    },
  };
}

function buildChatRequest(
  request: AiPipelineRequest,
  shared: SharedContext,
  chat: ChatContext,
): { apiRoute: string; body: Record<string, unknown> } {
  return {
    apiRoute: '/api/ai/chat',
    body: {
      messageContext: chat.threadContext,
      senderName: request.senderName,
      chatHistory: request.chatHistory || [],
      userMessage: request.userMessage || '',
      knowledgeContext: chat.knowledgeContext || undefined,
      // Provider
      provider: shared.provider,
      ollamaModel: shared.providerConfig.ollamaModel,
      ollamaBaseUrl: shared.providerConfig.ollamaBaseUrl,
    },
  };
}

function buildSummaryRequest(
  request: AiPipelineRequest,
  shared: SharedContext,
  chat: ChatContext,
  agent: AgentContext | null,
): { apiRoute: string; body: Record<string, unknown> } {
  return {
    apiRoute: '/api/ai/conversation-summary',
    body: {
      threadContext: chat.threadContext,
      agentGoal: agent?.goal || '',
      senderName: request.senderName,
      // Provider
      provider: shared.provider,
      ollamaModel: shared.providerConfig.ollamaModel,
      ollamaBaseUrl: shared.providerConfig.ollamaBaseUrl,
    },
  };
}

function buildApiRequest(
  request: AiPipelineRequest,
  shared: SharedContext,
  chat: ChatContext,
  agent: AgentContext | null,
): { apiRoute: string; body: Record<string, unknown> } {
  switch (request.intent) {
    case 'draft-reply':
    case 'draft-proactive':
      return buildDraftRequest(request, shared, chat, agent);

    case 'interactive-chat':
      return buildChatRequest(request, shared, chat);

    case 'conversation-summary':
      return buildSummaryRequest(request, shared, chat, agent);

    case 'knowledge-extract':
      return {
        apiRoute: '/api/ai/knowledge-extract',
        body: {
          threadContext: chat.threadContext,
          senderName: request.senderName,
          existingKnowledge: chat.knowledgeContext || undefined,
          provider: shared.provider,
          ollamaModel: shared.providerConfig.ollamaModel,
          ollamaBaseUrl: shared.providerConfig.ollamaBaseUrl,
        },
      };

    default:
      throw new Error(`Unknown AI intent: ${request.intent}`);
  }
}

// ============================================
// RESPONSE PARSERS
// ============================================

function parseDraftResponse(data: Record<string, unknown>): AiPipelineResponse {
  const inner = data.data as Record<string, unknown> | undefined;
  if (!inner) {
    throw new Error('Invalid draft response: missing data');
  }

  return {
    text: (inner.suggestedReply as string) || '',
    suggestedMessages: inner.suggestedMessages as string[] | undefined,
    isEmojiOnly: inner.isEmojiOnly as boolean | undefined,
    goalAnalysis: inner.goalAnalysis as GoalAnalysis | undefined,
  };
}

function parseChatResponse(data: Record<string, unknown>): AiPipelineResponse {
  const inner = data.data as Record<string, unknown> | undefined;
  if (!inner) {
    throw new Error('Invalid chat response: missing data');
  }

  return {
    text: (inner.response as string) || '',
  };
}

function parseSummaryResponse(data: Record<string, unknown>): AiPipelineResponse {
  const inner = data.data as Record<string, unknown> | undefined;
  if (!inner) {
    throw new Error('Invalid summary response: missing data');
  }

  return {
    text: (inner.summary as string) || '',
    summary: inner.summary as string | undefined,
    keyPoints: inner.keyPoints as string[] | undefined,
    suggestedNextSteps: inner.suggestedNextSteps as string[] | undefined,
    goalStatus: inner.goalStatus as 'achieved' | 'in-progress' | 'unclear' | undefined,
  };
}

function parseKnowledgeResponse(data: Record<string, unknown>): AiPipelineResponse {
  const inner = data.data as Record<string, unknown> | undefined;
  if (!inner) {
    return { text: '', extractedFacts: [] };
  }

  return {
    text: '',
    extractedFacts: (inner.facts as ExtractedFact[]) || [],
    conversationTone: inner.conversationTone as string | undefined,
    primaryLanguage: inner.primaryLanguage as string | undefined,
    topicHistory: inner.topicHistory as string[] | undefined,
    relationshipType: inner.relationshipType as string | undefined,
  };
}

function parseResponse(
  intent: AiIntent,
  data: Record<string, unknown>,
): AiPipelineResponse {
  switch (intent) {
    case 'draft-reply':
    case 'draft-proactive':
      return parseDraftResponse(data);

    case 'interactive-chat':
      return parseChatResponse(data);

    case 'conversation-summary':
      return parseSummaryResponse(data);

    case 'knowledge-extract':
      return parseKnowledgeResponse(data);

    default:
      return { text: '' };
  }
}

// ============================================
// MAIN PIPELINE
// ============================================

/**
 * Execute the unified AI pipeline.
 *
 * All AI features in the app call this single function.
 * It loads all context automatically, routes to the correct API,
 * and returns a normalized response.
 */
export async function executeAiPipeline(
  request: AiPipelineRequest,
): Promise<AiPipelineResponse> {
  // 1. Load shared context (settings, tone, writing style, provider)
  const shared = loadSharedContext();

  // 2. Load per-chat context (thread history, AI chat summary)
  const chat = loadChatContext(request.chatId);

  // Override thread context if raw text provided (used by deep history loader)
  if (request.rawThreadContext) {
    chat.threadContext = request.rawThreadContext;
  }

  // 3. Load agent config if applicable
  const agent = request.agentId
    ? loadAgentContext(request.agentId)
    : null;

  // 4. Build the API request based on intent
  const { apiRoute, body } = buildApiRequest(request, shared, chat, agent);

  logger.debug('[AI Pipeline] Executing:', {
    intent: request.intent,
    chatId: request.chatId,
    apiRoute,
    hasAgent: !!agent,
    hasThreadContext: !!chat.threadContext,
    hasAiChatSummary: !!chat.aiChatSummary,
  });

  // 5. Call the API
  const response = await fetch(apiRoute, {
    method: 'POST',
    headers: shared.headers,
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = (errorData as Record<string, unknown>)?.error || `API error: ${response.status}`;
    throw new Error(String(errorMessage));
  }

  const data = await response.json() as Record<string, unknown>;

  // 6. Check for API-level errors
  if (data.error) {
    throw new Error(String(data.error));
  }

  // 7. Parse and normalize the response
  return parseResponse(request.intent, data);
}
