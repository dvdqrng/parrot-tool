import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AiProvider } from '@/lib/types';
import { ollamaChat, OllamaMessage, getFirstAvailableModel } from '@/lib/ollama';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatBody {
  messageContext: string;
  senderName: string;
  chatHistory: ChatMessage[];
  userMessage: string;
  // Provider settings
  provider?: AiProvider;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AiChatBody = await request.json();
    const {
      messageContext,
      senderName,
      chatHistory,
      userMessage,
      provider = 'anthropic',
      ollamaModel = 'gemma3:4b',
      ollamaBaseUrl,
    } = body;

    if (!userMessage) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      );
    }

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
- When providing draft options, wrap EACH draft in <draft> tags like this:
  <draft>Your draft message here</draft>
- If providing multiple options, use separate <draft> tags for each one
- You can include explanatory text before or after the draft tags

Be helpful, concise, and friendly in your responses.`;

    let responseText: string;

    if (provider === 'ollama') {
      // Use Ollama - validate model or use first available
      try {
        let modelToUse = ollamaModel;

        // Convert chat history to Ollama format with system prompt
        const messages: OllamaMessage[] = [
          { role: 'system', content: systemPrompt },
          ...chatHistory.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        ];

        try {
          responseText = await ollamaChat(ollamaBaseUrl, modelToUse, messages, 1024);
        } catch (modelError) {
          console.log(`[Chat] Model ${modelToUse} failed, trying first available model`);
          const firstAvailable = await getFirstAvailableModel(ollamaBaseUrl);
          if (firstAvailable) {
            modelToUse = firstAvailable;
            responseText = await ollamaChat(ollamaBaseUrl, modelToUse, messages, 1024);
          } else {
            throw modelError;
          }
        }
      } catch (error) {
        console.error('Ollama error:', error);
        return NextResponse.json(
          { error: 'Failed to connect to Ollama. Make sure Ollama is running and has models installed.' },
          { status: 503 }
        );
      }
    } else {
      // Use Anthropic
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
      responseText = textContent?.type === 'text' ? textContent.text : '';
    }

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
