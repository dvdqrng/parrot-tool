/**
 * Tier 2 LLM Extraction API Route
 * Extracts semantic facts, relationships, and action items from messages
 * Supports both Anthropic and OpenAI providers
 */

import { NextResponse } from 'next/server';
import {
  Tier2ExtractionRequest,
  buildExtractionPrompt,
  parseExtractionResponse,
} from '@/lib/intelligence/extraction/tier2-llm';
import { LLMClient, LLMProvider } from '@/lib/intelligence/llm-client';

// Cost-efficient models for extraction
const EXTRACTION_MODELS = {
  anthropic: 'claude-3-5-haiku-latest',
  openai: 'gpt-4o-mini',
};

export async function POST(request: Request) {
  try {
    // Get provider and API key from headers (passed from client which has localStorage access)
    const provider = (request.headers.get('x-ai-provider') || 'anthropic') as LLMProvider;
    const apiKey = request.headers.get('x-ai-key') ||
      (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key provided' },
        { status: 401 }
      );
    }

    const body: Tier2ExtractionRequest = await request.json();

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }

    // Build prompt
    const prompt = buildExtractionPrompt(body);

    // Initialize generic LLM client with the appropriate provider
    const llmClient = new LLMClient({
      provider,
      apiKey,
      model: EXTRACTION_MODELS[provider],
    });

    // Call LLM API
    const response = await llmClient.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
    });

    // Parse the response
    const result = parseExtractionResponse(response.content, body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Extraction API error:', error);
    return NextResponse.json(
      { error: 'Extraction failed', details: String(error) },
      { status: 500 }
    );
  }
}
