import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ToneSettings } from '@/lib/types';

interface GenerateDraftBody {
  originalMessage: string;
  senderName: string;
  conversationContext?: string;
  tone?: 'friendly' | 'professional' | 'casual';
  toneSettings?: ToneSettings;
  threadContext?: string;
  aiChatSummary?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateDraftBody = await request.json();
    const { originalMessage, senderName, conversationContext, tone = 'friendly', toneSettings, threadContext, aiChatSummary } = body;

    if (!originalMessage) {
      return NextResponse.json(
        { error: 'originalMessage is required' },
        { status: 400 }
      );
    }

    // Get API key from header or fall back to env var
    const anthropicKey = request.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Add it in Settings.' },
        { status: 401 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    // Build tone instructions from toneSettings if provided, otherwise fall back to simple tone
    let toneInstruction: string;
    if (toneSettings) {
      const { briefDetailed, formalCasual } = toneSettings;

      // briefDetailed: 0 = very brief, 100 = very detailed
      const lengthDesc = briefDetailed < 30
        ? 'Keep responses very brief and to the point.'
        : briefDetailed < 70
          ? 'Use moderate length responses.'
          : 'Provide detailed, thorough responses.';

      // formalCasual: 0 = very formal, 100 = very casual
      const styleDesc = formalCasual < 30
        ? 'Use formal, professional language.'
        : formalCasual < 70
          ? 'Use a balanced, friendly tone.'
          : 'Use casual, relaxed language with informal expressions.';

      toneInstruction = `${lengthDesc} ${styleDesc}`;
    } else {
      const toneInstructions = {
        friendly: 'Be warm, personable, and use a conversational tone.',
        professional: 'Be polite, concise, and maintain a professional tone.',
        casual: 'Be relaxed, use informal language, and feel free to use common abbreviations.',
      };
      toneInstruction = toneInstructions[tone];
    }

    // Build context sections
    let contextSection = '';
    if (threadContext) {
      contextSection += `\n\nConversation history with ${senderName}:\n<conversation>\n${threadContext}\n</conversation>`;
    }
    if (aiChatSummary) {
      contextSection += `\n\nRecent AI assistant discussion about this conversation:\n<ai_discussion>\n${aiChatSummary}\n</ai_discussion>`;
    }

    const systemPrompt = `You are helping draft message replies. ${toneInstruction}${contextSection}

Guidelines:
- Keep the response concise and natural
- Match the length and style of typical chat messages
- Don't be overly formal unless the context demands it
- Don't include greetings like "Hi" or "Hey" unless it fits naturally
- Provide just the reply text, no explanations or alternatives
- Use the conversation history and any AI discussion context to inform your reply`;

    const userPrompt = conversationContext
      ? `Context from conversation:\n${conversationContext}\n\nMessage from ${senderName}:\n"${originalMessage}"\n\nSuggest a reply:`
      : `Message from ${senderName}:\n"${originalMessage}"\n\nSuggest a reply:`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    });

    // Extract text from the response
    const textContent = response.content.find(block => block.type === 'text');
    const suggestedReply = textContent?.type === 'text' ? textContent.text : '';

    return NextResponse.json({
      data: {
        suggestedReply: suggestedReply.trim(),
      }
    });
  } catch (error) {
    console.error('Error generating draft:', error);

    // Check if it's an API key issue
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid or missing Anthropic API key' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate draft suggestion' },
      { status: 500 }
    );
  }
}
