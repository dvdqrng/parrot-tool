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
    `You are a helpful assistant that searches through conversation history.`,
    `The user is looking for: "${req.query}"`,
    ``,
  ];

  if (req.contactName) {
    parts.push(`## Conversation with: ${req.contactName}`);
    parts.push(``);
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
  parts.push(`1. Search the messages for content matching the user's query`);
  parts.push(`2. Return relevant matches with their message numbers and brief context`);
  parts.push(`3. If nothing matches, say so and suggest alternative search terms`);
  parts.push(`4. Be concise and helpful`);
  parts.push(``);
  parts.push(`Format your response as:`);
  parts.push(`- A brief summary of what you found (or didn't find)`);
  parts.push(`- List of matching messages with [number] and relevant excerpt`);

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

    // If no messages to search, do a simple text search
    if (!body.recentMessages || body.recentMessages.length === 0) {
      log('No messages to search');
      return NextResponse.json({
        content: "I don't have any messages to search through. Try loading more conversation history first.",
        metadata: {
          type: 'search',
          results: [],
        },
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
    log('Using LLM for semantic search...');
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
