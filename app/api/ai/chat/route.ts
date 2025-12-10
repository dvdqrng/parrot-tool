import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatBody {
  messageContext: string;
  senderName: string;
  chatHistory: ChatMessage[];
  userMessage: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AiChatBody = await request.json();
    const { messageContext, senderName, chatHistory, userMessage } = body;

    if (!userMessage) {
      return NextResponse.json(
        { error: 'userMessage is required' },
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

    const systemPrompt = `You are a helpful assistant helping the user manage their messages and draft replies.

You have access to the following conversation context from a chat with ${senderName}:

<conversation_context>
${messageContext}
</conversation_context>

You can help the user by:
- Drafting reply messages
- Summarizing the conversation
- Suggesting talking points
- Brainstorming ideas related to the conversation
- Answering questions about the conversation content

When drafting replies:
- Keep them concise and natural
- Match the tone of typical chat messages
- Don't be overly formal unless requested
- Provide just the reply text without explanations unless asked

Be helpful, concise, and friendly in your responses.`;

    // Build messages array for the API
    const messages: Anthropic.MessageParam[] = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Extract text from the response
    const textContent = response.content.find(block => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    return NextResponse.json({
      data: {
        response: responseText.trim(),
      }
    });
  } catch (error) {
    console.error('Error in AI chat:', error);

    // Check if it's an API key issue
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid or missing Anthropic API key' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    );
  }
}
