/**
 * LLM Client
 * Unified interface for calling LLM providers (Anthropic, OpenAI)
 * Used by agents and API routes for direct LLM access
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { metrics } from './instrumentation/metrics';

// ============================================
// TYPES
// ============================================

export type LLMProvider = 'anthropic' | 'openai';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  durationMs: number;
}

// ============================================
// DEFAULT MODELS
// ============================================

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  anthropicHaiku: 'claude-3-5-haiku-latest',
  openai: 'gpt-4o',
  openaiMini: 'gpt-4o-mini',
};

// ============================================
// LLM CLIENT CLASS
// ============================================

export class LLMClient {
  private config: LLMConfig;
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;

  constructor(config: LLMConfig) {
    this.config = config;

    if (config.provider === 'anthropic' && config.apiKey) {
      this.anthropic = new Anthropic({ apiKey: config.apiKey });
    } else if (config.provider === 'openai' && config.apiKey) {
      this.openai = new OpenAI({ apiKey: config.apiKey });
    }
  }

  /**
   * Send a request to the LLM
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      if (this.config.provider === 'anthropic') {
        return await this.chatAnthropic(request, startTime);
      } else {
        return await this.chatOpenAI(request, startTime);
      }
    } catch (error) {
      console.error('[LLMClient] Request failed:', error);
      throw error;
    }
  }

  /**
   * Chat with Anthropic Claude
   */
  private async chatAnthropic(request: LLMRequest, startTime: number): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const model = this.config.model || DEFAULT_MODELS.anthropic;
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: request.maxTokens || 1024,
      system: request.systemPrompt || request.messages.find(m => m.role === 'system')?.content,
      messages,
    });

    const duration = Date.now() - startTime;
    const textContent = response.content.find(c => c.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';

    // Record metrics
    metrics.apiCall({
      input: response.usage?.input_tokens || 0,
      output: response.usage?.output_tokens || 0,
    });

    return {
      content,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
      model,
      durationMs: duration,
    };
  }

  /**
   * Chat with OpenAI
   */
  private async chatOpenAI(request: LLMRequest, startTime: number): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const model = this.config.model || DEFAULT_MODELS.openai;
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

    // Add system message first
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    // Add conversation messages
    for (const msg of request.messages) {
      if (msg.role === 'system' && !request.systemPrompt) {
        messages.push({ role: 'system', content: msg.content });
      } else if (msg.role !== 'system') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await this.openai.chat.completions.create({
      model,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature,
      messages,
    });

    const duration = Date.now() - startTime;
    const content = response.choices[0]?.message?.content || '';

    // Record metrics
    metrics.apiCall({
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
    });

    return {
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      model,
      durationMs: duration,
    };
  }

  /**
   * Simple single-turn completion
   */
  async complete(
    prompt: string,
    options: { maxTokens?: number; systemPrompt?: string } = {}
  ): Promise<string> {
    const response = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens,
    });
    return response.content;
  }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create an LLM client from environment variables
 */
export function createLLMClient(provider: LLMProvider = 'anthropic'): LLMClient {
  const apiKey = provider === 'openai'
    ? process.env.OPENAI_API_KEY || ''
    : process.env.ANTHROPIC_API_KEY || '';

  return new LLMClient({ provider, apiKey });
}

/**
 * Create an LLM client with explicit config
 */
export function createLLMClientWithConfig(config: LLMConfig): LLMClient {
  return new LLMClient(config);
}
