import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import OpenAI from 'openai';
import { AiProvider } from '@/lib/types';
import { ollamaChat, OllamaMessage, getFirstAvailableModel } from '@/lib/ollama';
import { DEFAULT_OLLAMA_MODEL, DEFAULT_OPENAI_MODEL, DEFAULT_ANTHROPIC_MODEL } from '@/lib/ai-constants';

export interface AiProviderOptions {
  provider: AiProvider;
  systemPrompt: string;
  userPrompt?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens: number;
  temperature?: number;
  // Ollama settings
  ollamaModel?: string;
  ollamaBaseUrl?: string;
  // API keys
  anthropicKey?: string;
  openaiKey?: string;
}

/**
 * Unified AI provider interface
 * Handles Anthropic, OpenAI, and Ollama in one place
 * Eliminates code duplication across AI API routes
 */
export async function callAiProvider(options: AiProviderOptions): Promise<string> {
  const {
    provider,
    systemPrompt,
    userPrompt,
    messages = [],
    maxTokens,
    temperature = 0.7,
    ollamaModel = DEFAULT_OLLAMA_MODEL,
    ollamaBaseUrl,
    anthropicKey,
    openaiKey,
  } = options;

  // Build messages array - either from provided messages or from userPrompt
  let messagesList: Array<{ role: 'user' | 'assistant'; content: string }>;
  if (messages.length > 0) {
    messagesList = messages;
  } else if (userPrompt) {
    messagesList = [{ role: 'user', content: userPrompt }];
  } else {
    throw new Error('Either userPrompt or messages must be provided');
  }

  if (provider === 'ollama') {
    try {
      let modelToUse = ollamaModel;

      // Convert to Ollama format with system prompt
      const ollamaMessages: OllamaMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messagesList.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      ];

      try {
        return await ollamaChat(ollamaBaseUrl, modelToUse, ollamaMessages, maxTokens, temperature);
      } catch (modelError) {
        logger.debug(`[AI Provider] Model ${modelToUse} failed, trying first available model`);
        const firstAvailable = await getFirstAvailableModel(ollamaBaseUrl);
        if (firstAvailable) {
          modelToUse = firstAvailable;
          return await ollamaChat(ollamaBaseUrl, modelToUse, ollamaMessages, maxTokens, temperature);
        } else {
          throw modelError;
        }
      }
    } catch (error) {
      logger.error('[AI Provider] Ollama error:', error instanceof Error ? error : String(error));
      throw new Error('Failed to connect to Ollama. Make sure Ollama is running and has models installed.');
    }
  } else if (provider === 'openai') {
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured. Add it in Settings.');
    }

    const openai = new OpenAI({
      apiKey: openaiKey,
    });

    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messagesList.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    const response = await openai.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: openaiMessages,
    });

    return response.choices[0].message.content || '';
  } else {
    // Anthropic
    if (!anthropicKey) {
      throw new Error('Anthropic API key not configured. Add it in Settings.');
    }

    const anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    const anthropicMessages: Anthropic.MessageParam[] = messagesList.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    // Extract text from the response
    const textContent = response.content.find(block => block.type === 'text');
    return textContent?.type === 'text' ? textContent.text : '';
  }
}

/**
 * Helper to handle API key errors consistently
 */
export function handleAiProviderError(error: unknown): { error: string; status: number } {
  if (error instanceof Error) {
    if (error.message.includes('Anthropic API key')) {
      return {
        error: 'Anthropic API key not configured. Add it in Settings.',
        status: 401,
      };
    } else if (error.message.includes('OpenAI API key')) {
      return {
        error: 'OpenAI API key not configured. Add it in Settings.',
        status: 401,
      };
    } else if (error.message.includes('Ollama')) {
      return {
        error: error.message,
        status: 503,
      };
    }
  }

  return {
    error: 'Failed to get AI response',
    status: 500,
  };
}
