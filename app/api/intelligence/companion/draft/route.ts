import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ContactIntelligence } from '@/lib/intelligence/knowledge/types';
import { UserIntelligence } from '@/lib/intelligence/user-state/types';
import { AIProvider } from '@/lib/intelligence-settings';

/**
 * AI Companion Draft API
 * Generates contextual draft replies based on conversation and intelligence
 */

const LOG_PREFIX = '[API:draft]';

function log(message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${message}`, data !== undefined ? data : '');
}

interface DraftRequest {
  provider?: AIProvider;
  apiKey?: string;
  chatId: string;
  contactName?: string;
  platform?: string;
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
  intent?: string; // Optional user-specified intent
}

function buildDraftPrompt(req: DraftRequest): string {
  const parts: string[] = [
    `You are an expert at drafting conversational messages. Generate a natural, contextual reply.`,
    ``,
  ];

  // Contact context
  if (req.contactName) {
    parts.push(`## Contact: ${req.contactName}`);
    if (req.platform) {
      parts.push(`Platform: ${req.platform}`);
    }
  }

  // Relationship context
  if (req.contactIntelligence?.relationship) {
    const rel = req.contactIntelligence.relationship;
    parts.push(`Relationship: ${rel.type} (${Math.round(rel.confidence * 100)}% confidence)`);
  }

  // Style context
  if (req.contactIntelligence?.styleProfiles && req.platform) {
    const style = req.contactIntelligence.styleProfiles[req.platform];
    if (style) {
      parts.push(``);
      parts.push(`## Communication Style for ${req.platform}`);
      parts.push(`- Formality: ${style.formality}`);
      parts.push(`- Punctuation: ${style.punctuation}`);
      parts.push(`- Emoji usage: ${style.emojiUsage}`);
      parts.push(`- Message style: ${style.messageBreaking}`);
    }
  }

  // Known facts
  if (req.contactIntelligence?.facts && req.contactIntelligence.facts.length > 0) {
    parts.push(``);
    parts.push(`## Known Facts`);
    req.contactIntelligence.facts
      .filter((f) => f.isActive)
      .slice(0, 5)
      .forEach((fact) => {
        parts.push(`- ${fact.content}`);
      });
  }

  // Recent conversation
  if (req.recentMessages && req.recentMessages.length > 0) {
    parts.push(``);
    parts.push(`## Recent Conversation`);
    req.recentMessages.slice(-8).forEach((msg) => {
      const sender = msg.isFromMe ? 'Me' : msg.senderName || req.contactName || 'Them';
      parts.push(`${sender}: ${msg.text.slice(0, 300)}${msg.text.length > 300 ? '...' : ''}`);
    });
  }

  // User's active context
  if (req.userState?.activeContexts && req.userState.activeContexts.length > 0) {
    parts.push(``);
    parts.push(`## User's Current Contexts`);
    req.userState.activeContexts.slice(0, 2).forEach((ctx) => {
      parts.push(`- ${ctx.label}: ${ctx.status || 'Active'}`);
    });
  }

  // Current draft (if editing)
  if (req.draftText) {
    parts.push(``);
    parts.push(`## Current Draft (for reference)`);
    parts.push(`"${req.draftText}"`);
    parts.push(`The user may want to improve or replace this draft.`);
  }

  // Intent
  if (req.intent) {
    parts.push(``);
    parts.push(`## User's Intent`);
    parts.push(req.intent);
  }

  parts.push(``);
  parts.push(`## Instructions`);
  parts.push(`1. Generate a natural, contextual reply that fits the conversation`);
  parts.push(`2. Match the tone and formality appropriate for this relationship`);
  parts.push(`3. Keep it concise and natural - avoid being overly formal or robotic`);
  parts.push(`4. If the platform has specific style norms, follow them`);
  parts.push(`5. Reference relevant facts when appropriate, but don't force it`);
  parts.push(``);
  parts.push(`Respond with ONLY the draft message, nothing else. No quotes, no explanation.`);

  return parts.join('\n');
}

export async function POST(request: NextRequest) {
  log('POST request received');

  try {
    const body = (await request.json()) as DraftRequest;
    const provider = body.provider || 'anthropic';

    log('Request parsed', {
      chatId: body.chatId,
      contactName: body.contactName,
      platform: body.platform,
      provider,
      messagesCount: body.recentMessages?.length || 0,
      hasContactIntelligence: !!body.contactIntelligence,
      hasUserState: !!body.userState,
      intent: body.intent,
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
    log('API key found', { provider, keyLength: apiKey.length });

    // Check if we have enough context
    if (!body.recentMessages || body.recentMessages.length === 0) {
      log('No messages provided');
      return NextResponse.json({
        content: "I need to see some conversation history to generate a draft. Can you tell me what you'd like to say?",
        metadata: {
          type: 'chat',
        },
      });
    }

    let draftText = '';

    const prompt = buildDraftPrompt(body);
    log('Prompt built', { promptLength: prompt.length });

    if (provider === 'openai') {
      log('Calling OpenAI...');
      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 512,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Generate a contextual reply draft for this conversation.' },
        ],
      });

      draftText = response.choices[0]?.message?.content?.trim() || '';
      log('OpenAI response received', {
        model: 'gpt-4o',
        draftLength: draftText.length,
        usage: response.usage,
      });
    } else {
      log('Calling Anthropic...');
      const anthropic = new Anthropic({ apiKey });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: prompt,
        messages: [
          {
            role: 'user',
            content: 'Generate a contextual reply draft for this conversation.',
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      draftText = textContent?.type === 'text' ? textContent.text.trim() : '';
      log('Anthropic response received', {
        model: response.model,
        draftLength: draftText.length,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      });
    }

    // Generate explanation
    const lastMessage = body.recentMessages?.[body.recentMessages.length - 1];
    const isReplyTo = lastMessage && !lastMessage.isFromMe;

    let explanation = '';
    if (isReplyTo) {
      explanation = `Here's a draft reply to ${body.contactName || 'their message'}:`;
    } else {
      explanation = `Here's a suggested message to continue the conversation:`;
    }

    log('Draft generated successfully', {
      draftLength: draftText.length,
      draftPreview: draftText.slice(0, 50),
    });

    return NextResponse.json({
      content: explanation,
      metadata: {
        type: 'draft',
        draftText,
        confidence: 0.8,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return NextResponse.json(
      { error: 'Failed to generate draft' },
      { status: 500 }
    );
  }
}
