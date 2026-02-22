import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ContactIntelligence } from '@/lib/intelligence/knowledge/types';
import { UserIntelligence } from '@/lib/intelligence/user-state/types';
import { AIProvider } from '@/lib/intelligence-settings';

/**
 * AI Companion Insights API
 * Generates contextual insights about the contact and conversation
 */

interface InsightsRequest {
  provider?: AIProvider;
  apiKey?: string;
  chatId: string;
  contactName?: string;
  platform?: string;
  chatLanguage?: string;
  contactIntelligence?: ContactIntelligence;
  userState?: UserIntelligence;
  recentMessages?: Array<{
    id: string;
    text: string;
    isFromMe: boolean;
    timestamp: string;
    senderName?: string;
  }>;
}

function buildInsightsPrompt(req: InsightsRequest): string {
  const parts: string[] = [
    `You are an insightful AI assistant that helps users understand their relationships and conversations.`,
    `Analyze the available information and provide ONE useful, actionable insight.`,
    ``,
  ];

  // Contact info
  if (req.contactName) {
    parts.push(`## Contact: ${req.contactName}`);
    if (req.platform) {
      parts.push(`Platform: ${req.platform}`);
    }
    parts.push(``);
  }

  // Contact intelligence
  if (req.contactIntelligence) {
    const intel = req.contactIntelligence;

    // Relationship
    if (intel.relationship) {
      parts.push(`## Relationship`);
      parts.push(`Type: ${intel.relationship.type}`);
      parts.push(`Confidence: ${Math.round(intel.relationship.confidence * 100)}%`);

      if (intel.relationship.evolution && intel.relationship.evolution.length > 0) {
        parts.push(`Evolution: ${intel.relationship.evolution.map(e => `${e.from || 'unknown'} → ${e.to}`).join(', ')}`);
      }
      parts.push(``);
    }

    // Facts
    if (intel.facts && intel.facts.length > 0) {
      parts.push(`## Known Facts`);
      intel.facts
        .filter((f) => f.isActive)
        .slice(0, 10)
        .forEach((fact) => {
          const age = Math.round(
            (Date.now() - new Date(fact.lastConfirmed).getTime()) / (1000 * 60 * 60 * 24)
          );
          parts.push(`- ${fact.content} (${fact.category}, last confirmed ${age}d ago)`);
        });
      parts.push(``);
    }

    // Action items
    if (intel.actionItems && intel.actionItems.length > 0) {
      parts.push(`## Action Items`);
      intel.actionItems.forEach((item) => {
        const status = item.status;
        const due = item.dueDate ? `, due ${item.dueDate}` : '';
        parts.push(`- [${status}] ${item.content}${due}`);
      });
      parts.push(``);
    }

    // Interaction stats
    if (intel.lastInteractionAt || intel.totalMessageCount) {
      parts.push(`## Interaction Stats`);
      if (intel.totalMessageCount) {
        parts.push(`Total messages: ${intel.totalMessageCount}`);
      }
      if (intel.lastInteractionAt) {
        const daysSince = Math.round(
          (Date.now() - new Date(intel.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        parts.push(`Last interaction: ${daysSince} days ago`);
      }
      if (intel.avgResponseTimeMinutes) {
        parts.push(`Avg response time: ${Math.round(intel.avgResponseTimeMinutes)} minutes`);
      }
      parts.push(``);
    }
  }

  // Recent conversation
  if (req.recentMessages && req.recentMessages.length > 0) {
    parts.push(`## Recent Conversation (last ${req.recentMessages.length} messages)`);
    req.recentMessages.slice(-5).forEach((msg) => {
      const sender = msg.isFromMe ? 'User' : msg.senderName || req.contactName || 'Contact';
      const preview = msg.text.slice(0, 100) + (msg.text.length > 100 ? '...' : '');
      parts.push(`${sender}: ${preview}`);
    });
    parts.push(``);
  }

  // User state
  if (req.userState) {
    if (req.userState.activeContexts && req.userState.activeContexts.length > 0) {
      parts.push(`## User's Active Contexts`);
      req.userState.activeContexts.forEach((ctx) => {
        parts.push(`- ${ctx.label}`);
      });
      parts.push(``);
    }
  }

  // Language
  if (req.chatLanguage && req.chatLanguage !== 'English') {
    parts.push(`## Language`);
    parts.push(`This conversation is in ${req.chatLanguage}. Respond in ${req.chatLanguage}.`);
    parts.push(``);
  }

  parts.push(`## Instructions`);
  parts.push(`Generate ONE insight that is:`);
  parts.push(`1. Specific and actionable`);
  parts.push(`2. Based on the data provided`);
  parts.push(`3. Helpful for the user's relationship or communication`);
  parts.push(`4. Concise (1-3 sentences)`);
  parts.push(``);
  parts.push(`Examples of good insights:`);
  parts.push(`- "You haven't talked to Sarah in 3 weeks. She mentioned she had a job interview coming up - might be worth checking in!"`);
  parts.push(`- "Mike seems to respond faster to short messages. Consider breaking up long topics into multiple messages."`);
  parts.push(`- "You mentioned you'd send the report by Friday. That's tomorrow - don't forget!"`);
  parts.push(``);
  parts.push(`Respond with ONLY the insight, no preamble or explanation.`);

  return parts.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InsightsRequest;
    const provider = body.provider || 'anthropic';

    // Use API key from request body (from localStorage) or fall back to env
    const apiKey = body.apiKey || (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured. Add your key in Settings → Intelligence.' },
        { status: 401 }
      );
    }

    // Need some context to generate insights
    if (!body.contactIntelligence && (!body.recentMessages || body.recentMessages.length === 0)) {
      return NextResponse.json({
        content: "I don't have enough information about this contact yet. As you chat more, I'll be able to provide useful insights!",
        metadata: {
          type: 'insight',
        },
      });
    }

    let insight = '';

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 256,
        messages: [
          { role: 'system', content: buildInsightsPrompt(body) },
          { role: 'user', content: 'Generate an insight about this contact or conversation.' },
        ],
      });

      insight = response.choices[0]?.message?.content?.trim() || '';
    } else {
      const anthropic = new Anthropic({ apiKey });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        system: buildInsightsPrompt(body),
        messages: [
          {
            role: 'user',
            content: 'Generate an insight about this contact or conversation.',
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      insight = textContent?.type === 'text' ? textContent.text.trim() : '';
    }

    return NextResponse.json({
      content: insight,
      metadata: {
        type: 'insight',
      },
    });
  } catch (error) {
    console.error('Companion insights error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
