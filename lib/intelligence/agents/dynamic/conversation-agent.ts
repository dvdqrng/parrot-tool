/**
 * Conversation Agent
 * Dynamic agent spawned per-contact-per-platform
 * Handles drafting and conversation-specific intelligence
 */

import { BeeperMessage } from '@/lib/types';
import { ContactIntelligence, RelationshipType } from '../../knowledge/types';
import { getKnowledgeAgent } from '../infrastructure/knowledge-agent';
import { getStyleAgent } from '../infrastructure/style-agent';
import { getUserStateAgent } from '../infrastructure/user-state-agent';
import { metrics } from '../../instrumentation/metrics';

// ============================================
// LOGGING
// ============================================

const LOG_PREFIX = '[ConversationAgent]';

function log(method: string, message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${method}: ${message}`, data !== undefined ? data : '');
}

function logError(method: string, message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ${method}: ${message}`, error);
}

// ============================================
// DRAFT CONTEXT
// ============================================

export interface DraftContext {
  // Contact info
  contact: ContactIntelligence | null;
  contactName: string;
  relationshipType: RelationshipType;

  // Style
  styleInstructions: string;

  // User state
  userContext: string;
  relevantDistributedInfo: string[];

  // Conversation
  recentMessages: Array<{
    isFromMe: boolean;
    text: string;
    timestamp: string;
  }>;

  // Platform
  platform: string;
  platformNorms: string;
}

export interface DraftResult {
  draft: string;
  confidence: number;
  context: DraftContext;
  reasoning?: string;
}

// ============================================
// PLATFORM NORMS
// ============================================

const PLATFORM_NORMS: Record<string, string> = {
  whatsapp: 'WhatsApp: Casual, quick responses, emojis welcome, voice notes common. Multiple short messages preferred over long ones.',
  telegram: 'Telegram: Mix of casual and professional, supports markdown formatting, longer messages OK.',
  instagram: 'Instagram DMs: Very casual, emoji-heavy, brief messages, memes and reactions common.',
  linkedin: 'LinkedIn: Professional tone, proper grammar, avoid slang, keep business-focused.',
  twitter: 'Twitter DMs: Casual, brief, can be witty, link sharing common.',
  signal: 'Signal: Privacy-focused, similar to SMS, mix of casual and formal.',
  imessage: 'iMessage: Casual, tapbacks/reactions common, mix of long and short messages.',
  sms: 'SMS: Brief, functional, limited formatting.',
  default: 'General messaging: Match the conversation tone, be natural and helpful.',
};

// ============================================
// CONVERSATION AGENT CLASS
// ============================================

export class ConversationAgent {
  private contactId: string;
  private chatId: string;
  private platform: string;

  private knowledgeAgent = getKnowledgeAgent();
  private styleAgent = getStyleAgent();
  private userStateAgent = getUserStateAgent();

  constructor(
    contactId: string,
    chatId: string,
    platform: string
  ) {
    this.contactId = contactId;
    this.chatId = chatId;
    this.platform = platform;
    log('constructor', 'Created agent', { contactId, chatId, platform });
  }

  /**
   * Build context for drafting a reply
   */
  async buildDraftContext(
    recentMessages: BeeperMessage[]
  ): Promise<DraftContext> {
    log('buildDraftContext', 'Starting context build', {
      messageCount: recentMessages.length,
      contactId: this.contactId,
      chatId: this.chatId,
    });

    // Get contact intelligence
    log('buildDraftContext', 'Fetching contact profile...');
    const contact = await this.knowledgeAgent.getContactProfile(
      this.contactId,
      this.chatId
    );
    log('buildDraftContext', 'Contact profile result', {
      found: !!contact,
      displayName: contact?.displayName,
      factsCount: contact?.facts?.length || 0,
      relationship: contact?.relationship?.type,
    });

    const contactName = contact?.displayName || contact?.id || 'Contact';
    const relationshipType = contact?.relationship?.type || 'unknown';

    // Get style instructions
    log('buildDraftContext', 'Fetching style instructions...');
    const styleInstructions = await this.styleAgent.getDraftInstructions(
      this.contactId,
      this.chatId,
      this.platform,
      relationshipType
    );
    log('buildDraftContext', 'Style instructions', {
      length: styleInstructions.length,
      preview: styleInstructions.slice(0, 100),
    });

    // Get user context
    log('buildDraftContext', 'Fetching user context...');
    const userContext = await this.userStateAgent.getCurrentStateSummary();
    log('buildDraftContext', 'User context', {
      length: userContext.length,
      preview: userContext.slice(0, 100),
    });

    // Get relevant distributed info
    const lastContactMessage = recentMessages
      .filter(m => !m.isFromMe)
      .pop();

    let relevantInfo: string[] = [];
    if (lastContactMessage?.text) {
      // Extract keywords from last message
      const keywords = lastContactMessage.text
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4)
        .slice(0, 3);

      log('buildDraftContext', 'Searching distributed info for keywords', { keywords });

      for (const keyword of keywords) {
        const info = await this.userStateAgent.getDistributedInfo({
          topic: keyword,
          limit: 2,
        });
        relevantInfo.push(
          ...info.map(i => `"${i.content.slice(0, 100)}..." (shared with ${i.sharedWith.length} others)`)
        );
      }
      relevantInfo = [...new Set(relevantInfo)].slice(0, 3);
      log('buildDraftContext', 'Distributed info found', { count: relevantInfo.length });
    }

