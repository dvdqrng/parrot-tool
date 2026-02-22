import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ContactIntelligence } from '@/lib/intelligence/knowledge/types';
import { UserIntelligence } from '@/lib/intelligence/user-state/types';
import { UserSoul, renderSoulBlock } from '@/lib/intelligence/user-state/soul';
import { AIProvider } from '@/lib/intelligence-settings';

/**
 * AI Companion Chat API
 * Handles conversational interactions with the AI companion
 */

const LOG_PREFIX = '[API:chat]';

function log(message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${message}`, data !== undefined ? data : '');
}

interface ChatRequest {
  provider?: AIProvider;
  apiKey?: string;
  chatId: string;
  contactName?: string;
  platform?: string;
  message: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  contactIntelligence?: ContactIntelligence;
  userState?: UserIntelligence;
  soul?: UserSoul;
  projectedFacts?: Array<{ content: string; category: string }>;
  recentMessages?: Array<{
    id: string;
    text: string;
    isFromMe: boolean;
    timestamp: string;
    senderName?: string;
  }>;
  draftText?: string;
  chatLanguage?: string;
  attentionContext?: {
    score: number;
    urgency: string;
    reason: string;
  };
}

function buildSystemPrompt(req: ChatRequest): string {
  const parts: string[] = [
    `You are a helpful AI companion assisting the user with their messaging conversations.`,
    `You are friendly, concise, and proactive. You help draft replies, summarize conversations, and provide insights.`,
    ``,
  ];

  // Soul/identity block (injected first, before contact context)
  const soulBlock = renderSoulBlock(req.soul);
  if (soulBlock) {
    parts.push(soulBlock);
    parts.push(``);
  }

  // Add contact context
  if (req.contactName) {
    parts.push(`## Current Contact`);
    parts.push(`Name: ${req.contactName}`);
    if (req.platform) {
      parts.push(`Platform: ${req.platform}`);
    }
    parts.push(``);
  }

  // Add contact intelligence — use projected facts if available
  if (req.projectedFacts && req.projectedFacts.length > 0) {
    parts.push(`## Known Facts About ${req.contactName || 'Contact'}`);
    req.projectedFacts.forEach((fact) => {
      parts.push(`- ${fact.content} (${fact.category})`);
    });
    parts.push(``);
  } else if (req.contactIntelligence) {
    const intel = req.contactIntelligence;

    if (intel.facts && intel.facts.length > 0) {
      parts.push(`## Known Facts About ${req.contactName || 'Contact'}`);
      intel.facts
        .filter((f) => f.isActive)
        .slice(0, 10)
        .forEach((fact) => {
          parts.push(`- ${fact.content} (${fact.category})`);
        });
      parts.push(``);
    }
  }

  if (req.contactIntelligence) {
    const intel = req.contactIntelligence;

    if (intel.relationship) {
      parts.push(`## Relationship`);
      parts.push(`Type: ${intel.relationship.type} (confidence: ${Math.round(intel.relationship.confidence * 100)}%)`);
      parts.push(``);
    }

    if (intel.actionItems && intel.actionItems.length > 0) {
      const pending = intel.actionItems.filter((a) => a.status === 'pending');
      if (pending.length > 0) {
        parts.push(`## Pending Action Items`);
        pending.forEach((item) => {
          parts.push(`- ${item.content}${item.dueDate ? ` (due: ${item.dueDate})` : ''}`);
        });
        parts.push(``);
      }
    }
  }

  // Add user state context (projected contexts are pre-filtered by caller)
  if (req.userState) {
    if (req.userState.activeContexts && req.userState.activeContexts.length > 0) {
      parts.push(`## User's Active Contexts`);
      req.userState.activeContexts.forEach((ctx) => {
        const summary = ctx.keyFacts?.length > 0
          ? ctx.keyFacts.map(f => f.label).join(', ')
          : 'Active';
        parts.push(`- ${ctx.label}: ${summary}`);
      });
      parts.push(``);
    }

    if (req.userState.communicationMode) {
      parts.push(`## User's Current Mode`);
      parts.push(`Mode: ${req.userState.communicationMode}`);
      parts.push(``);
    }

    // Distributed info: things shared with others but not this contact
    if (req.userState.distributedInfo && req.userState.distributedInfo.length > 0) {
      const relevant = req.userState.distributedInfo.filter(
        d => d.sharedWith.length > 0 && req.chatId && !d.sharedWith.includes(req.chatId)
      );
      if (relevant.length > 0) {
        parts.push(`## Info Shared With Others But Not This Contact`);
        relevant.slice(0, 3).forEach(d => {
          parts.push(`- ${d.content} (shared with ${d.sharedWith.length} other contact(s))`);
        });
        parts.push(`Use this to surface relevant context the user might want to share here too.`);
        parts.push(``);
      }
    }

    // Canonical explanations: how the user typically explains things
    if (req.userState.canonicalExplanations && req.userState.canonicalExplanations.length > 0) {
      parts.push(`## How the User Typically Explains Things`);
      req.userState.canonicalExplanations.slice(0, 3).forEach(e => {
        parts.push(`- "${e.topic}": ${e.shortVersion}`);
      });
      parts.push(``);
    }

    // Active topics: what the user is currently focused on
    if (req.userState.activeTopics && req.userState.activeTopics.length > 0) {
      parts.push(`## User's Active Topics`);
      req.userState.activeTopics.slice(0, 5).forEach(t => {
        parts.push(`- ${t.topic} (discussed ${t.frequency} times recently)`);
      });
      parts.push(``);
    }

    // Current priorities
    if (req.userState.currentPriorities && req.userState.currentPriorities.length > 0) {
      parts.push(`## User's Current Priorities`);
      req.userState.currentPriorities.forEach(p => {
        parts.push(`- ${p.label}`);
      });
      parts.push(``);
    }
  }

  // Attention context
  if (req.attentionContext && req.attentionContext.score >= 30) {
    parts.push(`## Attention Level`);
    parts.push(`This conversation has ${req.attentionContext.urgency} priority (score: ${req.attentionContext.score}/100)`);
    parts.push(`Reason: ${req.attentionContext.reason}`);
    parts.push(``);
  }

  // Add recent messages
  if (req.recentMessages && req.recentMessages.length > 0) {
    parts.push(`## Recent Conversation`);
    req.recentMessages.slice(-10).forEach((msg) => {
      const sender = msg.isFromMe ? 'User' : msg.senderName || req.contactName || 'Contact';
      parts.push(`${sender}: ${msg.text.slice(0, 200)}${msg.text.length > 200 ? '...' : ''}`);
    });
    parts.push(``);
  }

  // Add current draft if exists
  if (req.draftText) {
    parts.push(`## Current Draft`);
    parts.push(`The user is currently drafting: "${req.draftText}"`);
    parts.push(``);
  }

  // Language
  if (req.chatLanguage && req.chatLanguage !== 'English') {
    parts.push(`## Language`);
    parts.push(`This conversation is in ${req.chatLanguage}. ALWAYS respond in ${req.chatLanguage}. All drafts, suggestions, and insights must be in ${req.chatLanguage}.`);
    parts.push(``);
  }

  // Instructions
  parts.push(`## Guidelines`);
  parts.push(`- Be concise and helpful`);
  parts.push(`- When drafting replies, match the tone and style appropriate for the relationship`);
  parts.push(`- Proactively surface relevant information — especially facts this contact doesn't know yet`);
  parts.push(`- If the user is explaining something they've explained before, reference their usual phrasing`);
  parts.push(`- Align suggestions with the user's current priorities when relevant`);
  parts.push(`- If asked to summarize, focus on key points and action items`);
  parts.push(`- Keep responses under 200 words unless specifically asked for more detail`);

  return parts.join('\n');
}

