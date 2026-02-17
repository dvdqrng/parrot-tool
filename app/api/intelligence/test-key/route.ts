import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

/**
 * Test API Key Endpoint
 * Validates that an Anthropic or OpenAI API key is working
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey;
    const provider = body.provider || 'anthropic';

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 });
    }

    if (provider === 'openai') {
      // Test OpenAI key
      const openai = new OpenAI({ apiKey });

      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      return NextResponse.json({ valid: true });
    } else {
      // Test Anthropic key (default)
      const anthropic = new Anthropic({ apiKey });

      await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      return NextResponse.json({ valid: true });
    }
  } catch (error: unknown) {
    console.error('API key test failed:', error);

    // Check for auth errors specifically
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 401) {
        return NextResponse.json({ valid: false, error: 'Invalid API key' }, { status: 401 });
      }
    }

    return NextResponse.json({ valid: false, error: 'Failed to validate key' }, { status: 500 });
  }
}