    // Get platform norms
    const platformNorms = PLATFORM_NORMS[this.platform.toLowerCase()] ||
      PLATFORM_NORMS.default;

    const context = {
      contact,
      contactName,
      relationshipType,
      styleInstructions,
      userContext,
      relevantDistributedInfo: relevantInfo,
      recentMessages: recentMessages.slice(-10).map(m => ({
        isFromMe: m.isFromMe,
        text: m.text || '',
        timestamp: m.timestamp,
      })),
      platform: this.platform,
      platformNorms,
    };

    log('buildDraftContext', 'Context built successfully', {
      contactName: context.contactName,
      relationshipType: context.relationshipType,
      messageCount: context.recentMessages.length,
      platform: context.platform,
    });

    return context;
  }

  /**
   * Generate a draft reply
   * Calls the companion draft API to generate a contextual reply
   */
  async draftReply(
    recentMessages: BeeperMessage[],
    userIntent?: string
  ): Promise<DraftResult> {
    log('draftReply', 'Starting draft generation', {
      messageCount: recentMessages.length,
      hasIntent: !!userIntent,
      intent: userIntent,
    });

    const startTime = Date.now();
    const context = await this.buildDraftContext(recentMessages);

    // Build the prompts
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context, userIntent);

    log('draftReply', 'Prompts built', {
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
    });

    try {
      log('draftReply', 'Calling draft API...');

      // Call the draft API endpoint
      // Note: In a browser context, this would need to go through fetch
      // In a server context (API route), we can use the Anthropic SDK directly
      const response = await fetch('/api/intelligence/companion/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: this.chatId,
          contactName: context.contactName,
          platform: this.platform,
          contactIntelligence: context.contact,
          recentMessages: context.recentMessages.map(m => ({
            id: `msg-${Date.now()}`,
            text: m.text,
            isFromMe: m.isFromMe,
            timestamp: m.timestamp,
          })),
          intent: userIntent,
        }),
      });

      log('draftReply', 'API response received', {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        throw new Error(`Draft API returned ${response.status}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;

      log('draftReply', 'Draft generated successfully', {
        durationMs: duration,
        draftLength: (result.metadata?.draftText || result.content || '').length,
        confidence: result.metadata?.confidence,
      });

      // Record metrics
      metrics.draftGenerated();
      metrics.agentResponse(duration);

      return {
        draft: result.metadata?.draftText || result.content || '',
        confidence: result.metadata?.confidence || 0.7,
        context,
        reasoning: 'Generated based on conversation context and user style',
      };
    } catch (error) {
      logError('draftReply', 'Draft generation failed', error);

      // Fallback to simple draft based on context
      const fallbackDraft = this.generateFallbackDraft(context, userIntent);
      log('draftReply', 'Using fallback draft', { draft: fallbackDraft });

      return {
        draft: fallbackDraft,
        confidence: 0.3,
        context,
        reasoning: 'Fallback draft (API unavailable)',
      };
    }
  }

  /**
   * Generate a simple fallback draft when API is unavailable
   */
  private generateFallbackDraft(context: DraftContext, userIntent?: string): string {
    const lastMessage = context.recentMessages
      .filter(m => !m.isFromMe)
      .pop();

    if (!lastMessage) {
      return userIntent || "Hey! How's it going?";
    }

    // Simple response based on message content
    const text = lastMessage.text.toLowerCase();

    if (text.includes('?')) {
      return "Let me think about that and get back to you.";
    }
    if (text.includes('thanks') || text.includes('thank you')) {
      return "You're welcome!";
    }
    if (text.includes('sorry')) {
      return "No worries at all!";
    }

    return userIntent || "Got it, thanks for letting me know!";
  }

  /**
   * Build system prompt for LLM
   */
  private buildSystemPrompt(context: DraftContext): string {
    const parts: string[] = [];

    parts.push('You are drafting a message for the user. Match their exact style.');
    parts.push('');
    parts.push('## Platform');
    parts.push(context.platformNorms);
    parts.push('');
    parts.push('## Style Instructions');
    parts.push(context.styleInstructions);
    parts.push('');

    if (context.contact) {
      parts.push(`## About ${context.contactName}`);
      parts.push(`Relationship: ${context.relationshipType.replace('_', ' ')}`);

      const facts = (context.contact.facts || [])
        .filter(f => f.isActive)
        .slice(0, 5);

      if (facts.length > 0) {
        parts.push('Key facts:');
        for (const fact of facts) {
          parts.push(`- ${fact.content}`);
        }
      }
      parts.push('');
    }

    if (context.relevantDistributedInfo.length > 0) {
      parts.push('## Context from other conversations');
      parts.push('The user has been sharing similar info with others:');
      for (const info of context.relevantDistributedInfo) {
        parts.push(`- ${info}`);
      }
      parts.push('');
    }

    parts.push('## Important');
    parts.push('- Write ONLY the message, no explanations');
    parts.push('- Match the user\'s exact style (capitalization, punctuation, emoji usage)');
    parts.push('- Be natural and conversational');
    parts.push('- If the context requires multiple messages, separate them with ---');

    return parts.join('\n');
  }

  /**
   * Build user prompt for LLM
   */
  private buildUserPrompt(
    context: DraftContext,
    userIntent?: string
  ): string {
    const parts: string[] = [];

    parts.push('## Recent Conversation');
    for (const msg of context.recentMessages) {
      const sender = msg.isFromMe ? 'Me' : context.contactName;
      parts.push(`${sender}: ${msg.text}`);
    }
    parts.push('');

    if (userIntent) {
      parts.push(`## User wants to: ${userIntent}`);
    } else {
      parts.push('## Draft a natural reply to the last message');
    }

    return parts.join('\n');
  }

  /**
   * Analyze the conversation for action items, mood, etc.
   */
  async analyzeConversation(
    recentMessages: BeeperMessage[]
  ): Promise<{
    mood: 'positive' | 'neutral' | 'negative';
    urgency: 'high' | 'medium' | 'low';
    actionItems: string[];
    suggestedAction: string | null;
  }> {
    const lastMessage = recentMessages
      .filter(m => !m.isFromMe)
      .pop();

    if (!lastMessage?.text) {
      return {
        mood: 'neutral',
        urgency: 'low',
        actionItems: [],
        suggestedAction: null,
      };
    }

    const text = lastMessage.text.toLowerCase();

    // Simple heuristic analysis (would be replaced by LLM in production)
    let mood: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (/(?:thanks|love|great|awesome|happy|excited)/i.test(text)) {
      mood = 'positive';
    } else if (/(?:sorry|frustrated|angry|annoyed|upset|worried)/i.test(text)) {
      mood = 'negative';
    }

    let urgency: 'high' | 'medium' | 'low' = 'low';
    if (/(?:urgent|asap|emergency|right now|immediately)/i.test(text)) {
      urgency = 'high';
    } else if (/(?:when you can|soon|today|tomorrow)/i.test(text)) {
      urgency = 'medium';
    }

    // Detect action items
    const actionItems: string[] = [];
    if (/(?:can you|could you|will you|would you|please)/i.test(text)) {
      const match = text.match(/(?:can you|could you|will you|would you|please)\s+([^?]+)/i);
      if (match) {
        actionItems.push(match[1].trim());
      }
    }

    // Suggest action
    let suggestedAction: string | null = null;
    if (text.includes('?')) {
      suggestedAction = 'answer the question';
    } else if (actionItems.length > 0) {
      suggestedAction = 'respond to the request';
    } else if (mood === 'positive') {
      suggestedAction = 'acknowledge positively';
    } else if (mood === 'negative') {
      suggestedAction = 'offer support or clarification';
    }

    return { mood, urgency, actionItems, suggestedAction };
  }

  /**
   * Get conversation summary
   */
  async getConversationSummary(
    recentMessages: BeeperMessage[]
  ): Promise<string> {
    const context = await this.buildDraftContext(recentMessages);
    const analysis = await this.analyzeConversation(recentMessages);

    const parts: string[] = [];

    parts.push(`Conversation with ${context.contactName} on ${context.platform}`);
    parts.push(`Relationship: ${context.relationshipType.replace('_', ' ')}`);
    parts.push(`Mood: ${analysis.mood}, Urgency: ${analysis.urgency}`);

    if (analysis.actionItems.length > 0) {
      parts.push(`Action items: ${analysis.actionItems.join(', ')}`);
    }

    if (analysis.suggestedAction) {
      parts.push(`Suggested action: ${analysis.suggestedAction}`);
    }

    return parts.join('\n');
  }
}

// ============================================
// FACTORY
// ============================================

const agentCache = new Map<string, ConversationAgent>();

export function getConversationAgent(
  contactId: string,
  chatId: string,
  platform: string
): ConversationAgent {
  const key = `${contactId}-${chatId}-${platform}`;

  if (!agentCache.has(key)) {
    log('getConversationAgent', 'Creating new agent', { key });
    agentCache.set(key, new ConversationAgent(contactId, chatId, platform));
  } else {
    log('getConversationAgent', 'Returning cached agent', { key });
  }

  return agentCache.get(key)!;
}

export function clearConversationAgentCache(): void {
  log('clearConversationAgentCache', 'Clearing cache', { size: agentCache.size });
  agentCache.clear();
}
