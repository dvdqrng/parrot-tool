/**
 * Tier 2 LLM Extraction API Route
 * Extracts semantic facts, relationships, and action items from messages
 * Also handles soul trait extraction (mode: 'soul')
 * Supports both Anthropic and OpenAI providers
 */

import { NextResponse } from 'next/server';
import {
  Tier2ExtractionRequest,
  buildExtractionPrompt,
  parseExtractionResponse,
} from '@/lib/intelligence/extraction/tier2-llm';
import {
  SoulExtractionRequest,
  buildSoulExtractionPrompt,
  parseSoulExtractionResponse,
} from '@/lib/intelligence/extraction/soul-extractor';
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await request.json();

    // Initialize generic LLM client with the appropriate provider
    const llmClient = new LLMClient({
      provider,
      apiKey,
      model: EXTRACTION_MODELS[provider],
    });

    // --- Soul extraction mode ---
    if (body.mode === 'soul') {
      const soulBody = body as SoulExtractionRequest;

      if (!soulBody.sentMessages || soulBody.sentMessages.length === 0) {
        return NextResponse.json(
          { error: 'No sent messages provided for soul extraction' },
          { status: 400 }
        );
      }

      console.log(`[API:extract] Soul extraction: ${soulBody.sentMessages.length} messages, ${soulBody.existingTraits?.length || 0} existing traits`);

      const prompt = buildSoulExtractionPrompt(soulBody);
      const response = await llmClient.chat({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2048,
      });

      const traits = parseSoulExtractionResponse(
        response.content,
        soulBody.existingTraits || []
      );

      console.log(`[API:extract] Soul extraction complete: ${traits.length} traits extracted`);

      return NextResponse.json({ traits });
    }

    // --- Standard contact extraction mode ---
    const contactBody = body as Tier2ExtractionRequest;

    if (!contactBody.messages || contactBody.messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }

    // Build prompt
    const prompt = buildExtractionPrompt(contactBody);

    // Call LLM API
    const response = await llmClient.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
    });

    // Parse the response
    const result = parseExtractionResponse(response.content, contactBody);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Extraction API error:', error);
    return NextResponse.json(
      { error: 'Extraction failed', details: String(error) },
      { status: 500 }
    );
  }
}
