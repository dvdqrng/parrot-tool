import { NextRequest, NextResponse } from 'next/server';
import { AiProvider } from '@/lib/types';
import { callAiProvider, handleAiProviderError } from '@/lib/ai-provider';
import { AI_TOKENS, AI_TEMPERATURE } from '@/lib/ai-constants';
import { logger } from '@/lib/logger';

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
  // Optional enrichments from unified pipeline
  knowledgeContext?: string;
  writingStyleContext?: string;
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
      ollamaModel = 'deepseek-v3',
      ollamaBaseUrl,
      knowledgeContext,
      writingStyleContext,
    } = body;

    if (!userMessage) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      );
    }

    const anthropicKey = request.headers.get('x-anthropic-key') || process.env.ANTHROPIC_API_KEY;
    const openaiKey = request.headers.get('x-openai-key') || process.env.OPENAI_API_KEY;

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

Be helpful, concise, and friendly in your responses.${knowledgeContext ? `\n\nKnown information about ${senderName}:\n<knowledge>\n${knowledgeContext}\n</knowledge>` : ''}${writingStyleContext ? `\n\nWhen drafting replies, match this writing style:\n<writing_style>\n${writingStyleContext}\n</writing_style>` : ''}`;

    const responseText = await callAiProvider({
      provider,
      systemPrompt,
      messages: chatHistory,
      maxTokens: AI_TOKENS.CHAT,
      temperature: AI_TEMPERATURE.CHAT,
      ollamaModel,
      ollamaBaseUrl,
      anthropicKey,
      openaiKey,
    });

    return NextResponse.json({
      data: {
        response: responseText.trim(),
      }
    });
  } catch (error) {
    logger.error('Error in AI chat:', error instanceof Error ? error : String(error));
    const { error: errorMessage, status } = handleAiProviderError(error);
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
