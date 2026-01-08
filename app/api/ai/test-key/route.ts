import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface TestKeyBody {
  provider: 'anthropic' | 'openai';
  apiKey: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: TestKeyBody = await request.json();
    const { provider, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ valid: false, error: 'API key is required' }, { status: 400 });
    }

    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });

      // Make a minimal API call to test the key
      // Using models.list() as it's a lightweight call
      await openai.models.list();

      return NextResponse.json({ valid: true });
    } else if (provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey });

      // Make a minimal API call to test the key
      // Using a very short message with minimal tokens
      await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });

      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false, error: 'Invalid provider' }, { status: 400 });
  } catch (error) {
    // Parse the error message to provide helpful feedback
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common API key errors
    if (errorMessage.includes('Incorrect API key') || errorMessage.includes('invalid_api_key')) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid API key. Please check that you copied the full key correctly.'
      });
    }

    if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
      return NextResponse.json({
        valid: false,
        error: 'Authentication failed. The API key may be invalid or revoked.'
      });
    }

    if (errorMessage.includes('429') || errorMessage.includes('rate_limit')) {
      return NextResponse.json({
        valid: false,
        error: 'Rate limited. Please wait a moment and try again.'
      });
    }

    if (errorMessage.includes('insufficient_quota') || errorMessage.includes('billing')) {
      return NextResponse.json({
        valid: false,
        error: 'Billing issue. Please check your account has valid payment method and credits.'
      });
    }

    return NextResponse.json({
      valid: false,
      error: errorMessage
    });
  }
}
