import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AIProvider } from '@/lib/intelligence-settings';

/**
 * AI Companion Search API
 * Searches conversation history and contact intelligence
 */

const LOG_PREFIX = '[API:search]';

function log(message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${message}`, data !== undefined ? data : '');
}

interface SearchRequest {
  provider?: AIProvider;
  apiKey?: string;
  chatId: string;
  query: string;
  contactName?: string;
  contactIntelligence?: {
    facts?: Array<{
      category: string;
      content: string;
      confidence: number;
      isActive?: boolean;
    }>;
    actionItems?: Array<{
      content: string;
      status: string;
      commitment?: string;
    }>;
    relationship?: {
      type: string;
      confidence: number;
    };
    summary?: string;
  };
  recentMessages?: Array<{
    id: string;
    text: string;
    isFromMe: boolean;
    timestamp: string;
    senderName?: string;
  }>;
}

function buildSearchPrompt(req: SearchRequest): string {
  const parts: string[] = [
    `You are a helpful assistant that searches through conversation history and contact knowledge.`,
    `The user is looking for: "${req.query}"`,
    ``,
  ];

  if (req.contactName) {
    parts.push(`## Conversation with: ${req.contactName}`);
    parts.push(``);
  }

  // Include extracted knowledge about the contact
  const intel = req.contactIntelligence;
  if (intel) {
    const activeFacts = intel.facts?.filter(f => f.isActive !== false) || [];
    if (activeFacts.length > 0) {
      parts.push(`## Known Facts about ${req.contactName || 'this contact'}`);
      activeFacts.forEach(f => {
        parts.push(`- [${f.category}] ${f.content} (confidence: ${f.confidence})`);
      });
      parts.push(``);
    }

    if (intel.actionItems && intel.actionItems.length > 0) {
      parts.push(`## Action Items`);
      intel.actionItems.forEach(a => {
        parts.push(`- [${a.status}] ${a.content}${a.commitment ? ` (${a.commitment})` : ''}`);
      });
      parts.push(``);
    }

    if (intel.relationship) {
      parts.push(`## Relationship: ${intel.relationship.type} (confidence: ${intel.relationship.confidence})`);
      parts.push(``);
    }

    if (intel.summary) {
      parts.push(`## Summary: ${intel.summary}`);
      parts.push(``);
    }
  }

  if (req.recentMessages && req.recentMessages.length > 0) {
    parts.push(`## Available Messages`);
    req.recentMessages.forEach((msg, idx) => {
      const sender = msg.isFromMe ? 'User' : msg.senderName || req.contactName || 'Contact';
      const date = new Date(msg.timestamp).toLocaleDateString();
      parts.push(`[${idx + 1}] ${date} - ${sender}: ${msg.text}`);
    });
    parts.push(``);
  }

  parts.push(`## Instructions`);
  parts.push(`1. Search BOTH the Known Facts and the Messages for content matching the user's query`);
  parts.push(`2. If the answer is in the Known Facts, cite it directly`);
  parts.push(`3. If found in messages, return relevant matches with their message numbers and brief context`);
  parts.push(`4. If nothing matches, say so and suggest alternative search terms`);
  parts.push(`5. Be concise and helpful`);
  parts.push(``);
  parts.push(`Format your response as:`);
  parts.push(`- A brief summary of what you found (or didn't find)`);
  parts.push(`- Relevant facts or matching messages with context`);

  return parts.join('\n');
}

