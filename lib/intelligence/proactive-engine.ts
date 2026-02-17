/**
 * Proactive Intelligence Engine
 *
 * Monitors conversation context and triggers proactive AI behaviors:
 * - Auto-suggests drafts when new messages arrive
 * - Surfaces relevant insights about contacts
 * - Detects action items and reminders
 * - Provides ambient context without being asked
 */

import { getApiKey, getActiveProvider, hasApiKey } from '@/lib/intelligence-settings';

// ============================================
// TYPES
// ============================================

export type ProactiveTrigger =
  | 'panel_opened'           // User opened the companion panel
  | 'new_message_received'   // New message from contact
  | 'context_changed'        // Switched to different chat
  | 'idle_detected'          // User idle on a chat needing response
  | 'draft_started'          // User started typing a draft
  | 'action_item_detected'   // Message contains an action item
  | 'scheduled_check';       // Periodic ambient check

export interface ProactiveContext {
  chatId: string;
  contactName?: string;
  platform?: string;
  recentMessages: Array<{
    id: string;
    text: string;
    isFromMe: boolean;
    timestamp: string;
    senderName?: string;
  }>;
  draftText?: string;
  lastInteractionAt?: string;
  unreadCount?: number;
}

export interface ProactiveAction {
  type: 'insight' | 'draft_suggestion' | 'reminder' | 'context' | 'action_item';
  priority: 'high' | 'medium' | 'low';
  content: string;
  metadata?: {
    draftText?: string;
    actionType?: string;
    dueDate?: string;
    confidence?: number;
  };
}

export interface ProactiveEngineConfig {
  enabled: boolean;
  autoSuggestDrafts: boolean;
  surfaceInsights: boolean;
  detectActionItems: boolean;
  idleTimeoutMs: number;
  minMessageThreshold: number;
}

// ============================================
// DEFAULT CONFIG
// ============================================

export const defaultProactiveConfig: ProactiveEngineConfig = {
  enabled: true,
  autoSuggestDrafts: true,
  surfaceInsights: true,
  detectActionItems: true,
  idleTimeoutMs: 30000, // 30 seconds
  minMessageThreshold: 1, // At least 1 message to trigger
};

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze if a new message warrants a proactive draft suggestion
 */
export function shouldSuggestDraft(context: ProactiveContext): boolean {
  const { recentMessages, draftText } = context;

  // Don't suggest if user already has a draft
  if (draftText && draftText.trim().length > 0) {
    return false;
  }

  // Need at least one message
  if (recentMessages.length === 0) {
    return false;
  }

  // Check if last message is from contact (not from user)
  const lastMessage = recentMessages[recentMessages.length - 1];
  if (lastMessage.isFromMe) {
    return false;
  }

  // Check if message seems to need a response (question, request, etc.)
  const text = lastMessage.text.toLowerCase();
  const needsResponse =
    text.includes('?') ||
    text.includes('can you') ||
    text.includes('could you') ||
    text.includes('would you') ||
    text.includes('let me know') ||
    text.includes('what do you think') ||
    text.includes('thoughts?') ||
    text.includes('please') ||
    text.includes('asap') ||
    text.includes('urgent');

  return needsResponse;
}

/**
 * Detect if message contains action items
 */
export function detectActionItems(text: string): string[] {
  const actionPatterns = [
    /(?:remind me to|don't forget to|make sure to|need to|have to|should|must)\s+(.+?)(?:\.|$)/gi,
    /(?:by|before|until)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)/gi,
    /(?:deadline|due|meeting|call|appointment)\s+(?:is\s+)?(?:on\s+)?(.+?)(?:\.|$)/gi,
  ];

  const items: string[] = [];

  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        items.push(match[1].trim());
      }
    }
  }

  return items;
}

/**
 * Determine what proactive action to take based on trigger and context
 */
