import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ContactIntelligence } from '@/lib/intelligence/knowledge/types';
import { UserIntelligence } from '@/lib/intelligence/user-state/types';
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
  recentMessages?: Array<{
    id: string;
    text: string;
    isFromMe: boolean;
    timestamp: string;
    senderName?: string;
  }>;
  draftText?: string;
}

function buildSystemPrompt(req: ChatRequest): string {
  const parts: string[] = [
    `You are a helpful AI companion assisting the user with their messaging conversations.`,
    `You are friendly, concise, and proactive. You help draft replies, summarize conversations, and provide insights.`,
    ``,
  ];

  // Add contact context
  if (req.contactName) {
    parts.push(`## Current Contact`);
    parts.push(`Name: ${req.contactName}`);
    if (req.platform) {
      parts.push(`Platform: ${req.platform}`);
    }
    parts.push(``);
  }

  // Add contact intelligence
  if (req.contactIntelligence) {
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

  // Add user state context
  if (req.userState) {
    if (req.userState.activeContexts && req.userState.activeContexts.length > 0) {
      parts.push(`## User's Active Contexts`);
      req.userState.activeContexts.slice(0, 3).forEach((ctx) => {
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

  // Instructions
  parts.push(`## Guidelines`);
  parts.push(`- Be concise and helpful`);
  parts.push(`- When drafting replies, match the tone and style appropriate for the relationship`);
  parts.push(`- Proactively surface relevant information from the contact's profile`);
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
    log('System prompt built', { length: systemPrompt.length });

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