export async function POST(request: NextRequest) {
  log('POST request received');

  try {
    const body = (await request.json()) as SearchRequest;
    const provider = body.provider || 'anthropic';

    log('Request parsed', {
      chatId: body.chatId,
      query: body.query,
      contactName: body.contactName,
      provider,
      messagesCount: body.recentMessages?.length || 0,
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

    if (!body.query) {
      log('No query provided');
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Search extracted facts first (free, instant)
    log('Searching extracted facts...', {
      hasFacts: !!body.contactIntelligence?.facts?.length,
      factCount: body.contactIntelligence?.facts?.length || 0,
      hasActionItems: !!body.contactIntelligence?.actionItems?.length,
      hasRelationship: !!body.contactIntelligence?.relationship,
    });
    const factResults = localFactSearch(body.query, body.contactIntelligence);
    if (factResults.length > 0) {
      log('✓ FACT SEARCH HIT - found matches in extracted facts', {
        count: factResults.length,
        matches: factResults.map(f => `[${f.category}] ${f.content.slice(0, 50)}`),
      });
      const factText = factResults
        .map(f => `- **${f.category}**: ${f.content}`)
        .join('\n');

      // If we have a clear fact match, return it directly
      if (!body.recentMessages || body.recentMessages.length === 0) {
        log('Returning fact-only results (no messages to search)');
        return NextResponse.json({
          content: `From what I know about ${body.contactName || 'this contact'}:\n\n${factText}`,
          metadata: { type: 'search', source: 'facts' },
        });
      }
    } else {
      log('No fact matches found, falling through to message search');
    }

    // If no messages to search, return fact results or nothing
    if (!body.recentMessages || body.recentMessages.length === 0) {
      log('No messages to search');
      return NextResponse.json({
        content: factResults.length > 0
          ? `From what I know about ${body.contactName || 'this contact'}:\n\n${factResults.map(f => `- **${f.category}**: ${f.content}`).join('\n')}`
          : "I don't have any messages or facts to search through. Try loading more conversation history first.",
        metadata: { type: 'search', results: [] },
      });
    }

    // For simple queries, try local search first
    log('Trying local search...');
    const simpleResults = localSearch(body.query, body.recentMessages);
    log('Local search results', { count: simpleResults.length });

    if (simpleResults.length > 0 && simpleResults.length <= 5) {
      // Simple matches found, format and return
      const resultText = simpleResults
        .map(r => `• ${r.senderName || (r.isFromMe ? 'You' : body.contactName || 'Contact')}: "${r.text.slice(0, 100)}${r.text.length > 100 ? '...' : ''}"`)
        .join('\n');

      log('Returning local search results');
      return NextResponse.json({
        content: `Found ${simpleResults.length} message(s) matching "${body.query}":\n\n${resultText}`,
        metadata: {
          type: 'search',
          results: simpleResults.map(r => r.id),
        },
      });
    }

    // Use LLM for semantic search
    log('Local search insufficient, using LLM for semantic search...', {
      localResultCount: simpleResults.length,
      factResultCount: factResults.length,
    });
    let searchResult = '';

    if (provider === 'openai') {
      log('Calling OpenAI...');
      const openai = new OpenAI({ apiKey });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use mini for faster search
        max_tokens: 512,
        messages: [
          { role: 'system', content: buildSearchPrompt(body) },
          { role: 'user', content: `Search for: ${body.query}` },
        ],
      });

      searchResult = response.choices[0]?.message?.content?.trim() || '';
      log('OpenAI response received', { resultLength: searchResult.length });
    } else {
      log('Calling Anthropic...');
      const anthropic = new Anthropic({ apiKey });

      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest', // Use Haiku for faster search
        max_tokens: 512,
        system: buildSearchPrompt(body),
        messages: [
          {
            role: 'user',
            content: `Search for: ${body.query}`,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      searchResult = textContent?.type === 'text' ? textContent.text.trim() : '';
      log('Anthropic response received', { resultLength: searchResult.length });
    }

    log('Search complete');
    return NextResponse.json({
      content: searchResult,
      metadata: {
        type: 'search',
        query: body.query,
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return NextResponse.json(
      { error: 'Failed to search messages' },
      { status: 500 }
    );
  }
}

/**
 * Search extracted facts for a query
 */
function localFactSearch(
  query: string,
  intel?: SearchRequest['contactIntelligence']
): Array<{ category: string; content: string }> {
  if (!intel?.facts) return [];

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  return intel.facts
    .filter(f => f.isActive !== false)
    .filter(f => {
      const contentLower = f.content.toLowerCase();
      const categoryLower = f.category.toLowerCase();

      // Exact phrase match
      if (contentLower.includes(queryLower)) return true;

      // Category match + any word
      if (categoryLower.includes(queryLower)) return true;

      // All query words match
      if (queryWords.length > 1 && queryWords.every(w => contentLower.includes(w))) return true;

      // At least half the words match (fuzzy)
      if (queryWords.length >= 2) {
        const matchCount = queryWords.filter(w => contentLower.includes(w)).length;
        if (matchCount >= Math.ceil(queryWords.length / 2)) return true;
      }

      return false;
    })
    .map(f => ({ category: f.category, content: f.content }));
}

/**
 * Simple local text search
 */
function localSearch(
  query: string,
  messages: SearchRequest['recentMessages']
): NonNullable<SearchRequest['recentMessages']> {
  if (!messages) return [];

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  return messages.filter(msg => {
    const textLower = msg.text.toLowerCase();

    // Exact phrase match
    if (textLower.includes(queryLower)) {
      return true;
    }

    // All words match
    if (queryWords.length > 1 && queryWords.every(w => textLower.includes(w))) {
      return true;
    }

    return false;
  });
}