export function determineProactiveAction(
  trigger: ProactiveTrigger,
  context: ProactiveContext,
  config: ProactiveEngineConfig = defaultProactiveConfig
): ProactiveAction | null {
  if (!config.enabled) return null;

  switch (trigger) {
    case 'panel_opened':
      // When panel opens, surface context about the contact
      if (config.surfaceInsights && context.recentMessages.length > 0) {
        return {
          type: 'context',
          priority: 'medium',
          content: 'Analyzing conversation...',
        };
      }
      break;

    case 'new_message_received':
      // Check if we should suggest a draft
      if (config.autoSuggestDrafts && shouldSuggestDraft(context)) {
        return {
          type: 'draft_suggestion',
          priority: 'high',
          content: 'Would you like me to help draft a reply?',
        };
      }

      // Check for action items in the new message
      if (config.detectActionItems) {
        const lastMsg = context.recentMessages[context.recentMessages.length - 1];
        if (lastMsg && !lastMsg.isFromMe) {
          const items = detectActionItems(lastMsg.text);
          if (items.length > 0) {
            return {
              type: 'action_item',
              priority: 'high',
              content: `I noticed an action item: "${items[0]}"`,
              metadata: { actionType: 'reminder' },
            };
          }
        }
      }
      break;

    case 'idle_detected':
      // User has been looking at an unanswered message
      if (shouldSuggestDraft(context)) {
        return {
          type: 'draft_suggestion',
          priority: 'medium',
          content: 'This message might need a response. Want me to help?',
        };
      }
      break;

    case 'context_changed':
      // Switched to a new chat - surface relevant info
      if (config.surfaceInsights) {
        return {
          type: 'insight',
          priority: 'low',
          content: 'Loading context...',
        };
      }
      break;
  }

  return null;
}

// ============================================
// API CALLS FOR PROACTIVE RESPONSES
// ============================================

export async function generateProactiveInsight(
  context: ProactiveContext
): Promise<string | null> {
  if (!hasApiKey()) return null;

  try {
    const provider = getActiveProvider();
    const apiKey = getApiKey();

    const response = await fetch('/api/intelligence/companion/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey,
        chatId: context.chatId,
        contactName: context.contactName,
        platform: context.platform,
        recentMessages: context.recentMessages.slice(-10),
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.content || null;
  } catch (error) {
    console.error('[ProactiveEngine] Failed to generate insight:', error);
    return null;
  }
}

export async function generateProactiveDraft(
  context: ProactiveContext
): Promise<string | null> {
  if (!hasApiKey()) return null;

  try {
    const provider = getActiveProvider();
    const apiKey = getApiKey();

    const response = await fetch('/api/intelligence/companion/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey,
        chatId: context.chatId,
        contactName: context.contactName,
        platform: context.platform,
        recentMessages: context.recentMessages.slice(-10),
        draftText: context.draftText,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.metadata?.draftText || null;
  } catch (error) {
    console.error('[ProactiveEngine] Failed to generate draft:', error);
    return null;
  }
}

export async function analyzeConversationContext(
  context: ProactiveContext
): Promise<{
  summary?: string;
  mood?: string;
  urgency?: 'high' | 'medium' | 'low';
  suggestedAction?: string;
} | null> {
  console.log('[ProactiveEngine] analyzeConversationContext called', {
    chatId: context.chatId,
    messageCount: context.recentMessages.length,
    hasApiKey: hasApiKey(),
  });

  if (!hasApiKey()) {
    console.log('[ProactiveEngine] No API key, returning null');
    return null;
  }

  try {
    const provider = getActiveProvider();
    const apiKey = getApiKey();
    console.log('[ProactiveEngine] Making API call to /api/intelligence/companion/chat');

    const response = await fetch('/api/intelligence/companion/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        apiKey,
        chatId: context.chatId,
        contactName: context.contactName,
        platform: context.platform,
        recentMessages: context.recentMessages.slice(-15),
        message: `Analyze this conversation briefly. Return a JSON object with:
- summary: 1 sentence summary of what's being discussed
- mood: the emotional tone (friendly, urgent, casual, formal, tense)
- urgency: how quickly a response is needed (high, medium, low)
- suggestedAction: what the user should do next (e.g., "respond to question", "follow up on request", "no action needed")

Return ONLY the JSON, no markdown.`,
        conversationHistory: [],
      }),
    });

    if (!response.ok) {
      console.log('[ProactiveEngine] API returned error status:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[ProactiveEngine] API response received:', data);

    // Try to parse the JSON response
    try {
      const content = data.content || '';
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      console.log('[ProactiveEngine] Parsed analysis:', parsed);
      return parsed;
    } catch (parseError) {
      console.log('[ProactiveEngine] Failed to parse response as JSON:', data.content);
      return null;
    }
  } catch (error) {
    console.error('[ProactiveEngine] Failed to analyze context:', error);
    return null;
  }
}