export async function POST(request: NextRequest) {
  log('POST request received');

  try {
    const body = (await request.json()) as ChatRequest;
    const provider = body.provider || 'anthropic';

    log('Request parsed', {
      chatId: body.chatId,
      contactName: body.contactName,
      platform: body.platform,
      provider,
      messageLength: body.message?.length || 0,
      historyLength: body.conversationHistory?.length || 0,
      hasContactIntelligence: !!body.contactIntelligence,
      hasUserState: !!body.userState,
    });

    // --- TEST LOGS: Soul + Projection ---
    log('Soul injection check', {
      hasSoul: !!body.soul,
      soulName: body.soul?.name || '(none)',
      toneKeywords: body.soul?.toneKeywords || [],
      formality: body.soul?.defaultFormality || 'unset',
      neverDo: body.soul?.neverDo?.length || 0,
      alwaysDo: body.soul?.alwaysDo?.length || 0,
      hasCustomPrompt: !!body.soul?.customSystemPrompt,
    });
    log('Projected facts check', {
      hasProjectedFacts: !!body.projectedFacts,
      projectedFactCount: body.projectedFacts?.length || 0,
      projectedFacts: body.projectedFacts?.map(f => `[${f.category}] ${f.content.slice(0, 40)}`),
      fallbackFactCount: body.contactIntelligence?.facts?.filter(f => f.isActive)?.length || 0,
    });

    // Use API key from request body (from localStorage) or fall back to env
    const apiKey = body.apiKey || (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);
    if (!apiKey) {
      log('No API key found');
      return NextResponse.json(
        { error: 'API key not configured. Add your key in Settings → Intelligence.' },
        { status: 401 }
      );
    }

    if (!body.message) {
      log('No message provided');
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build messages array
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history
    if (body.conversationHistory) {
      body.conversationHistory.forEach((msg) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      });
    }

    // Add current message
    messages.push({ role: 'user', content: body.message });

    let content = '';

    const systemPrompt = buildSystemPrompt(body);
    const soulBlockRendered = renderSoulBlock(body.soul);
    log('System prompt built', {
      length: systemPrompt.length,
      soulBlockPresent: systemPrompt.includes('## About the User'),
      soulBlockLength: soulBlockRendered.length,
      promptPreview: systemPrompt.slice(0, 200),
    });

    if (provider === 'openai') {
      log('Calling OpenAI...');
      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      });

      content = response.choices[0]?.message?.content || '';
      log('OpenAI response received', {
        contentLength: content.length,
        usage: response.usage,
      });
    } else {
      log('Calling Anthropic...');
      const anthropic = new Anthropic({ apiKey });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      const textContent = response.content.find((c) => c.type === 'text');
      content = textContent?.type === 'text' ? textContent.text : '';
      log('Anthropic response received', {
        contentLength: content.length,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      });
    }

    log('Response complete', { contentPreview: content.slice(0, 50) });

    return NextResponse.json({
      content,
      metadata: {
        type: 'chat',
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return NextResponse.json(
      { error: 'Failed to process chat' },
      { status: 500 }
    );
  }
}
